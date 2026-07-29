---
name: review-commit-fix-loop
description: Use when asked to review staged changes and fix what the review finds — iterates the verified review pipeline (review-commit-triage-verify) with a fix phase (fix-findings) until a pass confirms no major or critical issue, capped at 3 review passes. Edits code and stages the fixes; never commits.
argument-hint: '[-v (run automatic verifications, forwarded to every pass)] [-x (cross-vendor second review, first pass only)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

The iterated composite for the pre-commit cycle: run the verified review pipeline, fix what it confirms, re-stage, and review again — until a pass confirms no major/critical finding, or 3 review passes have run. Each pass executes whole sibling skills: `../review-commit-triage-verify/SKILL.md` for the review, `../fix-findings/SKILL.md` for the fixes. Read each and run its full protocol; the overrides below are pipeline-wide.

This is the kit's one composite that **writes**. The review and verify phases keep their own read-only guarantees, and the fix phase edits code exactly as `fix-findings` specs it. On top of that, this composite performs its **only Git mutation**: `git add` of fix-touched paths between passes — nothing else is ever staged, and the commit itself always stays with `/commit`. Invoking this skill is the explicit ask the Git-discipline rule requires for that staging.

## Flags

- `-v` — forwarded to **every** pass's review phase: the verification scripts are cheap and re-running them is what catches a fix regressing something.
- `-x` — forwarded to the **first** pass only: the uncorrelated cold review earns its cost on the original diff; later passes re-certify deltas the session already understands. Its `Cross-check:` line is reported from pass 1.

Both forwarding scopes are defaults with those rationales, not invariants — a user asking for `-x` on every pass gets it.

## The Loop

Each pass, in order:

1. **Review** — execute `../review-commit-triage-verify/SKILL.md` end to end (its Setup, phases, and identity checks included; nothing staged means inform and stop, per its own rule). Hold its output per the **Chat display** override below.
2. **Exit check** — count the pass's **Confirmed major/critical** findings. Zero → exit the loop and render the Output; Confirmed minors, if any, become survivors — the Output points them at `/fix-findings`, because fixing them here would leave the fixes uncertified by any pass.
3. **Cap check** — if this was the 3rd review pass, exit and render the Output with the survivors. **The fix phase never runs after the final permitted pass**: a fix no pass can re-certify would stage unreviewed changes and desynchronize the Reviewed digest `/commit` depends on.
4. **Fix** — execute `../fix-findings/SKILL.md` on this pass's findings (its source rule resolves to exactly this pass — the session's most recent verified review), with one override: a fix that must touch a file carrying unstaged edits that predate this run routes to the ask batch regardless of the gate, offering skip (the finding survives) or the user reconciling that file first — auto-staging it would sweep the user's unrelated work into the commit.
5. **Re-stage** — `git add` exactly the paths the fix phase touched: paths from the pass's staged set (the review's Setup guarantees tree==index there, so the post-fix diff is fixes only), paths that were clean before the fix, and files the fixes created. Re-staging happens **between** passes, never during one — the review's identity checks run inside a pass and are never crossed by this composite.
6. Next pass — back to 1.

## Overrides

Three pipeline-wide overrides, the same seams every composite owns:

- **Core Rules blocks** — this composite's block covers the pipeline; inner skills' AGENTS.md reads and `✅` echoes don't repeat. This includes the inner composite's own copy of these overrides — they nest.
- **Chat display** — one progress line per pass as it completes: `pass N: <x> confirmed (<y> major/critical) · <z> fixed · <w> asked`. Everything else — findings, verdicts, batches, fix detail — is held for the final Output. If a pass fails hard mid-pipeline, print its held sections before stopping; no pass's review is lost to a dead loop.
- **Next pointers** — inner skills' follow-up suggestions are dropped; this composite's Output owns **Next**.

The one fix-phase protocol override is stated in the loop's step 4; past these, each phase runs its skill file as written.

## Output

Lists, never tables. Rendered once, when the loop exits.

- **Passes** — the progress lines, one per pass.
- **Findings** — every finding from every pass exactly once, grouped by final disposition: **Fixed** (pass N, what changed, `file:line`), **Decided** (the ask's outcomes), **Fix failed** (reverted, why), **Withdrawn** (the probe's evidence), **Survivors** — Confirmed findings still open (final-pass minors, cap leftovers) plus Inconclusive/Unverified ones, each with severity and location. A finding fixed in pass N and re-confirmed later is one entry telling that story, not two.
- **Cross-check** (only with `-x`) — pass 1's line, as the review phase specs it.
- **Reviewed** — the **last** pass's provenance line, verbatim; earlier digests are superseded, this is the one `/commit` confirms against.
- **Commit message** — the last pass's drafted message. No fixes are applied after the final pass, so it describes exactly the staged set the digest covers.

**Next:** no survivors, or minor survivors you accept → `/commit`. Minor survivors worth fixing → `/fix-findings`, then re-stage and `/review-commit-triage-verify` to certify, then `/commit`. Major/critical survivors (cap hit) → they need addressing before this set should ship; `/fix-findings` for another targeted round, or take them manually.

## Don't Rationalize

- "Pass 2 only needs to look at the files I fixed" — Whole-set certification is the loop's entire value; a scoped re-review certifies nothing about the set.
- "One more pass past the cap will surely come back clean" — The cap is the contract. Oscillating fixes are a signal a human should look, not a reason to iterate harder.
- "The final pass's minors are trivial, I'll fix them on the way out" — A fix no pass reviews ships unreviewed and breaks the digest `/commit` checks. Hand them to `/fix-findings` instead.
- "The ask is blocking the loop, I'll pick for the user" — The gate routed those findings *because* they need the user. A stalled loop is the designed behavior, not a failure.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Every pass ran the inner composite from its skill file, and every fix ran through `fix-findings` — neither improvised from memory
- [ ] The exit and cap checks ran **before** each fix phase; no fix phase ran after the final permitted pass
- [ ] Staging was `git add` of fix-touched paths only, between passes only; no path carrying pre-run unstaged edits was auto-staged; nothing committed
- [ ] At most 3 review passes; survivors reported rather than fixed past the cap
- [ ] Final Output carries every finding from every pass exactly once, the last pass's Reviewed line, and its commit message

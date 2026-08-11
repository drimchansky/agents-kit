---
name: review-commit-fix-loop
description: Use when asked to review the uncommitted change and fix what the review finds — iterates the verified review pipeline (review-commit-triage-verify -w) with a fix phase (fix-findings) until a pass leaves no open Confirmed finding of any severity, a fix phase applies nothing, or 3 review passes have run. Edits working-tree code only; never stages, never commits.
argument-hint: '[-x (cross-vendor second review, first pass only)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

The iterated composite for the pre-commit cycle: review the uncommitted change, fix what the review confirms, then review again — until a pass leaves nothing open, a fix phase applies nothing, or three review passes have run. Each pass executes `../review-commit-triage-verify/SKILL.md` **whole**, with `-w`; each fix phase executes `../fix-findings/SKILL.md` whole. Read each and run its full protocol — this file orchestrates them and re-implements neither.

**CRITICAL**: this composite writes **working-tree code and nothing else**. It stages nothing, commits nothing, creates no branch, and pushes nothing; the index is never written. The review object is the working-tree target defined in `./references/engineering/review.md` § *Working-tree review target*, which the inner pipeline resolves under `-w` — cited, not restated here.

That target is what makes iteration possible at all. Each pass reads the live tree, so the previous pass's fixes are in the next pass's review object by construction — **including a file a fix created and never staged**, which the target carries as wholly-new content. A loop reviewing the index instead would report clean over exactly the code it just wrote.

## Flags

- `-x` — forwarded to the **first** pass's review phase only. The uncorrelated cold review earns its cross-vendor cost on the original change; later passes certify fixes over mostly-identical content, and re-running it there spends a context budget that is already this pipeline's binding constraint. Its `Cross-check:` line is reported from pass 1. A default with that rationale, not an invariant — a user asking for `-x` on every pass gets it.

`-w` is not a flag of this skill: every pass runs the inner composite with it, for the reason above. `review-commit` has no `-p` — lens probes are `review-pr`'s — so `-x` is the only forwardable review flag.

## The Loop

Each pass, in order:

1. **Review** — execute `../review-commit-triage-verify/SKILL.md` end to end with `-w`: its Setup, all three phases, and its own within-pass identity re-check. An empty review object means inform the user and stop, per its rule. Hold its output per the **Chat display** override below.
2. **Success exit** — count this pass's **open Confirmed** findings, of **any severity**. Zero → exit the loop and render the Output. Minors are counted like anything else: a pass that leaves a Confirmed minor open has work left, and the cap is what bounds the cost of saying so. A finding the engineer decided on in an earlier pass's ask **never returns to a fix phase** — nothing iterates on a judgement the engineer already made. Carry a ledger of those decisions across passes, matching by `file:line`, or the anchorless scope, together with the defect named, since a fix shifts line numbers; a later pass reviews the whole tree and re-finds them, so nothing else closes them. `fix-findings` reports them in its **Decided** bucket as *skipped*, *deferred*, or *rejected*, and **all three are withheld from what step 4 hands it**, landing in that skill's **Untouched** bucket as findings this run excluded. They part only on the count here: **rejected** is closed and subtracted before counting, while *skipped* and *deferred* stay **counted open**, so a run carrying one exits at step 3 or step 5 and names it under **Survivors** rather than reporting success over a defect still in the tree. The same ledger is what makes the Output's one-entry-per-finding rule executable.
3. **Cap check** — if this was the **3rd** review pass, exit and render the Output with the survivors named. **The fix phase never runs after the final permitted pass**: a fix no pass reviews ships unreviewed, which is the whole property the loop exists to provide.
4. **Fix** — execute `../fix-findings/SKILL.md` on this pass's findings. Its no-argument source rule resolves to exactly this pass — the session's most recent verified review — and its gate is **unchanged**: a Confirmed finding whose options agree on one evident change with minimal blast radius applies automatically; everything else joins the one batched ask. Record each ask-routed finding per **Ask routing** below as the phase runs.
5. **No-progress exit** — if that fix phase applied **nothing** — every ask decided without a fix, every attempted fix failed and was reverted, or both — exit now and render the Output. Re-reviewing an unchanged tree reproduces the identical pass, so spending a review pass on it buys nothing.
6. Otherwise, next pass — back to 1.

## Ask routing

Every finding the fix phase routes to the ask is recorded with two facts, taken from `verify-issue`'s fix options as the verify phase emitted them:

- its **blast radius** — the option's own stated radius, verbatim, not a re-derivation;
- whether the options **agreed** on one evident change, or offered a genuine choice.

An ask-routed finding carrying **no** fix options — Unverified, out of probe scope, or a probe that failed — records `no options — unverified` for both, so the counts distinguish *options disagreed* from *no options existed*. This record is the point of instrumenting the loop: it is the evidence for whether a middle autonomy tier would route a real share of findings away from the ask, and it is read off real runs rather than argued in advance.

## Overrides

Three pipeline-wide overrides, the seams every composite owns:

- **Core Rules blocks** — this composite's block covers the pipeline; inner skills' AGENTS.md reads don't repeat. This includes the inner composite's own copy of these overrides — they nest.
- **Chat display** — one progress line per pass as it completes: `pass N: <x> confirmed · <y> fixed · <z> asked · <w> decided` — `decided` counting every ask that produced no fix, all three of `fix-findings`' kinds, so the four fields close. On a pass that exits at step 2 or step 3 no fix phase ran, so those three fields read `—` rather than `0` — the line is printed live, before the Output names the exit, and `0 fixed · 0 asked · 0 decided` would render a cap exit identically to a no-progress one. Everything else — findings, verdicts, batches, fix detail — is held for the final Output. If a pass fails hard mid-pipeline, print its held sections before stopping; no pass's review is lost to a dead loop.
- **Next pointers** — inner skills' follow-up suggestions are dropped; this composite's Output owns **Next**.

Past these, each phase runs its skill file as written — no improvisation, and no override of the fix gate.

## Output

Lists, never tables. Rendered once, when the loop exits.

- **Passes** — the progress lines, one per pass, and which exit ended the run: success, no-progress, or cap.
- **Findings** — every finding from every pass **exactly once**, under one final disposition: **Fixed** (which pass, what changed, `file:line`), **Decided** (the engineer *rejected* it in the ask — closed, not outstanding), **Fix failed** (reverted, why), **Withdrawn** (the probe's evidence), **Survivors** (Confirmed findings still open at the exit, plus Inconclusive and Unverified ones, each with severity and location — and, where the engineer *skipped* or *deferred* one, that decision beside it, since it stays open but never returns to a fix phase). A finding fixed in one pass and re-confirmed in a later one is **one** entry telling that story, not two.
- **Ask routing** — one line per ask-routed finding: its blast radius and whether its options agreed, per **Ask routing** above.
- **Verified** — each pass's **Verified** line, exactly as `review-commit-triage-verify` specs it. It is that skill's mandatory line and the verify shape's outcome line under `./references/workflow/agent-fanout.md` § *Merge contract*, so it is forwarded rather than dropped: without it a run whose probes all failed and verified inline reads identically to one with cold eyes on every batch.
- **Cross-check** (only with `-x`) — pass 1's line, as the review phase specs it.
- **Reviewed** — the **last** pass's provenance line verbatim, in the `Reviewed (working tree) <digest> (<n> files) by <model> <effort>` form the inner pipeline emits under `-w`. Earlier passes' digests are superseded, and none of them is comparable to a staged-set digest.
- **Commit message** — the last pass's drafted message, with its note that it describes the reviewed tree rather than the index.

**Next:** nothing here was staged, so this output cannot be handed to `/commit` — its digest covers the working tree and that skill refuses the marked form. Stage what you intend to commit, run `/review-commit` (no flag) over that index to certify the set as staged, then `/commit`. Survivors worth fixing first → `/fix-findings` for another targeted round, or take them by hand.

## Don't Rationalize

- "Pass 2 only needs to look at the files I fixed" — Whole-set certification is the loop's entire value; nothing in the review phase scopes a pass to the delta, and narrowing it by hand certifies nothing about the set.
- "One more pass past the cap will surely come back clean" — The cap is the contract. Oscillating fixes are a signal a human should look, not a reason to iterate harder.
- "The final pass's findings are trivial, I'll fix them on the way out" — A fix no pass reviews ships unreviewed. Report them as survivors.
- "Nothing was applied, but the next pass might find something new" — It won't: the tree is unchanged, so the pass is the one that just ran. The no-progress exit is the answer, not a shortcut past one.
- "The ask is blocking the loop, I'll pick for the user" — The gate routed those findings *because* they need the user. A stalled loop is the designed behavior, not a failure.
- "I'll `git add` the fixes so the next pass sees them" — The next pass sees them already; that is what `-w` is for. Staging would re-import the exact departure this loop was rebuilt without.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Every pass ran the inner composite from its skill file with `-w`, and every fix ran through `fix-findings` — neither improvised from memory, and the fix gate unmodified
- [ ] The success and cap checks ran **before** each fix phase; no fix phase ran after the third review pass
- [ ] The no-progress exit fired whenever a fix phase applied nothing, rather than spending another review pass on an unchanged tree
- [ ] At most 3 review passes; survivors reported rather than fixed past the cap
- [ ] Final Output carries every finding from every pass exactly once with one disposition, an **Ask routing** line per ask-routed finding (`no options — unverified` where none existed), each pass's **Verified** line, the last pass's `Reviewed (working tree)` line, and its commit message
- [ ] Nothing staged, nothing committed, no branch, no push — no `git add`, no commit, no branch creation, and no push at any point in the run

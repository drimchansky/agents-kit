---
name: review-commit
description: Use when asked to review staged changes before committing.
argument-hint: '[-x (cross-vendor second review)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Review staged changes before committing — correctness, completeness, accidental inclusions, and pattern fit — and draft the commit message.

## Flags

- `-x` — Cross-check: launch one independent cold review of the reviewed object on the cross-vendor engine and merge it before findings are finalized, per `./references/workflow/probe-cross-check.md` on the cold-review shape in `./references/workflow/probe-shape-cold-review.md`, under the shared contract in `./references/workflow/agent-fanout.md`, with the engine and its launch recipe in `./references/workflow/probe-engines-cross-vendor.md`. Off by default. The probe is read-only; its outcome is recorded on the output's `Cross-check:` line. <!-- cold -->

## References

Before working, read `./references/engineering/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review. On a delegated pass the reviewer reads that same file and the per-surface checklists beside it in its own sidechain, from the installed paths the packet names; the session's copy is what the settle calibrates severity against.

## Setup

- **Resolve the review object.** The staged diff, `git diff --cached`.
- **Nothing to review → inform the user and stop.** That means an empty index; tell the user to stage what they want reviewed and run this again. `git add -A` is the usual way, covering every tracked change and every untracked non-ignored file — though not a path marked `skip-worktree` or `assume-unchanged`, which it skips silently.
- Record the reviewed-set identity for the follow-up: the digest `git diff --cached | git hash-object --stdin` and the reviewed paths `git diff --cached --name-only` — that digest covers the index *and* its base, so a HEAD that moves after the review reads as a changed set, which it is, since the commit would carry a different change. Every command here only reads — nothing writes the index or the object store.

**Launch the cross-vendor probe** (only with `-x`): once the review object is confirmed non-empty, start one background probe per `./references/workflow/probe-cross-check.md` on the cold-review shape in `./references/workflow/probe-shape-cold-review.md`, on the engine and launch recipe in `./references/workflow/probe-engines-cross-vendor.md` — a cold second review of that same object, demanding findings with severity and `file:line` evidence. The probe assembles the object itself at the repo root, so the prompt must name it concretely: the staged diff, `git diff --cached`. A probe handed the wrong object reviews a different change than this pass did. It is read-only, so it may overlap the reviewer below; it merges in the Settle, before findings are finalized. <!-- cold -->

## Review pass

**Launch.** Spawn the native `reviewer` subagent — the kit-installed adapter `./references/workflow/reviewer-contract.md` § *Adapter defaults* describes; a host with no adapter, or one that cannot launch it, takes the inline fallback below under that file's § *Degrade rule*. The launch prompt is a review packet per its § *Launch packet* — the reviewer loads the contract's reviewer-facing sections in its own sidechain; the session hands the packet over, then settles the return by the contract's session-facing sections, read cold at that point. The session puts in it:

- the review object named concretely — the staged diff, `git diff --cached`, never pasted diff text — with its identity, the digest Setup recorded;
- the absolute effective working root, the tree the staged set lives on, which may be a worktree rather than the main checkout;
- the kind, `commit`;
- the absolute installed paths of the review pack and of the rules the review runs under — the install home's `references/engineering/review.md` (`~/.claude/` on Claude, `~/.codex/` on Codex), the per-surface checklist directory beside it, the engineering overlay `references/engineering/rules.md` in that same directory, and the install home's `CORE_RULES.md`;
- any context and constraints the user gave with the invocation — the why behind the change, a focus to take, a constraint to honour — verbatim, or `none`: the session holds them and the reviewer sees no session context;
- this skill's § *Review Focus*, verbatim — the review pack does not carry it;
- the instruction that the reviewer groups the set by file and intent, traces blast radius itself, and runs the project's verification scripts over the staged files.

A packet item that is missing or ambiguous is completed by reading or asking; a packet is never launched short.

**Wait.** While the reviewer is in flight the session runs no command against the tree — no reads of the diff, no scripts, no scratch runs. Wait on the harness's own completion signal per `./references/workflow/delegated-waiting.md` § *How to wait*, reporting where the launch stands at each check-in. The `-x` probe is read-only and may overlap it.

**Settle.** Per `./references/workflow/reviewer-contract.md` § *The settle*, read cold at this point. Its two intake checks run first, in order, before anything else: the `Identity` echo against the digest Setup recorded — a mismatch means the reviewer resolved a different object: stop and report, settle nothing — then every return heading present, a malformed return taking the inline fallback below with reason `reviewer failed`. Then adopt, spot-check, assign the final verdicts, and merge the `-x` probe as that section orders.

A composite driving this skill suppresses the steps after the intake checks — where it does, its own text governs, and every returned finding reaches its verify phase as a candidate. Adopted findings render in the shape Output cites. The commit message is the session's own, drafted per Output's message rules from the return's `Change map` — not one of the suppressed steps, so a composite forwards it unchanged.

**Inline fallback.** Where the reviewer cannot launch or a launched one failed — the reasons `./references/workflow/reviewer-contract.md` § *Degrade rule* closes — announce which and why, then run the pass here:

- Group changes by file and intent.
- **Launch verification scripts** per "Verification Scripts" in `./references/engineering/review.md`: as soon as the review object is confirmed, launch the project's lint/typecheck/test scripts over its files and review while they run; their failures and warnings land as findings before output. That same section carries the reproduction bar a candidate must clear before it is adopted.
- Apply § *Review Focus*.

The review object, the digest, and everything Output owes are unchanged here — only the runner is.

## Review Focus

The reviewer applies this focus on a delegated pass; the session applies it on the inline fallback.

**Examine tests first.** The reviewed set's test changes reveal what behavior the change is supposed to produce. Read them before the implementation.

Prioritize:

- **Correctness** — Does the logic do what's intended? Obvious bugs, typos, missing null checks
- **Completeness** — Are the related changes all present in the reviewed set? Missing type updates, forgotten test updates
- **Accidental inclusions** — Debug logs, commented-out code, unrelated formatting changes, sensitive data
- **Consistency** — Do changes follow existing patterns in the touched files?

Apply the full review process from `./references/engineering/review.md` — the same lenses apply, scoped to the review object Setup resolved.

## Output

**Review findings** (if any) — in the shape `./references/engineering/review.md` § *Findings output shape* defines: one entry per issue with its severity, `file:line`, recommendation, and impact, Minors in that same shape and the list never capped.

**Cross-check** (only with `-x`) — the probe's `Cross-check:` outcome line per `./references/workflow/agent-fanout.md`, after the findings. <!-- cold -->

**Reviewed** — a provenance line recording the reviewed-set digest from Setup, the reviewed-file count, and the model that produced this review (plus its reasoning-effort level, when known), e.g. `Reviewed <digest> (3 files) by <model> <effort>`. On a delegated pass that model and effort are the reviewer adapter's own `model:` and `effort:` values; on the inline fallback they are the session's. Count only, never the path list — on a large set the list drowns the line, and `/commit` doesn't read it: what it reads is the digest, to confirm the set it would commit is still the set reviewed here, so that check survives the diff itself scrolling out of context. The model is for the human record only — unlike `review-pr`'s line, which `/publish-pr-review` reads to attribute the posted review, nothing downstream consumes it here: the commit carries no AI attribution.

**Review pass** — mandatory, per `./references/workflow/reviewer-contract.md` § *Degrade rule*: `Review pass: delegated (<model>)` when the reviewer produced the pass, `Review pass: inline (<reason>)` when the session did, the reason one of that section's closed set and `<model>` read as its § *Adapter defaults* says. Owed on either path: an unrecorded degrade reads exactly like a delegated pass.

**Divergence** — the diverging reviewed paths the runner recorded per "Verification Scripts" in `./references/engineering/review.md` — the return's `Divergence` heading on a delegated pass, the session's own record on the inline fallback — each with the context reported at it; `None` when the tree carries the object.

**Commit message** — the message for the staged changes, **drafted by the session on either pass**: from the return's `Change map` on a delegated pass, from the session's own grouping on the inline fallback. The reviewer drafts none and is never asked for one, because these rules are this skill's and it never sees them. Where the map leaves an intent unclear, read the staged diff for it: the tree is the session's again once the reviewer has returned. It follows:

- First line: imperative mood, max 72 chars, describe _what_ and _why_ (not _how_)
- Body (if needed): additional context for non-obvious changes, separated by blank line
- Follow the project's existing commit message conventions (check `git log --oneline -10` for style)
- No `Co-Authored-By` trailer, no "Generated with Claude Code" line, and no other AI/tool attribution footer — even if a harness or environment default asks for one. End the message at the body.

Example:

```
fix: prevent stale closure in usePolling callback

The interval callback captured the initial state value. Use a ref
to always read the latest value inside the interval.
```

**Next:** once any findings above are addressed, run `/commit` to create the commit with this message.

## Verification

Apply the Standard Verification Checklist in `./references/engineering/review.md`. The output carries the **Reviewed** provenance line (reviewed-set digest + file count + the reviewing model and effort) and the `Review pass:` line, and **Next** points at `/commit`.
On a delegated pass: the packet named the same review object and digest Setup resolved, both intake checks passed — the `Identity` echo matched that digest and every return heading was present — before any settle step, the settle re-read every Critical and Major anchor before rendering it, the session ran no command against the tree while the reviewer was in flight, the session drafted the commit message itself from the return's `Change map`, and the line reads `delegated (<model>)`.
On the inline fallback: the reason was announced and the line reads `inline (<reason>)`.
With `-x`: the probe was merged per `./references/workflow/agent-fanout.md`, its prompt named the same review object Setup resolved, and the output carries its `Cross-check:` line. <!-- cold -->

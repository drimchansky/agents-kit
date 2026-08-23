---
name: review-commit
description: Use when asked to review staged changes before committing.
argument-hint: '[-x (cross-vendor second review)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Review staged changes before committing — correctness, completeness, accidental inclusions, and pattern fit — and draft the commit message.

## Flags

- `-x` — Cross-check: launch one independent cold review of the reviewed object on the cross-vendor engine and merge it before findings are finalized, per `./references/workflow/probe-cross-check.md` on the cold-review shape in `./references/workflow/probe-shape-cold-review.md`, under the shared contract in `./references/workflow/agent-fanout.md`, with the engine and its launch recipe in `./references/workflow/probe-engines-cross-vendor.md`. Off by default. The probe is read-only; its outcome is recorded on the output's `Cross-check:` line. <!-- cold -->

## References

Before working, read `./references/engineering/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review.

## Setup

- **Resolve the review object.** The staged diff, `git diff --cached`.
- **Nothing to review → inform the user and stop.** That means an empty index; tell the user to stage what they want reviewed and run this again. `git add -A` is the usual way, covering every tracked change and every untracked non-ignored file — though not a path marked `skip-worktree` or `assume-unchanged`, which it skips silently.
- Record the reviewed-set identity for the follow-up: the digest `git diff --cached | git hash-object --stdin` and the reviewed paths `git diff --cached --name-only` — that digest covers the index *and* its base, so a HEAD that moves after the review reads as a changed set, which it is, since the commit would carry a different change. Every command here only reads — nothing writes the index or the object store.
- Group changes by file and intent

**Launch the cross-vendor probe** (only with `-x`): once the review object is confirmed non-empty, start one background probe per `./references/workflow/probe-cross-check.md` on the cold-review shape in `./references/workflow/probe-shape-cold-review.md`, on the engine and launch recipe in `./references/workflow/probe-engines-cross-vendor.md` — a cold second review of that same object, demanding findings with severity and `file:line` evidence. The probe assembles the object itself at the repo root, so the prompt must name it concretely: the staged diff, `git diff --cached`. A probe handed the wrong object reviews a different change than this pass did. Review inline while it runs; collect and merge per the contract before finalizing findings. <!-- cold -->

**Launch verification scripts** per "Verification Scripts" in `./references/engineering/review.md` — always: as soon as the review object is confirmed, launch the project's lint/typecheck/test scripts over its files and review while they run; their failures and warnings land as findings before output. That same section carries the reproduction bar a candidate must clear before it is adopted.

## Review Focus

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

**Reviewed** — a provenance line recording the reviewed-set digest from Setup, the reviewed-file count, and the model that produced this review (plus its reasoning-effort level, when known), e.g. `Reviewed <digest> (3 files) by <model> <effort>`. Count only, never the path list — on a large set the list drowns the line, and `/commit` doesn't read it: what it reads is the digest, to confirm the set it would commit is still the set reviewed here, so that check survives the diff itself scrolling out of context. The model is for the human record only — unlike `review-pr`'s line, which `/publish-pr-review` reads to attribute the posted review, nothing downstream consumes it here: the commit carries no AI attribution.

**Commit message** — Generate a commit message for the staged changes:

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

Apply the Standard Verification Checklist in `./references/engineering/review.md`. The output carries the **Reviewed** provenance line (reviewed-set digest + file count + the reviewing model and effort), and **Next** points at `/commit`.
With `-x`: the probe was merged per `./references/workflow/agent-fanout.md`, its prompt named the same review object Setup resolved, and the output carries its `Cross-check:` line. <!-- cold -->

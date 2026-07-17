---
name: review-commit
description: Use when asked to review staged changes before committing.
argument-hint: '[-v (run automatic verifications)] [-x (cross-vendor second review)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

Review staged changes before committing — correctness, completeness, accidental inclusions, and pattern fit — and draft the commit message.

## Flags

- `-v` — Identify and run the project's verification scripts (lint, typecheck, tests). Off by default; reviews are analysis-only. See "Verification Scripts" in `./references/engineering/review.md`.
- `-x` — Cross-check: launch one independent cold review of the staged diff on the cross-vendor engine and merge it before findings are finalized, per the shared contract in `./references/workflow/agent-fanout.md`. Off by default. The probe is read-only; its outcome is recorded on the output's `Cross-check:` line.

## References

Before working, read `./references/engineering/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review.

## Setup

- Get staged diff: `git diff --cached`
- If nothing is staged, inform the user and stop
- Record the staged-set identity for the `/commit` follow-up: the digest `git diff --cached | git hash-object --stdin` and the reviewed paths `git diff --cached --name-only`. Both are read-only (no `-w`, nothing written). The digest covers the index *and* its base, so a HEAD that moves after the review reads as a changed set — which it is, since the commit would carry a different change.
- Group changes by file and intent

**Launch the cross-vendor probe** (only with `-x`): once the staged diff is confirmed non-empty, start one background probe per `./references/workflow/agent-fanout.md` — a cold second review of the staged diff (the probe reads `git diff --cached` itself at the repo root), demanding findings with severity and `file:line` evidence. Review inline while it runs; collect and merge per the contract before finalizing findings.

**Run verification scripts** only when `-v` is passed, per "Verification Scripts" in `./references/engineering/review.md`.

## Review Focus

**Examine tests first.** Staged test diffs reveal what behavior the change is supposed to produce. Read them before the implementation.

Prioritize:

- **Correctness** — Does the logic do what's intended? Obvious bugs, typos, missing null checks
- **Completeness** — Are related changes staged together? Missing type updates, forgotten test updates
- **Accidental inclusions** — Debug logs, commented-out code, unrelated formatting changes, sensitive data
- **Consistency** — Do changes follow existing patterns in the touched files?

Apply the full review process from `./references/engineering/review.md` — the same lenses apply, scoped to the staged diff.

## Output

**Review findings** (if any) — Issues with severity, file location, recommendation, and impact.

**Cross-check** (only with `-x`) — the probe's `Cross-check:` outcome line per `./references/workflow/agent-fanout.md`, after the findings.

**Reviewed** — a provenance line recording the staged-set digest from Setup, every reviewed path, and the model that produced this review, e.g. `Reviewed staged-diff <digest> (3 files: src/csv.ts, src/csv.test.ts, src/types.ts) by <model>`. Name every path, not a sample — `/commit` diffs its own staged list against this one. It reads the line to confirm the set it would commit is still the set reviewed here, so that check survives the diff itself scrolling out of context. The model is for the human record only — unlike `review-pr`'s line, which `/publish-pr-review` reads to attribute the posted review, nothing downstream consumes it here: the commit carries no AI attribution.

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

Apply the Standard Verification Checklist in `./references/engineering/review.md`. The output carries the **Reviewed** provenance line (staged-set digest + every reviewed path + the reviewing model). With `-x`: the probe was merged per `./references/workflow/agent-fanout.md` and the output carries its `Cross-check:` line.

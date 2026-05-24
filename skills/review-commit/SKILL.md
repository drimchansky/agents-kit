---
name: review-commit
description: Use when asked to review staged changes before committing.
argument-hint: '[--no-checks]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core agents-kit rules applied

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

Review staged changes before committing — correctness, completeness, accidental inclusions, and pattern fit — and draft the commit message.

## Flags

- `--no-checks` — Skip automated checks (lint, typecheck, tests, build, or any other tooling-driven verification). Focus exclusively on code analysis: read the code, reason about it, and produce findings. Do not invoke project scripts or run commands that execute code.

## References

Before working, read `references/workflow/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review.

## Setup

- Get staged diff: `git diff --cached`
- If nothing is staged, inform the user and stop
- Group changes by file and intent

**Run automated checks** (skip if `--no-checks`):

- Run project lint, typecheck, and tests on staged files where they exist
- Treat failures and warnings as findings; record them with file location and severity

## Review Focus

**Examine tests first.** Staged test diffs reveal what behavior the change is supposed to produce. Read them before the implementation.

Prioritize:

- **Correctness** — Does the logic do what's intended? Obvious bugs, typos, missing null checks
- **Completeness** — Are related changes staged together? Missing type updates, forgotten test updates
- **Accidental inclusions** — Debug logs, commented-out code, unrelated formatting changes, sensitive data
- **Consistency** — Do changes follow existing patterns in the touched files?

Apply the full review process from `references/workflow/review.md` — the same lenses apply, scoped to the staged diff.

## Output

**Review findings** (if any) — Issues with severity, file location, recommendation, and impact.

**Commit message** — Generate a commit message for the staged changes:

- First line: imperative mood, max 72 chars, describe _what_ and _why_ (not _how_)
- Body (if needed): additional context for non-obvious changes, separated by blank line
- Follow the project's existing commit message conventions (check `git log --oneline -10` for style)

Example:

```
fix: prevent stale closure in usePolling callback

The interval callback captured the initial state value. Use a ref
to always read the latest value inside the interval.
```

## Verification

- [ ] All usage sites of modified shared code checked
- [ ] Severity ratings reflect user/production impact, not aesthetics
- [ ] No findings on unchanged code or style preferences
- [ ] Bug fixes have regression tests (or the gap is flagged)
- [ ] Dead code identified and listed explicitly
- [ ] Assumptions in non-trivial decisions identified

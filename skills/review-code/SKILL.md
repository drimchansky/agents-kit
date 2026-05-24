---
name: review-code
description: Use when asked to review or give feedback on a PR, diff, or staged changes before commit.
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

Review code for correctness, unintended impact, and adherence to project patterns. Start by determining the review scope.

## Flags

- `--no-checks` — Skip automated checks (lint, typecheck, tests, build, or any other tooling-driven verification). Focus exclusively on code analysis: read the code, reason about it, and produce findings. Do not invoke project scripts or run commands that execute code.

## References

Before working, read `references/engineering/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review mode. Then consult the domain-specific checklists in `references/engineering/` that match the diff (typescript, react, css, security, performance, testing, accessibility, code-style, tanstack-query). Skip ones that don't apply.

## Determine Review Type

Ask the user which type of review they want:

- **PR** — Current branch vs. base branch → `git diff <base>...HEAD`
- **Pre-commit** — Staged changes only → `git diff --cached`

If the user doesn't specify, ask before proceeding — the review process differs by type.

## PR Review

Review all changes in the current branch against the destination branch.

### Setup

**Determine base branch** (if not specified): check common ancestors with `main`, `master`, `develop`, or `release/*`; verify the commit count is reasonable.

**Build change map:**

- Get the full diff against the base branch
- Exclude generated files (lockfiles, build artifacts, snapshots) unless manually edited
- Group changes by intent: new feature, bug fix, refactor, configuration, tests
- For each modified export or shared component — search all usages to understand blast radius
- If the diff exceeds ~1000 non-generated lines and isn't a single logically cohesive change, the first finding is "split this PR" — large diffs hide bugs and exceed reviewer working memory
- If the diff bundles refactoring with feature work or bug fixes, flag "separate the refactor" — mixed-purpose PRs are harder to review, harder to revert, and dilute commit history. Exception: refactors required _to enable_ the feature, which should be called out in the PR description.

**Gather context:**

- Read commit messages for the branch
- Check for an open PR on GitHub for this branch with `gh pr view --json number,title,body,state,url,comments,reviews` (requires `gh` CLI). If the command fails because `gh` is missing or the repo has no GitHub remote, note that and skip the PR lookup.
- If a PR exists:
  - Read the PR title, description, and any review comments / discussion threads — these often contain the _why_ behind the change and prior reviewer concerns
  - Extract every URL from the PR body and comments (issue trackers, design docs, Slack threads, RFCs, related PRs, dashboards)
  - For each link, attempt to fetch its content (WebFetch for public URLs, `gh issue view` / `gh pr view` for GitHub references). Use the retrieved context to inform the review
  - If a link can't be accessed (auth-walled, private workspace, 404, tool unavailable), record it in the output under **Inaccessible context** with the URL and reason. Do not fabricate what's behind it — flag the gap so the user can decide whether to paste the content in or proceed without it
- If no PR exists, proceed with just the branch commits and any context the user provided

**Run automated checks** (skip if `--no-checks`):

- Run project lint, typecheck, and tests on changed files where they exist
- Treat failures and warnings as findings; record them with file location and severity

### Review Focus

**Examine tests first.** Test diffs reveal intent and expected behavior. Read them before the implementation so you evaluate the code against what it's supposed to do, not what it appears to do.

Apply the full review process from `references/engineering/review.md` — its "What to Look For", "What NOT to Flag", "Calibrate Severity", "Approval Bar", "Prioritize Review Effort", and "Don't Rationalize" sections all apply to PR diffs.

### Output

- **Summary** — What changed, intent, overall assessment (approve / request changes / needs discussion)
- **Findings** — Issues with severity, file location, recommendation, and impact
- **Improvements** (optional) — Non-blocking suggestions
- **Inaccessible context** (only if any) — Links from the PR that couldn't be fetched, with URL and reason (auth required, private, 404, tool unavailable). Note which findings might shift if that context were available.

---

## Pre-commit Review

Review staged changes before committing.

### Setup

- Get staged diff: `git diff --cached`
- If nothing is staged, inform the user and stop
- Group changes by file and intent

**Run automated checks** (skip if `--no-checks`):

- Run project lint, typecheck, and tests on staged files where they exist
- Treat failures and warnings as findings; record them with file location and severity

### Review Focus

**Examine tests first.** Staged test diffs reveal what behavior the change is supposed to produce. Read them before the implementation.

Prioritize:

- **Correctness** — Does the logic do what's intended? Obvious bugs, typos, missing null checks
- **Completeness** — Are related changes staged together? Missing type updates, forgotten test updates
- **Accidental inclusions** — Debug logs, commented-out code, unrelated formatting changes, sensitive data
- **Consistency** — Do changes follow existing patterns in the touched files?

Apply the full review process from `references/engineering/review.md` — same lenses as PR, scoped to staged changes.

### Output

**Review findings** (if any) — Same format as PR.

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

---

## Verification

- [ ] All usage sites of modified shared code checked
- [ ] Severity ratings reflect user/production impact, not aesthetics
- [ ] No findings on unchanged code or style preferences
- [ ] Bug fixes have regression tests (or the gap is flagged)
- [ ] Dead code identified and listed explicitly
- [ ] Assumptions in non-trivial decisions identified

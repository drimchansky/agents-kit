---
name: review-code
description: Use when asked to review, audit, or give feedback on a PR, diff, module, or whole project.
argument-hint: '[scope or file path] [--no-checks]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line as a visible confirmation, **before** any other text or tool calls in this skill, on its own line — substitute `<version>` with the value on the **Version** line at the top of `./AGENTS.md`:

    ✅ Core agents-kit@<version> rules applied

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

# Review Code

Review code for correctness, unintended impact, and adherence to project patterns. Start by determining the review scope.

## Flags

- `--no-checks` — Skip automated checks (lint, typecheck, tests, build, or any other tooling-driven verification). Focus exclusively on code analysis: read the code, reason about it, and produce findings. Do not invoke project scripts or run commands that execute code. Applies only to the Pre-PR and Pre-commit workflows, which have a "Run automated checks" step; Module and Project reviews don't run checks regardless.

## References

Before working, read `references/engineering/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review mode. Then consult the domain-specific checklists in `references/engineering/` that match the diff (typescript, react, css, security, performance, testing, accessibility, code-style, tanstack-query). Skip ones that don't apply.

## 1. Determine Review Type

Ask the user which type of review they want:

- **Pre-PR** — Current branch vs. base branch → `git diff <base>...HEAD`
- **Pre-commit** — Staged changes only → `git diff --cached`
- **Module** — All code in a specific module or directory → full file reads, no diff
- **Project** — Overall project structure and patterns → full codebase exploration

If the user doesn't specify, ask before proceeding — the review process differs significantly by type.

## Pre-PR Review

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

- Read commit messages and PR description if available

**Run automated checks** (skip if `--no-checks`):

- Run project lint, typecheck, and tests on changed files where they exist
- Treat failures and warnings as findings; record them with file location and severity

### Review Focus

**Examine tests first.** Test diffs reveal intent and expected behavior. Read them before the implementation so you evaluate the code against what it's supposed to do, not what it appears to do.

Apply the full review process from `references/engineering/review.md` — its "What to Look For", "What NOT to Flag", "Calibrate Severity", "Approval Bar", "Prioritize Review Effort", and "Don't Rationalize" sections all apply to Pre-PR diffs.

### Output

- **Summary** — What changed, intent, overall assessment (approve / request changes / needs discussion)
- **Findings** — Issues with severity, file location, recommendation, and impact
- **Improvements** (optional) — Non-blocking suggestions

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

Apply the full review process from `references/engineering/review.md` — same lenses as Pre-PR, scoped to staged changes.

### Output

**Review findings** (if any) — Same format as Pre-PR.

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

## Module Review

Review all code in a specific module, directory, or feature area — not just recent changes.

### Setup

- Ask the user which module or directory to review (if not specified)
- Read all source files in the module
- Identify the module's public API (exports, interfaces, props)
- Map dependencies: what does this module depend on, and what depends on it?

### Review Focus

- **Structure** — Is the module well-organized? Clear responsibilities? Appropriate file boundaries?
- **Public API** — Is the interface clean, consistent, and minimal? Are types precise?
- **Internal quality** — Dead code, unnecessary complexity, duplicated logic within the module
- **Patterns** — Does the module follow the same patterns as similar modules in the project?
- **Test coverage** — Are critical paths tested? Are tests testing behavior or implementation details?
- **Dependencies** — Are there circular dependencies, over-coupling, or unnecessary imports?

Skip line-by-line nitpicks. Focus on structural findings that affect maintainability.

### Output

- **Module overview** — Purpose, public API surface, dependency map
- **Findings** — Structural issues with severity and recommendations
- **Health assessment** — Overall module quality: well-structured / needs attention / needs refactoring

---

## Project Review

High-level review of overall project structure, patterns, and health. No diff — this is a holistic assessment.

### Setup

- Read project configuration (package.json, tsconfig, etc.)
- Explore the directory structure
- Sample 3-5 representative modules to assess pattern consistency
- Check test setup and coverage patterns
- Review dependency list for outdated, heavy, or redundant packages

### Review Focus

- **Architecture** — Is the project organized logically? Are responsibilities clear between layers/directories?
- **Pattern consistency** — Do similar features follow similar patterns, or has the codebase diverged over time?
- **Dependency health** — Outdated packages, heavy bundles, redundant libraries doing the same thing
- **Test strategy** — Is there a coherent testing approach? Unit vs integration vs e2e balance?
- **Developer experience** — Are there sharp edges? Missing types, confusing naming, undocumented conventions?
- **Scaling concerns** — What will hurt as the project grows? Tight coupling, monolithic files, missing abstractions?

### Output

- **Project overview** — Tech stack, structure, key patterns
- **Strengths** — What's working well
- **Concerns** — Issues ranked by impact, with actionable recommendations
- **Recommendations** — Prioritized list of improvements (quick wins vs. larger efforts)

---

## Verification

- [ ] All usage sites of modified shared code checked
- [ ] Severity ratings reflect user/production impact, not aesthetics
- [ ] No findings on unchanged code or style preferences
- [ ] Bug fixes have regression tests (or the gap is flagged)
- [ ] Dead code identified and listed explicitly
- [ ] Assumptions in non-trivial decisions identified

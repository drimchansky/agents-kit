---
name: code-review
description: Review code for correctness, impact, and adherence to project patterns
disable-model-invocation: true
---

# Code Review

Review code for correctness, unintended impact, and adherence to project patterns. Start by determining the review scope.

## 1. Determine Review Type

Ask the user which type of review they want:

| Type | Scope | Diff Source |
|---|---|---|
| **Pre-PR** | Current branch vs. base branch | `git diff <base>...HEAD` |
| **Pre-commit** | Staged changes only | `git diff --cached` |
| **Module** | All code in a specific module or directory | Full file reads, no diff |
| **Project** | Overall project structure and patterns | Full codebase exploration |

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

**Gather context:**

- Read commit messages and PR description if available
- Understand the original intent and scope

### Review Focus

Apply the full review process: [What to Look For](#what-to-look-for), [What NOT to Flag](#what-not-to-flag), [Severity Calibration](#calibrate-severity).

### Output

- **Summary** — What changed, intent, overall assessment (approve / request changes / needs discussion)
- **Findings** — Issues with severity, file location, recommendation, and impact
- **Improvements** (optional) — Non-blocking suggestions

---

## Pre-commit Review

Review staged changes before committing. Lighter touch than Pre-PR — focus on catching mistakes early.

### Setup

- Get staged diff: `git diff --cached`
- If nothing is staged, inform the user and stop
- Group changes by file and intent

### Review Focus

Prioritize:

- **Correctness** — Does the logic do what's intended? Obvious bugs, typos, missing null checks
- **Completeness** — Are related changes staged together? Missing type updates, forgotten test updates
- **Accidental inclusions** — Debug logs, commented-out code, unrelated formatting changes, sensitive data
- **Consistency** — Do changes follow existing patterns in the touched files?

Skip deep impact analysis — that's for Pre-PR. Don't flag architectural concerns for staged changes.

### Output

**Review findings** (if any) — Same format as Pre-PR but expect fewer and lighter findings.

**Commit message** — Generate a commit message for the staged changes:

- First line: imperative mood, max 72 chars, describe *what* and *why* (not *how*)
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

## What to Look For

Applies to all review types. Focus on what general rules don't cover:

### Completeness

- Is the feature/fix fully implemented, or are there gaps in the intent?
- Are all related files updated — types, tests, error handling, documentation?
- Are there partially implemented paths (TODO comments, placeholder logic, empty catch blocks)?

### Impact on Existing Code

The highest-value part of a review. For every change to shared code:

- **Search all usage sites** — Don't just review the diff; grep for every modified export and verify callers still work
- **Check behavioral changes** — A renamed prop, a changed default, a new required field can break distant consumers silently
- **Trace data flow changes** — If data shape changes, follow it through the pipeline to the UI
- **Verify API contracts** — Breaking changes to interfaces or public APIs must be caught

### Correctness

- Does the logic actually do what the commit message claims?
- Are there off-by-one errors, missing null checks, unhandled async failures?
- Are race conditions possible (concurrent state updates, unsynchronized async)?
- Are edge cases handled (empty arrays, zero values, undefined, long strings)?

## What NOT to Flag

- **Style preferences** that don't violate project conventions — if it's valid and consistent, leave it
- **Equally valid alternatives** — "I would have done it differently" is not a review finding
- **Issues in unchanged code** — unless the diff directly affects them
- **Nitpicks on code being deleted or moved** — don't review dead code
- **Hypothetical future problems** — flag only if the current change creates a concrete risk

## Calibrate Severity

Severity reflects **user and production impact**, not code aesthetics:

- 🔴 **Critical** — Breaks functionality, causes data loss, security vulnerability, accessibility barrier that blocks users. Must fix before merge.
- 🟡 **Major** — Causes problems over time: missing tests for complex logic, performance regressions, incorrect types that hide bugs, shared code changes without verifying consumers. Should fix before merge.
- 🟢 **Minor** — Could be better: simplification opportunities, minor duplication, non-blocking naming suggestions. Fix if convenient.

## Prioritize Review Effort

Not all changes deserve equal attention:

| Priority | What | Why |
|---|---|---|
| **High** | New logic, state changes, data flow | Where bugs live |
| **High** | Changes to shared code (components, utils, types) | Widest blast radius |
| **High** | Security-relevant code (auth, input handling, API) | Highest stakes |
| **Medium** | New files and new abstractions | Design decisions that compound |
| **Medium** | Test changes | Verify they test real behavior |
| **Low** | Renames, formatting, import reordering | Unlikely to introduce bugs |
| **Low** | Config and boilerplate changes | Skim for obvious errors |

For large diffs (20+ files): review types and interfaces first to understand the contract, then group remaining files by feature/concern rather than reviewing file-by-file.

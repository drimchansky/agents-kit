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
3. Output the following line verbatim to the user as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core rules applied (./AGENTS.md)

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

# Review Code

Review code for correctness, unintended impact, and adherence to project patterns. Start by determining the review scope.

## Flags

- `--no-checks` — Skip automated checks (lint, typecheck, tests, build, or any other tooling-driven verification). Focus exclusively on code analysis: read the code, reason about it, and produce findings. Do not invoke project scripts or run commands that execute code. Applies only to the Pre-PR and Pre-commit workflows, which have a "Run automated checks" step; Module and Project reviews don't run checks regardless.

## References

Before working, read any applicable checklists from `references/engineering/`. Skip ones that don't apply.

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

Apply the full review process: the "What to Look For", "What NOT to Flag", and "Calibrate Severity" sections below.

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

Apply the full review process: the "What to Look For", "What NOT to Flag", and "Calibrate Severity" sections below.

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

## What to Look For

Applies to all review types. Consult relevant reference checklists based on file types touched (`references/engineering/typescript.md`, `references/engineering/react.md`, `references/engineering/css.md`, `references/engineering/testing.md`, etc.) and review concerns (`references/engineering/security.md`, `references/engineering/performance.md`).

Focus on what reference checklists don't cover:

### Impact on Existing Code

The highest-value part of a review. For every change to shared code:

- **Search all usage sites** — Don't just review the diff; grep for every modified export and verify callers still work
- **Check behavioral changes** — A renamed prop, a changed default, a new required field can break distant consumers silently
- **Trace data flow changes** — If data shape changes, follow it through the pipeline to the UI
- **Verify API contracts** — Breaking changes to interfaces or public APIs must be caught

### Problem Verification

- Understand the problem before evaluating the solution — does the fix address the root cause, or just the symptom?
- For bug fixes: is there now a test that would have caught this regression?
- Search for the same pattern elsewhere in the codebase — a fix in one place often applies to siblings

### Abstraction Justification

- **Premature extraction** — Under ~20 lines rarely needs its own module. Inline until a second or third consumer proves the abstraction.
- **Wrapper types** — Custom type aliases that re-wrap a library's types without adding information obscure the original API.
- **One-use helpers** — Functions extracted for "reusability" but called from exactly one place fragment logic without reducing complexity.

### Complexity Signals

Concrete patterns to scan for. Flag as Minor by default; promote to Major if the pattern hides a bug (e.g., deep nesting masking a missing edge-case branch).

- **Deep nesting** (3+ levels of `if`/`for`/`try`) — refactor candidate via guard clauses or extracted helpers
- **Long functions** (~50+ lines, or one function with multiple distinct responsibilities) — split-into-named-pieces candidate
- **Nested ternaries** — replace with if/else, switch, or a lookup map
- **Boolean parameter flags** (`doThing(true, false)`) — prefer an options object or separate functions; positional booleans are unreadable at the call site
- **Generic names** (`data`, `result`, `temp`, `val`, `item`) or **abbreviated names** (`usr`, `cfg`, `btn`, `evt`) — rename to describe the content; allow universal abbreviations (`id`, `url`, `api`)
- **Repeated conditionals** — the same predicate in multiple places — extract to a named function

For style-level findings (3-param function limit, single responsibility, "why" comments), defer to `references/engineering/code-style.md` instead of duplicating here.

### Interface Design

- Prefer `children`, render props, or slot patterns over configuration props (`buttonProps`, `mode` flags). Boolean/mode props often signal a component doing too many things.
- Can the interface be smaller? Each prop is a contract that must be maintained.

### Dead Code

Apply Chesterton's Fence: before recommending removal, understand why the code exists. Check `git blame`, read callers, look for non-obvious reasons (performance, platform constraint, historical bug fix). If you can't explain why it's there, flag it as a question, not a removal recommendation.

- Identify dead code explicitly: unused exports, unreachable branches, commented-out blocks
- List what you found and ask before removing it — don't delete silently
- Confirm it's truly unused (grep for all references) before recommending removal

### Multi-Model Review

When reviewing AI-generated code (or your own output from an earlier step):

- Apply the same standards as human-written code — AI output is not exempt from review
- Watch for AI-specific patterns: overly verbose error handling, unnecessary abstractions, hallucinated APIs, inconsistent naming

### Assumptions Audit

For non-trivial decisions, ask: **what does this assume that could change?**

- Assumes a specific API response shape, field presence, or ordering
- Assumes a component is rendered exactly once, or in a specific context
- Assumes a domain constant is stable — if it's not, it should be a config value, not an inline literal
- If an assumption is load-bearing, it should be enforced by types or validated at runtime

### State Persistence

- **URL search params** — For state that should be shareable, bookmarkable, or deep-linkable
- **Ephemeral state** — For transient UI concerns (modals, hover, animation). No persistence needed.
- **localStorage** — Only for user preferences that should survive sessions and don't need to be shareable.
- **Avoid multi-store sync** — The same conceptual state should live in one place.

### Design Spec Alignment

If the change is UI-facing, verify against design specs (Figma, mockups). Flag discrepancies between implementation and design intent.

### Cross-Project Consistency

If sibling or related projects exist:

- **Naming divergence** — Different names for equivalent concepts across projects. Align when the concept is the same.
- **Reinvented utilities** — Existing shared utilities that could be reused instead of reimplemented.
- **Pattern drift** — Established conventions in older projects that should carry forward.

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

When suggesting findings the user will paste as inline PR comments, prefix the comment text instead of using the emoji: `Critical:` (🔴, blocks merge), `Major:` (🟡, should fix before merge), `Nit:` / `Optional:` (🟢, non-blocking), `FYI:` (informational, no action requested).

## Approval Bar

Approve when the change **definitely improves overall code health**, even if it isn't perfect. The bar is improvement over the current state, not perfection — chasing perfect blocks shippable improvements. Block merge only when Critical findings remain. Major findings should be fixed before merge but don't get rubber-stamped as "fix in follow-up." Minor findings approve-with-comment.

## Prioritize Review Effort

Not all changes deserve equal attention:

- **High** — New logic, state changes, data flow (where bugs live)
- **High** — Changes to shared code: components, utils, types (widest blast radius)
- **High** — Security-relevant code: auth, input handling, API (highest stakes)
- **Medium** — New files and new abstractions (design decisions that compound)
- **Medium** — Test changes (verify they test real behavior)
- **Low** — Renames, formatting, import reordering (unlikely to introduce bugs)
- **Low** — Config and boilerplate changes (skim for obvious errors)

For large diffs (20+ files): review types and interfaces first to understand the contract, then group remaining files by feature/concern rather than reviewing file-by-file.

## Don't Rationalize

- "The code looks fine to me" — Trace all usage sites for changed shared code. "Looks fine" isn't a review.
- "I would have done it differently" — Preference isn't a finding. Different isn't wrong.
- "It's just a small change" — Small changes to shared code have the widest blast radius. Check consumers.
- "The tests pass" — Passing tests prove the tests pass, not that the code is correct. Tests have gaps.
- "I'll flag it next time" — Note it now. Use severity levels to indicate urgency.
- "Fix it in a follow-up PR" — Deferred fixes don't get fixed. Block on it now or accept it forever; don't pretend a Critical finding is a follow-up.
- "It's mostly good, just approve" — Rubber-stamping is not review. If you didn't trace the shared-code consumers, you didn't review them.
- "This code is obviously dead/redundant" — Chesterton's Fence: check `git blame` and callers before recommending removal or simplification. Accumulated complexity often has a real reason; if you can't explain why it's there, ask, don't remove.

## Verification

- [ ] All usage sites of modified shared code checked
- [ ] Severity ratings reflect user/production impact, not aesthetics
- [ ] No findings on unchanged code or style preferences
- [ ] Bug fixes have regression tests (or the gap is flagged)
- [ ] Dead code identified and listed explicitly
- [ ] Assumptions in non-trivial decisions identified

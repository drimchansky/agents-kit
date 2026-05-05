# Code Review

Lenses, calibration, and discipline that apply to **any** code review through `/review-code`. Mode-specific orchestration (Pre-PR / Pre-commit / Module / Project) lives in `skills/review-code/SKILL.md`; this file is mode-agnostic.

Other reference checklists cover specific surfaces: `accessibility.md`, `code-style.md`, `css.md`, `performance.md`, `react.md`, `security.md`, `tanstack-query.md`, `testing.md`, `typescript.md`. Consult those when the diff touches those domains. This file covers what those checklists don't.

## What to Look For

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

For style-level findings (3-param function limit, single responsibility, "why" comments), defer to `code-style.md` instead of duplicating here.

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

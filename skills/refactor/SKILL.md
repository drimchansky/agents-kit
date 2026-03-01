---
name: refactor
description: Plan and execute a refactor — assess code against production-readiness, define scope, and improve incrementally. Use when asked to refactor, clean up, improve, harden, or make code production-ready.
---

This skill guides planning and execution of code improvements toward production quality. Beyond restructuring, this includes fixing error handling gaps, tightening types, handling edge cases, and eliminating tech debt. The output is a refactoring plan — and optionally the execution — that makes code robust, clear, and ready to ship.

The user identifies code to improve. They may specify what bothers them (duplication, fragile error handling, loose types, complexity) or ask for a general improvement.

## Workflow Context

This skill complements — not replaces — the built-in Plan mode in Claude Code:

- **Built-in Plan mode** — Lightweight, conversational. Quick alignment on what to refactor and why.
- **This skill** — Structured assessment. Gap analysis, sequenced steps, scope boundaries, and risk flags documented.

Typical flow: **Plan mode** (align on goals) → **refactor skill** (structured analysis and execution) → **code-review skill** (verify the result).

For small, obvious cleanups, skip straight to execution.

## When to Plan (and When Not To)

**Plan when:**

- Refactor spans multiple files or modules
- Code has intertwined concerns that need careful sequencing
- Changes affect shared code with wide blast radius
- Untested code needs risk assessment before touching
- The user asks for a general "make this production-ready" without specifics

**Skip planning when:**

- Single-file rename, extract, or simplify
- The fix is obvious and localized
- The user has already specified the exact changes
- The cleanup is smaller than the plan would be

If the task doesn't warrant a full plan, say so and proceed directly.

## What Production-Ready Means

- **Correct** — Edge cases handled, errors don't swallow silently, async failures have paths
- **Typed precisely** — No `any`, no unnecessary assertions, discriminated unions where appropriate
- **Robust** — Null checks where data is uncertain, validation at boundaries, graceful degradation
- **Clear** — Intent is obvious, naming is accurate, complexity is justified
- **Maintainable** — Single responsibility, no dead code, no premature abstraction

## Planning Process

### 1. Understand the Code

**CRITICAL**: Read the code and its tests thoroughly before planning. You need to know what the code does, not just what it looks like.

- Read the target code and all its callers
- Map the public API — what do consumers depend on?
- Read existing tests to understand expected behavior
- Identify what's actually wrong vs. what's just unfamiliar

### 2. Assess the Gaps

Evaluate the code against production-readiness:

- **Error handling** — Are failures caught and handled, or silently ignored? Empty catch blocks, missing `.catch()`, unhandled promise rejections
- **Type safety** — Are there `any` types, unsafe assertions (`as`), or loose function signatures?
- **Edge cases** — What happens with empty inputs, null values, zero-length arrays, concurrent calls?
- **Dead code** — Unreachable branches, unused exports, commented-out blocks
- **Structure** — Duplication, unclear responsibilities, unnecessary indirection

### 3. Define Scope

Explicitly state:

- **In scope** — What will be changed and why
- **Out of scope** — What will NOT be changed, even if related
- **Boundaries** — Where this refactor ends and future work begins

Scope definition prevents creep. A refactor without boundaries becomes a rewrite.

### 4. Assess Safety Net

- Check if tests cover the code being refactored — if not, flag the gap
- Identify the fastest feedback loop: type checker, linter, test suite
- For untested code: consider adding characterization tests first, or flag the risk explicitly

### 5. Break Down Steps

Create an ordered list of changes. Each step should compile and pass tests on its own. Order by risk — types and hardening first, then structural changes:

1. **Tighten types** — Replace `any`, add missing return types, narrow unions
2. **Fix error handling** — Add missing catch paths, replace empty catches, handle edge cases
3. **Simplify structure** — Rename for clarity, extract or inline, reduce nesting, remove dead code
4. **Reorganize** — Move code to better locations, update imports, consolidate duplicates
5. **Clean up** — Final consistency pass, verify nothing was missed

### 6. Identify Risks

Only flag risks that are **specific to this refactor** — not generic checklists.

For each real risk:

- What could go wrong (concrete scenario)
- How likely it is given what you found in exploration
- How to mitigate before it becomes a problem

## Execution

When executing (either after plan approval or for small refactors that skip planning):

- Change one concern at a time — don't combine a type fix with a logic change
- Run type checking after each step, not just at the end
- If a step breaks something unexpected, stop and understand why before continuing
- Keep the public API stable unless the user explicitly asked to change it

### Validate

- [ ] All identified gaps are addressed or explicitly flagged as out of scope
- [ ] Error paths are handled — no silent failures
- [ ] Types are precise — no `any`, no unnecessary `as` assertions
- [ ] Public API is preserved (or changes were explicitly requested and all callers updated)
- [ ] Type checking and linting pass with zero errors
- [ ] Code is simpler and more robust, not just different

## Common Mistakes

- **Refactoring without understanding** — Moving code around without knowing what it does. Read first.
- **Premature abstraction** — Extracting a helper for two instances. Wait for three.
- **Big-bang refactors** — Rewriting an entire module in one step. If you can't verify incrementally, the steps are too large.
- **Refactoring untested code without flagging it** — If there are no tests, say so. The user should know the risk.
- **Gold-plating** — Adding defensive code for scenarios that can't happen. Be robust where data is uncertain, not everywhere.

## Output Structure

Adapt to task size — not every refactor needs every section:

- **Assessment** — What's wrong and why, gaps found
- **Scope** — In scope / out of scope
- **Steps** — Ordered transformation steps with risk flags
- **Risks** — Specific risks with mitigation strategies
- **Changes** (after execution) — What was changed and why
- **Verification** — How correctness was confirmed

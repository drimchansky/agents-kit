---
name: _testing
description: Test strategy, structure, and patterns for writing effective tests. Apply when writing or reviewing tests.
---

# Testing

## What to Test

- Test **behavior**, not implementation — assert what the code does, not how it does it
- Focus on public API surfaces: inputs, outputs, side effects, error cases
- Cover the happy path, then edge cases that have real failure risk (empty inputs, boundaries, nulls, concurrent calls)
- Skip trivial tests that just restate the implementation (e.g., testing that a getter returns a field)
- If a bug was fixed, add a test that would have caught it

## Structure

- One concept per test — if a test name needs "and", split it
- Name tests by behavior: "rejects expired tokens" not "test token validation case 3"
- Follow Arrange → Act → Assert; keep each section short and obvious
- Colocate test files with source when the project convention supports it
- Match the project's existing test structure before inventing a new one

## Isolation

- Test units in isolation by default; use integration tests for cross-boundary behavior
- Mock external dependencies (network, filesystem, time, randomness) — not internal modules
- Prefer dependency injection over mocking internals; if you need to mock 5 things, the unit is too coupled
- Reset shared state between tests — no test should depend on another's execution order

## Assertions

- Assert on the **specific thing being tested**, not the entire output shape
- Use the most precise assertion available (`toEqual` vs. `toBeTruthy`, `toHaveBeenCalledWith` vs. `toHaveBeenCalled`)
- One logical assertion per test — multiple `expect` calls are fine if they verify the same behavior
- Avoid snapshot tests for logic — use them only for stable serialized output (markup, config) where diffs are reviewable

## Async

- Always `await` async operations — don't rely on implicit timing
- Test both resolution and rejection paths for async code
- Use fake timers for time-dependent tests instead of real delays

## Common Mistakes

- **Testing implementation details** — Asserting on internal state, private methods, or call order of internal functions. Refactors break these tests without any behavior change.
- **Overmocking** — Replacing so much that the test doesn't exercise real code. If the test can't fail when the implementation is wrong, it's useless.
- **Copy-paste test suites** — Duplicated setup across dozens of tests. Extract shared setup into `beforeEach` or helper functions, but keep assertions inline.
- **Missing error paths** — Only testing success cases. Errors, timeouts, and invalid inputs are where bugs hide.

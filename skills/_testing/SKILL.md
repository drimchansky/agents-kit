---
name: _testing
description: Test strategy, structure, and patterns for writing effective tests. Apply when writing or reviewing tests.
---

# Testing

## Strategy

- Test behavior and public API surfaces, not implementation details
- Skip trivial tests that just restate the implementation (e.g., testing that a getter returns a field)
- If a bug was fixed, add a test that would have caught it
- Match the project's existing test structure before inventing a new one

## Isolation

- Mock external dependencies (network, filesystem, time, randomness) — not internal modules
- If you need to mock 5+ things, the unit is too coupled
- Avoid snapshot tests for logic — use them only for stable serialized output where diffs are reviewable

## Common Mistakes

- **Testing implementation details** — Asserting on internal state, private methods, or call order of internal functions. Refactors break these tests without any behavior change.
- **Overmocking** — Replacing so much that the test doesn't exercise real code. If the test can't fail when the implementation is wrong, it's useless.
- **Copy-paste test suites** — Duplicated setup across dozens of tests. Extract shared setup into `beforeEach` or helper functions, but keep assertions inline.
- **Missing error paths** — Only testing success cases. Errors, timeouts, and invalid inputs are where bugs hide.

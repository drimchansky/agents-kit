# Testing

## Strategy

- [ ] Test behavior and public API surfaces, not implementation details
- [ ] Skip trivial tests that restate the implementation
- [ ] Add a test for every fixed bug
- [ ] Match the project's existing test structure

## Isolation

- [ ] Mock external dependencies (network, filesystem, time) — not internal modules
- [ ] If mocking 5+ things, the unit is too coupled
- [ ] Snapshot tests only for stable serialized output

## Structure

- [ ] Arrange-Act-Assert pattern
- [ ] Descriptive test names that state the behavior being verified
- [ ] Shared setup in `beforeEach` or helpers; assertions inline
- [ ] Error paths tested, not just happy paths

## Common Mistakes

- Testing implementation details (internal state, call order) — refactors break these without behavior change
- Overmocking — if the test can't fail when implementation is wrong, it's useless
- Copy-paste test suites — extract shared setup, keep assertions inline
- Missing error paths — errors, timeouts, and invalid inputs are where bugs hide

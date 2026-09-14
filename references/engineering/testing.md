# Testing

## Strategy

- [ ] Test behavior/public APIs; skip trivial restatements; guard every bug fix; match project structure.

## Isolation

- [ ] Mock external dependencies, excluding internal modules; 5+ mocks signals coupling. Snapshot only stable serialization.

## Structure

- [ ] Arrange-Act-Assert; behavioral names; shared beforeEach/helpers, inline assertions; cover success/errors/timeouts/invalid inputs.
- [ ] Encode contracts/examples in cases/assertions/fixtures; comments follow `code-style.md` → Comments; API docs stay on code.

## Common Mistakes

- [ ] Wrong behavior fails tests; no internal-state/call-order assertions, overmocking, or copied setup.

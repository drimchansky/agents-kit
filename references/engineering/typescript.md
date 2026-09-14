# TypeScript

## Naming

- Constants: SCREAMING_SNAKE_CASE. Extract magic numbers into named constants.
- Booleans: is/has/should/can; handlers: handle; props: on; API JSDoc: exports only.

## Types

- [ ] Narrow unknown; no any/assertions; as const for literals; infer obvious types.
- [ ] Unions for known sets; readonly for immutable data; interfaces for extendable shapes, types for unions/intersections/mappings; specific domain-ID aliases.

## Discriminated Unions

- [ ] Switch/if on literal discriminants; no !/as/destructuring workarounds; exhaustiveness through default: never/assertNever.

## Patterns

- [ ] Satisfies preserves inference; prefer control-flow narrowing over predicates and utility types over repeated fields.
- [ ] Type boundaries, infer internals; generics preserve caller information; parameters match accepted inputs.

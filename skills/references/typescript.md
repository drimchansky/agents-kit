# TypeScript

## Naming

- Constants: `SCREAMING_SNAKE_CASE`; extract magic numbers to named constants
- Booleans: `is`, `has`, `should`, `can` prefixes
- Event handlers: `handle` prefix for handlers, `on` prefix for props
- JSDoc for public APIs and complex functions

## Types

- [ ] No `any` — use `unknown` and narrow instead
- [ ] Prefer type inference where types are obvious
- [ ] Union types and discriminated unions for known value sets
- [ ] `readonly` for data that shouldn't be mutated
- [ ] No type assertions (`as`) — use type guards
- [ ] `as const` for literal values
- [ ] `interface` for extendable shapes; `type` for unions, intersections, mapped types
- [ ] Domain identifiers use specific type aliases, not raw `string`

## Discriminated Unions

- [ ] Narrow on the discriminant property using `switch`/`case` or `if`
- [ ] No `!`, `as`, or destructuring as narrowing workarounds
- [ ] Discriminant is a literal type
- [ ] Exhaustiveness via `default: never` or `assertNever`

## Patterns

- [ ] `satisfies` for validation while preserving narrower inferred type
- [ ] Control flow narrowing (`if`, `in`, `instanceof`) over manual type predicates
- [ ] Utility types (`Pick`, `Omit`, `Partial`, `Required`) over redeclaring fields
- [ ] Explicit types at function boundaries; inferred internals
- [ ] Generics to preserve caller-side type information
- [ ] Declared parameter type matches what the function actually accepts

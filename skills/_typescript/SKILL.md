---
name: _typescript
description: TypeScript type safety, precise types, utility types, and idiomatic patterns. Apply when writing or reviewing TypeScript code.
---

# TypeScript

## Types

- Define precise types; avoid `any` — use `unknown` and narrow instead
- Prefer type inference where types are obvious
- Use union types and discriminated unions for known value sets
- Use `readonly` for data that shouldn't be mutated
- Avoid type assertions (`as`); prefer type guards
- Use `as const` for literal values that shouldn't widen
- Prefer `interface` for object shapes that may be extended; use `type` for unions, intersections, and mapped types

## Patterns

- Use `satisfies` to validate a value matches a type while preserving its narrower inferred type
- Narrow with control flow (`if`, `in`, `instanceof`) instead of manual type predicates when possible
- Use utility types (`Pick`, `Omit`, `Partial`, `Required`) to derive types instead of redeclaring fields
- Type function boundaries explicitly (parameters and return types); let internals be inferred
- Use generics to preserve caller-side type information; avoid forcing callers to assert

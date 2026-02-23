---
name: _typescript
description: TypeScript type safety, naming conventions, and idiomatic patterns. Apply when writing or reviewing TypeScript code.
---

# TypeScript

## Naming Conventions

- **Variables/Functions**: camelCase (`fetchUser`, `isValid`)
- **Classes/Components/Types**: PascalCase (`UserProfile`, `SearchInput`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRY_COUNT`, `API_BASE_URL`)
- **Files**: Match the primary export
- **Booleans**: Use `is`, `has`, `should`, `can` prefixes (`isLoading`, `hasError`)
- **Event handlers**: `handle` prefix for handlers, `on` prefix for props
- Use JSDoc for public APIs and complex functions

## Types

- Define precise types; avoid `any` — use `unknown` and narrow instead
- Prefer type inference where types are obvious
- Use union types and discriminated unions for known value sets
- Use `readonly` for data that shouldn't be mutated
- Avoid type assertions (`as`); prefer type guards
- Use `as const` for literal values that shouldn't widen
- Prefer `interface` for object shapes that may be extended; use `type` for unions, intersections, and mapped types

## Discriminated Unions

- Narrow on the **discriminant property** using `switch`/`case` or `if` checks — this is the only reliable narrowing approach
- Do **not** use non-null assertions (`!`), `as` casts, or destructuring as workarounds for type narrowing — they mask real type issues
- Do not attempt `typeof`, `in`, or other indirect checks when a discriminant property exists — they don't narrow correctly in TS
- When defining discriminated unions, ensure the discriminant is a literal type (string, number, or boolean literal)
- For exhaustiveness, use a `default: never` case or a helper function like `assertNever`

## Patterns

- Use `satisfies` to validate a value matches a type while preserving its narrower inferred type
- Narrow with control flow (`if`, `in`, `instanceof`) instead of manual type predicates when possible
- Use utility types (`Pick`, `Omit`, `Partial`, `Required`) to derive types instead of redeclaring fields
- Type function boundaries explicitly (parameters and return types); let internals be inferred
- Use generics to preserve caller-side type information; avoid forcing callers to assert

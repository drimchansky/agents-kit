---
name: typescript
description: TypeScript type safety rules — precise types, inference, type guards. Use when asked to write or review TypeScript code.
---

# TypeScript

- Define precise types; avoid `any` — use `unknown` and narrow instead
- Prefer type inference where types are obvious
- Use union types and discriminated unions for known value sets
- Use `readonly` for data that shouldn't be mutated
- Avoid type assertions (`as`); prefer type guards

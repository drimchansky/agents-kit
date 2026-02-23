---
name: _code-style
description: Function design and comment guidelines for code style consistency. Apply when writing or reviewing code.
---

# Code Style

## Functions

- Single responsibility — do one thing well
- Limit parameters to 3; use an options object for more
- Prefer pure functions; isolate side effects
- Use early returns to reduce nesting

## Change Scope

- Prefer changes at **call sites** over modifying shared utilities — unless the utility itself is the problem
- When refactoring, scope changes to what was requested — don't pull in adjacent improvements or "while I'm here" cleanups

## Comments

- Explain "why", not "what" — the code shows what, comments explain intent
- Delete commented-out code; version control exists

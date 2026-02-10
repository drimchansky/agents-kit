---
name: implement
description: Build, implement, create, or add a feature — write code following project patterns with analysis and validation
disable-model-invocation: true
---

# Implement

Execute the requested changes by following the project's established patterns and conventions. Before writing code, understand the current system and make deliberate decisions. If context is missing or the request is ambiguous, ask for clarification rather than guessing.

If a design plan was created earlier in this conversation, use it as your starting point — don't re-analyze from scratch.

## 1. Analyze Before Coding

### Understand the Request

- Identify what the user _actually_ wants, not just what they literally asked for
- Clarify ambiguity upfront — a wrong implementation costs more than a question
- Check if this already partially exists in the codebase before building from scratch

### Assess Scope

- List the files and modules that will be touched
- Identify shared code in the blast radius (components, utilities, types used elsewhere)
- For large changes (5+ files, new patterns, architectural impact): propose a plan before implementing

### Find Existing Patterns

Search the codebase for similar implementations to use as models:

- Grep for similar component names, hook patterns, or API calls
- Check how adjacent features handle the same concerns (data fetching, error handling, state)
- Read the tests for similar features to understand expected behavior patterns
- If no pattern exists, note it — you'll need to make a deliberate choice

## 2. Make Decisions Explicitly

When choices arise during implementation, don't silently pick one. Common decision points:

- **Where to place new code** — Colocate with related feature, or shared utility? Follow the closest precedent.
- **Extend vs. create** — Can you extend an existing abstraction, or does this need something new? Default to extending.
- **Scope boundaries** — Fix adjacent issues you find, or note them and stay focused? Stay focused; flag the rest.
- **When no pattern exists** — State the trade-offs, pick the simplest option, explain why.

## 3. Implement Incrementally

Sequence changes to minimize risk:

1. **Types and interfaces first** — Define the contract before the logic
2. **Core logic** — Implement the primary behavior
3. **Integration** — Wire into existing code (routes, exports, state)
4. **Edge cases and error handling** — Handle failures, empty states, boundaries
5. **Tests** — Cover the behavior you just built, plus edge cases
6. **Cleanup** — Remove dead code, verify imports, check for consistency

## 4. Know When to Stop

Resist scope creep during implementation:

- **Don't refactor while implementing** — If you spot something worth improving, note it separately
- **Don't optimize prematurely** — Make it work correctly first
- **Don't over-abstract** — If there's only one use case, don't build a framework
- **Don't bundle unrelated changes** — One concern per implementation

## 5. Validate

Before completing:

- [ ] Changes match the intent of the request, not just the letter
- [ ] All touched code follows established repository patterns
- [ ] Related code is updated (types, imports, tests, documentation)
- [ ] No unintended side effects on shared code
- [ ] Solution is as simple as possible for the requirements

## Output Structure

Adapt depth to the change — a one-line fix doesn't need a full report:

- **Approach** — What pattern was followed and why; key decisions made
- **Changes** — Files modified and the nature of each change
- **Verification** — How it was validated; tests added or updated
- **Risks** — Side effects to monitor, or follow-up work flagged during implementation

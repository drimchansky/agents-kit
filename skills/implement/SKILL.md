---
name: implement
description: Build, implement, create, or add a feature — write production-quality code following project patterns with analysis and validation. Use when the user asks to build, implement, create, code, or develop functionality (examples include adding features, building components, writing API endpoints, creating utilities, or implementing a design plan).
---

This skill guides implementation of software features. It produces production-quality code — working, validated, and ready to ship — that follows the project's established patterns and conventions. Every decision is deliberate, every change is verified.

The user provides a feature request, task description, or design plan. They may include context about constraints, patterns to follow, or prior discussion.

**CRITICAL**: If a design plan was created earlier in this conversation, treat it as the source of truth — follow its structure, sequence, and decisions. Don't re-analyze from scratch or deviate without reason.

When something unexpected comes up during implementation (new constraints, missing APIs, incompatible patterns), assess the impact:

- **Small** (naming, minor ordering, trivial adjustments) — decide yourself and note what you changed
- **Significant** (changes scope, alters architecture, affects other components, contradicts the plan) — stop and ask before proceeding

## 1. Analyze Before Coding

### Understand the Request

- Clarify ambiguity upfront — a wrong implementation costs more than a question
- Check if this already partially exists in the codebase before building from scratch

### Assess Scope

- List the files and modules that will be touched
- Identify shared code in the blast radius (components, utilities, types used elsewhere)
- For large changes (5+ files, new patterns, architectural impact): propose a plan before implementing

### Find Existing Patterns

**CRITICAL**: Always search the codebase for similar implementations before writing new code. Match what already exists.

- Grep for similar component names, hook patterns, or API calls
- Check how adjacent features handle the same concerns (data fetching, error handling, state)
- Read the tests for similar features to understand expected behavior patterns
- If no pattern exists, note it — you'll need to make a deliberate choice

**NEVER** invent a new pattern when an existing one covers the same concern. Consistency across a codebase matters more than local perfection.

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

- **Don't refactor while implementing** — If you spot something worth improving, note it separately
- **Don't optimize prematurely** — Make it work correctly first
- **Don't over-abstract** — If there's only one use case, don't build a framework
- **Don't bundle unrelated changes** — One concern per implementation

## 5. Validate

**IMPORTANT**: Every implementation must pass these checks before presenting results.

- [ ] Changes match the intent of the request, not just the letter
- [ ] All touched code follows established repository patterns
- [ ] Related code is updated (types, imports, tests, documentation)
- [ ] No unintended side effects on shared code
- [ ] Solution is as simple as possible for the requirements
- [ ] **Run type checking** (`tsc --noEmit` or the project's equivalent) — zero errors
- [ ] **Run linting** (`lint` or the project's equivalent) — zero warnings/errors

## Common Mistakes

- **Coding before reading** — Writing new code without searching for existing patterns. Always explore first.
- **Silent decisions** — Picking an approach without stating why. Every non-obvious choice should be noted.
- **Scope creep** — Fixing "one more thing" while implementing. Note it and stay focused.
- **Premature abstraction** — Building a framework for one use case. Three similar lines of code is better than a premature helper.
- **Skipping validation** — Presenting code that doesn't type-check or lint. Always run the checks.

## Output Structure

Adapt depth to the change — a one-line fix doesn't need a full report:

- **Approach** — What pattern was followed and why; key decisions made
- **Changes** — Files modified and the nature of each change
- **Verification** — How it was validated; tests added or updated
- **Risks** — Side effects to monitor, or follow-up work flagged during implementation

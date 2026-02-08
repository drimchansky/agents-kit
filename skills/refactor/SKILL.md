---
name: refactor
description: Restructure existing code — identify smells, plan safe incremental changes, and improve design without changing behavior
disable-model-invocation: true
---

# Refactor

Improve the structure, readability, or maintainability of existing code without changing its external behavior. Every step must keep the code in a working state.

If the refactoring scope is unclear or risky, clarify before starting.

## 1. Understand the Current State

### Read Before Changing

- Read all code in the refactoring scope — don't refactor code you haven't fully understood
- Trace callers and consumers to understand the blast radius
- Run existing tests to establish a passing baseline — if there are no tests, flag this as a risk
- Identify the actual problem — "messy code" isn't specific enough; name the smell

### Common Smells Worth Addressing

- **Duplication** — Same logic repeated across multiple locations
- **Long functions** — Doing too many things; hard to name, test, or reason about
- **Deep nesting** — Excessive indentation from conditionals or callbacks
- **Primitive obsession** — Passing raw strings/numbers where a domain type would be clearer
- **Feature envy** — A function that uses more of another module's data than its own
- **Shotgun surgery** — A single change requires edits across many unrelated files
- **Dead code** — Unreachable code, unused exports, or commented-out blocks

### What Not to Refactor

- Code that works and isn't in the way of the current task
- Code with no tests, unless you add tests first
- Performance-sensitive code without profiling data
- Code owned by another team or behind an API contract without coordination

## 2. Define the Target State

Before touching code, describe what "better" looks like:

- What specific structural improvement are you making?
- Which files and modules will be affected?
- What will the public API look like after the refactoring?
- What should remain unchanged?

If the refactoring is large, break it into phases with stable checkpoints between them.

## 3. Refactor Incrementally

Each step must leave the code in a working, testable state:

1. **Add tests if missing** — Cover the existing behavior before changing it
2. **Make one structural change at a time** — Rename, extract, inline, or move — don't combine
3. **Run tests after each change** — Catch regressions immediately, not at the end
4. **Update callers and consumers** — Don't leave broken references or stale imports
5. **Remove dead code** — Delete what's no longer used; don't comment it out

### Safe Refactoring Moves

- **Extract** — Pull a block into a named function, component, hook, or module
- **Inline** — Replace a trivial abstraction with its implementation
- **Rename** — Give a more accurate name to a variable, function, or file
- **Move** — Relocate code to a more appropriate module or directory
- **Replace conditional with polymorphism** — When a switch/if chain maps to distinct behaviors
- **Simplify signatures** — Reduce parameters, use options objects, remove unused arguments

## 4. Verify

Before completing:

- [ ] All existing tests still pass
- [ ] External behavior is unchanged — same inputs produce same outputs
- [ ] No unused imports, dead code, or orphaned files remain
- [ ] Code is demonstrably simpler, not just different
- [ ] Callers and consumers are updated consistently

## Output Structure

Adapt depth to the refactoring size:

- **Problem** — What smell or structural issue was addressed and why
- **Approach** — The refactoring strategy chosen (extract, inline, reorganize, etc.)
- **Changes** — Files modified and the nature of each change
- **Verification** — Tests run, behavior confirmed unchanged

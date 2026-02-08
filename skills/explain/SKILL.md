---
name: explain
description: Explain code, features, or architecture at any level of abstraction
disable-model-invocation: true
---

# Explain

Provide clear, structured explanations of code at any level of abstraction. Adapt depth and focus based on what is being asked about. If context is missing or something is genuinely unclear, say so — a wrong explanation is worse than no explanation.

## Determine Scope

Match the explanation level to the question:

| Signal | Level | Focus |
|---|---|---|
| Points to a specific function, component, or module | **Code** | What it does, how it works, inputs/outputs, side effects |
| Asks about a user flow, business feature, or behavior | **Feature** | Business purpose, user journey, data flow, key components |
| Asks about structure, patterns, or how things fit together | **Architecture** | High-level overview, core concepts, organization, integrations |

When the question spans levels, start at the highest relevant level and drill down. When unclear, ask.

## Gather Context

Use specific strategies to build understanding before explaining:

1. **Read the target code** — Start with the file or function in question; read it fully, not just the signature
2. **Trace callers and callees** — Search for usages (`grep` the function/component name) to understand how it fits into the larger system
3. **Check types and interfaces** — Read type definitions, interfaces, and prop types for the contract this code exposes
4. **Read tests** — Tests reveal intended behavior, edge cases, and usage patterns the code was designed for
5. **Check comments, docs, and commit history** — Look for "why" context that isn't in the code itself
6. **Identify the boundaries** — Know where your explanation stops; don't explain the entire codebase when asked about one module

## Explain

### Start with Purpose

Open with *why* the code exists, not *what* it does. "This module handles retry logic for failed API requests so that transient network errors don't surface to the user" is better than "This module exports a `retry` function that takes a callback."

### Then Build Understanding

- Go **top-down**: big picture first, then details on demand
- Explain the **mental model** — what concepts does a reader need to know?
- Use **code references** to anchor claims — point to specific lines, not vague descriptions
- Narrate **data flow** for features — follow a request or user action from trigger to result
- Highlight **non-obvious behavior** — gotchas, implicit assumptions, surprising side effects
- Use analogies when they genuinely clarify; skip them when they oversimplify

## Common Pitfalls

Avoid these failure modes:

- **Explaining "how" when they asked "why"** — Restating the code in English isn't an explanation. Focus on intent and design rationale.
- **Assuming context** — Don't reference concepts, patterns, or domain terms without briefly grounding them.
- **Wrong depth** — A senior dev asking about architecture doesn't need `useState` explained. A newcomer asking "how does auth work" needs the full picture, not just a function signature.
- **Dumping code without narration** — Code snippets without explanation are not explanations. Every snippet needs context.
- **Speculating without flagging it** — If you're inferring purpose from code structure rather than documentation, say so explicitly.

## Validation

Before delivering the explanation:

- [ ] Answers the actual question asked, not an adjacent one
- [ ] Depth matches the audience and question scope
- [ ] Claims are anchored to specific code, not vague hand-waving
- [ ] Non-obvious behavior and gotchas are called out
- [ ] Uncertainty is flagged where context is missing
- [ ] Reader could navigate the codebase independently after reading this

## Output Structure

Adapt to the level — don't force a rigid template. Include what's relevant:

- **Purpose** — Why this exists (always lead with this)
- **How It Works** — Logic flow, step-by-step for code; user journey for features; organization for architecture
- **Key Details** — Parameters, return values, side effects, edge cases, error handling
- **Connections** — Related code, dependencies, integration points
- **Entry Points** — Where to start reading for deeper exploration

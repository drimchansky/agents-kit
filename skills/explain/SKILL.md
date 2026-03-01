---
name: explain
description: Explain how something works — code, libraries, APIs, protocols, concepts, or architecture. Use when the user asks to explain, walk through, describe, or teach any software engineering topic (examples include codebase internals, library APIs, domain concepts, protocols, design patterns, or how technologies work).
disable-model-invocation: true
---

This skill guides clear, structured explanations of any software engineering topic — from a single function to an entire architectural pattern, from codebase internals to external libraries and domain concepts.

The user asks about something they want to understand. This can be code in the current project, an external library or API, a protocol, a design pattern, a domain concept, or how technologies relate to each other.

**CRITICAL**: Use web search liberally. Don't rely solely on training data for anything that could be outdated — library APIs, framework behavior, version-specific details, ecosystem conventions. Make as many web requests as needed to give an accurate, current answer.

## Determine Scope

Match the explanation level to the question:

| Signal                                                     | Level            | Focus                                                                     |
| ---------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| Points to a specific function, component, or module        | **Code**         | What it does, how it works, inputs/outputs, side effects                  |
| Asks about a user flow, business feature, or behavior      | **Feature**      | Business purpose, user journey, data flow, key components                 |
| Asks about structure, patterns, or how things fit together | **Architecture** | High-level overview, core concepts, organization, integrations            |
| Asks about a library, API, protocol, or external tool      | **External**     | What it is, core API surface, mental model, how it fits into the project  |
| Asks about a domain concept or engineering principle       | **Concept**      | Definition, why it matters, practical implications, common misconceptions |

When the question spans levels, start at the highest relevant level and drill down. When unclear, ask.

## Gather Context

Use specific strategies to build understanding before explaining:

### For codebase questions

1. **Read the target code** — Start with the file or function in question; read it fully, not just the signature
2. **Trace callers and callees** — Search for usages to understand how it fits into the larger system
3. **Check types and interfaces** — Read type definitions, interfaces, and prop types for the contract this code exposes
4. **Read tests** — Tests reveal intended behavior, edge cases, and usage patterns
5. **Check comments, docs, and commit history** — Look for "why" context that isn't in the code itself
6. **Identify the boundaries** — Know where your explanation stops; don't explain the entire codebase when asked about one module

### For external topics (libraries, APIs, concepts)

1. **Search the web** — Look up official documentation, changelogs, and authoritative sources. Don't guess API signatures or behavior from memory.
2. **Check the project's usage** — Search the codebase for how the library/concept is already used locally
3. **Read relevant package versions** — Check `package.json`, lockfiles, or equivalent to know what version is in use
4. **Cross-reference** — If documentation and actual project usage disagree, flag it

## Explain

### Start with Purpose

Open with _why_ this exists or _why_ it matters, not _what_ it is. "This module handles retry logic for failed API requests so that transient network errors don't surface to the user" is better than "This module exports a `retry` function that takes a callback."

### Then Build Understanding

- Go **top-down**: big picture first, then details on demand
- Explain the **mental model** — what concepts does a reader need to hold in their head?
- Use **code references** to anchor claims about codebase internals — point to specific lines, not vague descriptions
- Narrate **data flow** for features — follow a request or user action from trigger to result
- Highlight **non-obvious behavior** — gotchas, implicit assumptions, surprising side effects, common misconceptions
- Use analogies when they genuinely clarify; skip them when they oversimplify

## Common Pitfalls

- **Explaining "how" when they asked "why"** — Restating the code in English isn't an explanation. Focus on intent and design rationale.
- **Assuming context** — Don't reference concepts, patterns, or domain terms without briefly grounding them.
- **Wrong depth** — A senior dev asking about architecture doesn't need `useState` explained. A newcomer asking "how does auth work" needs the full picture.
- **Dumping code without narration** — Code snippets without explanation are not explanations.
- **Speculating without flagging it** — If you're inferring rather than citing, say so explicitly.
- **Stale information** — Don't explain library behavior from memory when a web search would confirm the current state. When in doubt, search.

## Validation

Before delivering the explanation:

- [ ] Answers the actual question asked, not an adjacent one
- [ ] Depth matches the audience and question scope
- [ ] Claims are anchored to code or authoritative sources, not vague hand-waving
- [ ] Non-obvious behavior and gotchas are called out
- [ ] Uncertainty is flagged where context is missing
- [ ] Version-sensitive information has been verified via web search

## Output Structure

Adapt to the level — don't force a rigid template. Include what's relevant:

- **Purpose** — Why this exists or matters (always lead with this)
- **How It Works** — Logic flow for code; user journey for features; organization for architecture; core API for libraries
- **Key Details** — Parameters, return values, side effects, edge cases, error handling
- **Connections** — Related code, dependencies, integration points, alternatives
- **Entry Points** — Where to start reading for deeper exploration; links to docs for external topics

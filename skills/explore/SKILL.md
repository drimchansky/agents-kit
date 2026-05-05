---
name: explore
description: Use when asked to explore, explain, walk through, describe, teach, or analyze any software engineering topic — code, libraries, APIs, protocols, concepts, or architecture.
argument-hint: '[topic or file path]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line as a visible confirmation, **before** any other text or tool calls in this skill, on its own line — substitute `<version>` with the value on the **Version** line at the top of `./AGENTS.md`:

    ✅ Core agents-kit@<version> rules applied

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill guides clear, structured explanations of any software engineering topic — from a single function to an entire architectural pattern, from codebase internals to external libraries and domain concepts.

The user asks about something they want to understand. This can be code in the current project, an external library or API, a protocol, a design pattern, a domain concept, or how technologies relate to each other.

**CRITICAL**: Use web search liberally. Don't rely solely on training data for anything that could be outdated — library APIs, framework behavior, version-specific details, ecosystem conventions. Make as many web requests as needed to give an accurate, current answer.

## References

Before working, read any applicable checklists from `references/engineering/`. Skip ones that don't apply.

## Determine Scope

Match the explanation level to the question:

- **Code** — Points to a specific function, component, or module → what it does, how it works, inputs/outputs, side effects
- **Feature** — Asks about a user flow, business feature, or behavior → business purpose, user journey, data flow, key components
- **Architecture** — Asks about structure, patterns, or how things fit together → high-level overview, core concepts, organization, integrations
- **External** — Asks about a library, API, protocol, or external tool → what it is, core API surface, mental model, how it fits into the project
- **Concept** — Asks about a domain concept or engineering principle → definition, why it matters, practical implications, common misconceptions
- **Pre-plan** — Asks what exists before planning a change or choosing an approach → constraints, blast radius, known alternatives, open questions

When the question spans levels, start at the highest relevant level and drill down. When unclear, ask.

## Gather Context

Use specific strategies to build understanding before explaining:

### For codebase questions

1. **Read thoroughly** — Read the target code fully, then trace callers, callees, types, and tests
2. **Check history** — Comments, docs, and commit history for "why" context not in the code
3. **Map constraints** — Identify load-bearing elements: public API consumers, shared types, test contracts
4. **Assess blast radius** — What code depends on this area? Grep to trace usages.

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

### When Exploring for Planning

If the user will use this output to make a decision (design, refactor, or implement), go beyond description:

- **Surface constraints** — State explicitly what can't change and why (public API, downstream consumers, architectural invariants)
- **Identify change points** — Where does the code naturally extend or branch? What's isolated vs. entangled?
- **Discover alternatives** — Name 2–3 known approaches to achieving the goal (patterns in the codebase, common solutions, library capabilities). Don't fabricate — only surface options you can point to.
- **Compare alternatives** — For each option, note: complexity to implement, coupling to existing code, reversibility. One sentence per axis is enough.
- **Recommend** — Given the codebase, which fits best and why? Flag if you're uncertain.

## Don't Rationalize

- "I know how this library works" — Check the docs. APIs change between versions. Web search is free.
- "The code is self-explanatory" — If the user asked for an explanation, it wasn't self-explanatory to them.
- "This is probably how it works" — Inference without flagging it as inference is misleading. Cite sources or say you're guessing.
- "That's too much detail" — Match depth to the question. A question about internals needs internals.
- "Here's the code" — Code without narration is not an explanation. Explain what it does and why.

## Verification

- [ ] Answers the actual question asked, not an adjacent one
- [ ] Depth matches the audience and question scope
- [ ] Claims anchored to code or authoritative sources
- [ ] Non-obvious behavior and gotchas called out
- [ ] Uncertainty flagged where context is missing
- [ ] Version-sensitive information verified via web search
- [ ] If pre-plan: constraints and load-bearing elements identified
- [ ] If alternatives exist: at least 2 surfaced with trade-off notes

## Output Structure

Adapt to the level — don't force a rigid template. Include what's relevant:

- **Purpose** — Why this exists or matters (always lead with this)
- **How It Works** — Logic flow for code; user journey for features; organization for architecture; core API for libraries
- **Key Details** — Parameters, return values, side effects, edge cases, error handling
- **Constraints** — _(for pre-plan use)_ What's load-bearing, what can't change, downstream consumers and coupling
- **Connections** — Related code, dependencies, integration points; alternatives with trade-offs when planning (complexity, coupling, reversibility) and a recommendation if confident
- **Entry Points** — Where to start reading for deeper exploration; links to docs for external topics

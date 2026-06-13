---
name: explore
description: Use when asked to explore, explain, walk through, describe, teach, or analyze a topic — code, a library or API, a protocol, a system, a concept, or a domain question.
argument-hint: '[topic, file path, or any other source of information]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. Load the domain pack: take the task's `**Domain:**` (default `engineering`; infer from the request when there's no `CONTEXT.md`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for. If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill guides clear, structured explanations of any topic the user wants to understand — from a single function to an architectural pattern, from a system's internals to an external library or a domain concept. The methodology is domain-neutral; when the topic is code, load the engineering pack's `exploration.md` for the codebase-specific gathering recipe.

The user asks about something they want to understand. This can be code in the current project, an external library or API, a protocol, a design pattern, a domain concept, or how things relate to each other.

**CRITICAL**: Use web search liberally. Don't rely solely on training data for anything that could be outdated — library APIs, framework behavior, version-specific details, ecosystem conventions. Make as many web requests as needed to give an accurate, current answer.

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

Build understanding before explaining. Match the strategy to where the answer lives:

### When the answer is in the project / domain artifacts

Ground the explanation in what actually exists, not what you remember. Read the primary source fully, trace how it connects to the rest, check history for the "why" the artifact alone doesn't carry, and identify the load-bearing elements an explanation must respect. When the topic is code, follow the engineering pack's `./references/engineering/exploration.md` for the concrete recipe (trace callers / callees / types / tests, map blast radius, verify claims against source).

### When the answer is external (a library, standard, concept, or fact)

1. **Search the web** — Look up official documentation, changelogs, and authoritative sources. Don't guess signatures, behavior, or facts from memory.
2. **Check local usage** — See how the thing is already used in the project or in prior work.
3. **Pin the version / source** — Know which version or edition is in use before describing it.
4. **Cross-reference** — If the authoritative source and actual local usage disagree, flag it.

## Explain

### Start with Purpose

Open with _why_ this exists or _why_ it matters, not _what_ it is. "This module handles retry logic for failed API requests so that transient network errors don't surface to the user" is better than "This module exports a `retry` function that takes a callback."

### Then Build Understanding

- Go **top-down**: big picture first, then details on demand
- Explain the **mental model** — what concepts does a reader need to hold in their head?
- **Anchor claims to the primary source** — point to specific lines, sections, or evidence, not vague descriptions
- Narrate **the flow** — follow a request, a user action, or a process from trigger to result
- Highlight **non-obvious behavior** — gotchas, implicit assumptions, surprising side effects, common misconceptions
- Use analogies when they genuinely clarify; skip them when they oversimplify

### When Exploring for Planning

If the user will use this output to make a decision (design, refactor, or implement), go beyond description:

- **Surface constraints** — State explicitly what can't change and why (public interfaces, downstream consumers, invariants, external commitments)
- **Identify change points** — Where does the thing naturally extend or branch? What's isolated vs. entangled?
- **Discover alternatives** — Name 2–3 known approaches to achieving the goal (patterns already in use, common solutions, available capabilities). Don't fabricate — only surface options you can point to.
- **Compare alternatives** — For each option, note: complexity to implement, coupling to what exists, reversibility. One sentence per axis is enough.
- **Recommend** — Given what exists, which fits best and why? Flag if you're uncertain.

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

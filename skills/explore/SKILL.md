---
name: explore
description: Use when asked to explore, explain, walk through, describe, teach, or analyze a topic — code, a library or API, a protocol, a system, a concept, or a domain question.
argument-hint: '[topic, file path, or any other source of information]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: take the task's `**Domain:**` (default `engineering`; infer from the request when there's no `CONTEXT.md`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for. If the domain has no pack, run the neutral methodology and say so.

Explain the requested topic at the depth needed. For code, apply `./references/engineering/exploration.md`; methodology otherwise follows the resolved domain. Verify potentially outdated APIs, behavior, versions, and conventions through authoritative web sources.

## Determine Scope

- **Code:** function/module behavior, inputs, outputs, side effects.
- **Feature:** business purpose, user journey, data flow, components.
- **Architecture:** structure, concepts, patterns, integrations.
- **External:** library/API/protocol purpose, API surface, mental model, local fit.
- **Concept:** definition, relevance, implications, misconceptions.
- **Pre-plan:** existing constraints, affected consumers, alternatives, open questions.

Start at the highest relevant level, then drill down. Ask when scope is unclear; answer the actual question.

## Gather Context

### When the answer is in the project / domain artifacts

Read the primary source fully, trace connections, inspect history for intent, and identify constraints the explanation must preserve. Follow `./references/engineering/exploration.md` for code: callers, callees, types, tests, affected consumers, and source verification.

### When the answer is external (a library, standard, concept, or fact)

1. Search official documentation, changelogs, and authoritative sources; do not guess signatures or behavior.
2. Inspect local usage and prior work.
3. Establish the relevant version or edition before describing it.
4. Flag disagreement between authoritative documentation and local usage.

## Explain

### Start with Purpose

Lead with why it exists or matters, then describe what it does.

### Then Build Understanding

- Build from the big picture to requested detail; explain concepts before relying on them.
- Cite specific source lines, sections, or evidence. Mark inference and missing context explicitly.
- Follow a request/action/process from trigger to result; code alone is not an explanation.
- Explain non-obvious assumptions, side effects, gotchas, and misconceptions.
- Use analogies only when they clarify without distorting.

### When Exploring for Planning

Name constraints and why they cannot change, downstream consumers, and natural change points. Distinguish isolated areas from coupled ones. Present 2–3 source-backed approaches; compare implementation complexity, coupling, and reversibility. Recommend the best fit when evidence supports it; otherwise state uncertainty.

## Output Structure

Adapt to the question rather than forcing every field:

- **Purpose:** always lead with relevance.
- **How It Works:** logic, journey, organization, or API.
- **Key Details:** parameters, returns, side effects, boundaries, errors.
- **Constraints:** for planning, protected behavior and affected consumers.
- **Connections:** dependencies, integrations, alternatives/tradeoffs, supported recommendation.
- **Entry Points:** sources for deeper reading, including external docs.

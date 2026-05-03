---
name: refine-idea
description: Use when asked to refine, ideate, sharpen, or stress-test a vague idea or rough concept before planning.
argument-hint: '[idea or concept]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line verbatim to the user as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core rules applied (./AGENTS.md)

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill turns a raw idea into a sharp, actionable concept worth building. It runs three phases — divergent exploration, convergent evaluation, and a written one-pager — and produces an artifact at `.agents/ideas/<slug>.md` that `design-plan` can later consume.

The user provides a rough concept, problem, or "what if" question. They may include partial context, constraints, or prior thinking. The idea may be vague on purpose — that's the input.

**CRITICAL**: The output of this skill is a written one-pager on disk, not a conversation message. After writing it, summarize briefly in chat and point at the file.

## References

Before working, read any applicable checklists from `references/engineering/`. Skip ones that don't apply.

## When to Refine (and When Not To)

**Refine when:**

- The idea is vague enough that planning would just guess at scope
- Multiple framings are plausible and none has been chosen
- Hidden assumptions could kill the idea before any code is written
- The user wants to stress-test thinking, not just get a plan

**Skip refinement when:**

- The user already knows what they want to build and just needs a plan → use `design-plan`
- The change is well-scoped and the problem is concrete → use `design-plan`
- The user is asking how something works, not deciding what to build → use `explore`

If the idea is already concrete enough to plan, say so and recommend `design-plan` directly.

## Output File

**Location:** `.agents/ideas/<slug>.md` at the project root.

- `<slug>` — derive from the idea: 2–5 lowercase kebab-case words capturing the gist (e.g. `weekly-digest-email`, `replace-cache-invalidation`, `internal-search-rebuild`). Don't ask the user — derive it.

If `.agents/ideas/` doesn't exist, create it. If a one-pager with the same slug exists, append a short suffix (`-2`, `-3`).

The one-pager is the **handoff to `design-plan`**: a chosen direction, the assumptions it depends on, and the scope decisions already made. Don't rewrite it during refinement — refine through conversation, then write the final version.

## Process

The three phases below are sequential. Don't skip Phases 1–2 to jump straight to the artifact.

### Phase 1 — Diverge

**Goal:** Open the idea up before narrowing it down.

1. **Restate as "How Might We"** — Reframe the user's input as a one-sentence "How might we…" problem. This forces clarity on what's actually being solved versus what's being assumed.
2. **Ask 3–5 sharpening questions** — No more. Focus on:
    - Who is this for, specifically?
    - What does success look like?
    - What are the real constraints (time, tech, resources)?
    - What's been tried before?
    - Why now?

    Don't proceed until the target user and success criteria are concrete.

3. **Generate 5–8 variations** using lenses (pick the ones that fit; don't run all mechanically):
    - **Inversion** — What if we did the opposite?
    - **Constraint removal** — What if budget / time / tech weren't factors?
    - **Audience shift** — What if this were for a different user?
    - **Combination** — What if we merged this with an adjacent idea?
    - **Simplification** — What's the version that's 10× simpler?
    - **10× version** — What would this look like at massive scale?
    - **Expert lens** — What would domain experts find obvious that outsiders miss?

    Push beyond what the user initially asked for. Each variation should have a reason it exists, not just be a bullet point.

**If running inside a codebase:** Use grep, file reads, and codebase search to ground variations in existing architecture, patterns, and prior art. Cite specific files when relevant.

### Phase 2 — Converge

After the user reacts to Phase 1 (signals which variations resonate, pushes back, adds context), shift to evaluation.

1. **Cluster** the resonant ideas into 2–3 distinct directions. Each direction should feel meaningfully different, not just variations on the same theme.
2. **Stress-test** each direction on three axes:
    - **User value** — Who benefits and how much? Painkiller or vitamin?
    - **Feasibility** — Technical and resource cost? What's the hardest part?
    - **Differentiation** — What makes this genuinely different? Would someone switch?

3. **Surface hidden assumptions.** For each direction, name explicitly:
    - What you're betting is true but haven't validated
    - What could kill the idea
    - What you're choosing to ignore (and why that's okay for now)

    This is where most ideation fails. Don't skip it.

**Be honest, not supportive.** A good ideation partner is not a yes-machine. If a direction is weak, say so with kindness and specificity.

### Phase 3 — Sharpen

Write the one-pager to `.agents/ideas/<slug>.md`. Then post a short summary in this exact shape, so the user can copy-paste the next command:

```
Idea: .agents/ideas/<slug>.md
Slug: <slug>

Next: /design-plan <slug>
```

`design-plan` deliberately doesn't auto-discover one-pagers — slugs re-derived from a different task phrasing won't reliably match. The pre-formatted next-command is what makes the handoff frictionless; don't drop it or paraphrase it.

The "Not Doing" list is the most valuable part — focus is about saying no to good ideas. Make trade-offs explicit.

## Don't Rationalize

- "This idea is clear enough already" — If the user invoked `refine-idea`, it wasn't.
- "Three phases is overkill" — The phases each do one thing. Skipping them collapses the artifact into a plan that hasn't earned its assumptions.
- "I'll surface assumptions later" — Untested assumptions kill ideas. Surface them before committing to a direction.
- "More variations is better" — 5–8 considered variations beat 20 shallow ones.
- "The user liked the first idea, ship that" — Liking the first idea doesn't validate it. Run the convergent stress-test anyway.
- "I'll output the one-pager in chat" — The artifact must be a file. `design-plan` reads it from disk.

## Verification

- [ ] One-pager written to `.agents/ideas/<slug>.md`
- [ ] Chat summary surfaces file path, slug, **and** the literal `Next: /design-plan <slug>` line in the exact handoff shape
- [ ] Slug derived from the idea, kebab-case, 2–5 words
- [ ] "How Might We" problem statement is one sentence and concrete
- [ ] Target user and success criteria are explicit
- [ ] Multiple directions were explored, not just the user's first framing
- [ ] Hidden assumptions are listed with how each could be validated
- [ ] "Not Doing" list makes trade-offs explicit, with reasons
- [ ] Output is a file on disk, not a conversation message

## One-Pager Structure

Write the file with this layout. Adapt section depth to the idea's size — keep it to one page where possible.

```markdown
# <idea name>

**Status:** refined
**Plan:** _(none yet — run `design-plan` to populate)_

## Problem Statement

<one-sentence "How Might We" framing>

## Target User & Success

- **Who:** <specific user / role>
- **Success looks like:** <observable outcome>

## Recommended Direction

<the chosen direction and why — 2–3 paragraphs max>

## Key Assumptions to Validate

- [ ] <assumption> — <how to test it>
- [ ] <assumption> — <how to test it>

## MVP Scope

- **In:** <minimum to test the core assumption>
- **Out:** <what's deferred>

## Not Doing (and Why)

- <thing> — <reason>
- <thing> — <reason>

## Open Questions

- <question that needs answering before `design-plan`>
```

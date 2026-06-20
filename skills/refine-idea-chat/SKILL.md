---
name: refine-idea-chat
description: Use when asked to refine, ideate, sharpen, or stress-test a vague idea in chat.
argument-hint: '[idea or concept]'
disable-model-invocation: true
---

# Refine Idea (chat)

This skill turns a raw idea into a sharp, actionable concept worth building. It runs three phases — divergent exploration, convergent evaluation, and a sharpened one-pager — and posts the result as a structured chat message.

The user provides a rough concept, problem, or "what if" question. They may include partial context, constraints, or prior thinking. The idea may be vague on purpose — that's the input.

**CRITICAL**: The output of this skill is a structured chat message. Do not write any files, derive any slugs, or hand off to another skill.

## When to Refine (and When Not To)

**Refine when:**

- The idea is vague enough that planning would just guess at scope
- Multiple framings are plausible and none has been chosen
- Hidden assumptions could kill the idea before any code is written
- The user wants to stress-test thinking, not just get a plan

**Skip refinement when:**

- The user wants a saved one-pager that feeds `plan-task` → use `refine-idea` (file-producing sibling)
- The user is asking how something works, not deciding what to build → use `explore`

If the idea is already concrete enough to plan, say so and recommend the appropriate next step directly.

## Process

The three phases below are sequential. Don't skip Phases 1–2 to jump straight to the one-pager.

### Phase 1 — Diverge

**Goal:** Open the idea up before narrowing it down.

1. **Restate as "How Might We"** — Reframe the user's input as a one-sentence "How might we…" problem. This forces clarity on what's actually being solved versus what's being assumed.
2. **Ask 3–5 sharpening questions** — No more. Focus on:
    - Who is this for, specifically?
    - What does success look like?
    - What are the real constraints (time, tech, resources)?
    - What's been tried before?
    - Why now?

    Don't proceed until the target user and rough success picture are concrete enough to inform the recommended direction.

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
    - **Feasibility** — Cost and effort to pull off? What's the hardest part?
    - **Differentiation** — What makes this genuinely different? Would someone switch?

3. **Surface hidden assumptions.** For each direction, name explicitly:
    - What you're betting is true but haven't validated
    - What could kill the idea
    - What you're choosing to ignore (and why that's okay for now)

    This is where most ideation fails. Don't skip it.

**Be honest, not supportive.** A good ideation partner is not a yes-machine. If a direction is weak, say so with kindness and specificity.

### Phase 3 — Sharpen

Post the one-pager as a structured chat message using the _One-pager structure_ layout below. No files are written. No slug is derived. No follow-up command is suggested.

The "Not Doing" list is the most valuable part — focus is about saying no to good ideas. Make trade-offs explicit.

## Don't Rationalize

- "This idea is clear enough already" — If the user invoked `refine-idea-chat`, it wasn't.
- "Three phases is overkill" — The phases each do one thing. Skipping them collapses the one-pager into a guess that hasn't earned its assumptions.
- "I'll surface assumptions later" — Untested assumptions kill ideas. Surface them before committing to a direction.
- "More variations is better" — 5–8 considered variations beat 20 shallow ones.
- "The user liked the first idea, ship that" — Liking the first idea doesn't validate it. Run the convergent stress-test anyway.
- "I'll save this to disk just in case" — This skill is chat-only. If the user wants a saved artifact, that's `refine-idea`, not this one.

## Verification

- [ ] "How Might We" problem statement is one sentence and concrete
- [ ] Multiple directions were explored, not just the user's first framing
- [ ] Hidden assumptions are listed with how each could be validated
- [ ] "Not Doing" list makes trade-offs explicit, with reasons
- [ ] One-pager posted as a structured chat message
- [ ] No files written, no slug derived, no follow-up command suggested

## One-pager structure

Render the chat message with this layout. Adapt section depth to the idea's size — keep it to one screen where possible.

```markdown
# <idea name>

## Problem Statement

<one-sentence "How Might We" framing>

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

- <question that needs answering before building>
```

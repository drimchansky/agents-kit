# Refine Idea — Process

Diverge / converge / sharpen process shared by `skills/refine-idea/SKILL.md` (writes a one-pager to `.agents/tasks/<slug>/CONTEXT.md` for the engineering task flow) and `skills/refine-idea-chat/SKILL.md` (posts the one-pager as a chat message). This file is output-mode-agnostic; each skill owns its own output rules, skip cases, and verification addendum.

## When to Refine

- The idea is vague enough that planning would just guess at scope
- Multiple framings are plausible and none has been chosen
- Hidden assumptions could kill the idea before any code is written
- The user wants to stress-test thinking, not just get a plan

Skip cases differ per output mode — see each skill's *Skip refinement when* section for which sibling to redirect to.

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
    - **Feasibility** — Technical and resource cost? What's the hardest part?
    - **Differentiation** — What makes this genuinely different? Would someone switch?

3. **Surface hidden assumptions.** For each direction, name explicitly:
    - What you're betting is true but haven't validated
    - What could kill the idea
    - What you're choosing to ignore (and why that's okay for now)

    This is where most ideation fails. Don't skip it.

**Be honest, not supportive.** A good ideation partner is not a yes-machine. If a direction is weak, say so with kindness and specificity.

### Phase 3 — Sharpen

Each skill formats and delivers the one-pager differently — see its *Phase 3 — Sharpen (output)* section. The "Not Doing" list is the most valuable part in either mode — focus is about saying no to good ideas. Make trade-offs explicit.

## Don't Rationalize

- "This idea is clear enough already" — If the user invoked the skill, it wasn't.
- "Three phases is overkill" — The phases each do one thing. Skipping them collapses the one-pager into a guess that hasn't earned its assumptions.
- "I'll surface assumptions later" — Untested assumptions kill ideas. Surface them before committing to a direction.
- "More variations is better" — 5–8 considered variations beat 20 shallow ones.
- "The user liked the first idea, ship that" — Liking the first idea doesn't validate it. Run the convergent stress-test anyway.

Each skill adds output-mode-specific rationalizations in its own *Don't Rationalize (skill-specific)* section.

## Standard Verification Checklist

- [ ] "How Might We" problem statement is one sentence and concrete
- [ ] Multiple directions were explored, not just the user's first framing
- [ ] Hidden assumptions are listed with how each could be validated
- [ ] "Not Doing" list makes trade-offs explicit, with reasons

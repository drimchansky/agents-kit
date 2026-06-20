# Ideation Method: Diverge then Converge

The shared two-phase ideation method behind `refine-idea` and `refine-idea-chat`. **This file is the single source of truth for the method.** Each skill runs these two phases, then differs only in how it outputs the result — `refine-idea` writes a `CONTEXT.md` one-pager to disk and hands off to `plan-task`; `refine-idea-chat` posts the one-pager as a chat message and writes nothing.

`refine-idea` cites this file directly. `refine-idea-chat` is a portable utility skill meant to run without the kit installed, so it can't cite references — it carries a self-contained copy of Phases 1–2 (with its own non-citing wording of the grounding step). When the method changes here, mirror the change into `refine-idea-chat`.

The two phases are sequential. Don't skip them to jump straight to the one-pager.

## Phase 1 — Diverge

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

**Ground in what exists:** Use the domain's reality to ground variations in existing structure, patterns, and prior art — cite specifics rather than speaking in the abstract. When the domain is code, that means grep / file reads / codebase search (see `../engineering/exploration.md`).

## Phase 2 — Converge

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

After converging, hand the chosen direction, its key assumptions, MVP scope, and "Not Doing" list to the skill's output phase. The testable, plan-specific goals are not written here — `refine-idea` defers them to `plan-task`'s goals step, and `refine-idea-chat` leaves them for whatever follows the chat.

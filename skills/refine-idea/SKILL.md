---
name: refine-idea
description: Use when asked to refine, ideate, sharpen, or stress-test a vague idea or rough concept before planning.
argument-hint: '[idea or concept] [destination path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: take the task's `**Domain:**` (default `engineering`; infer from the request when there's no `CONTEXT.md` yet, and record it in the `CONTEXT.md` you write) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, …). If the domain has no pack, run the neutral methodology and say so.

This skill turns a raw idea into a sharp, actionable concept worth building. It runs three phases — divergent exploration, convergent evaluation, and a written one-pager — and produces an artifact at `<task-folder>/CONTEXT.md` (canonically `.agents/tasks/<slug>/CONTEXT.md`) that `plan-task` and `implement-task` later consume as the static grounding context for the task.

The user provides a rough concept, problem, or "what if" question. They may include partial context, constraints, or prior thinking. The idea may be vague on purpose — that's the input.

**CRITICAL**: The output of this skill is a written one-pager on disk, not a conversation message. After writing it, summarize briefly in chat and point at the file.

## When to Refine (and When Not To)

**Refine when:**

- The idea is vague enough that planning would just guess at scope
- Multiple framings are plausible and none has been chosen
- Hidden assumptions could kill the idea before any code is written
- The user wants to stress-test thinking, not just get a plan

**Skip refinement when:**

- The user already knows what they want to build and just needs a plan → use `plan-task`
- The change is well-scoped and the problem is concrete → use `plan-task`
- The user wants to sharpen an idea without writing anything to disk → use `refine-idea-chat` (chat-only sibling)
- The user is asking how something works, not deciding what to build → use `explore`

If the idea is already concrete enough to plan, say so and recommend `plan-task` directly.

## Output File

**Location:** `<task-folder>/CONTEXT.md` — canonically `.agents/tasks/<slug>/CONTEXT.md` at the project root; a user-supplied destination path overrides the location, interpreted per the *Destination paths* rule in `./references/workflow/task-layout.md` (cite it, don't restate it).

- `<slug>` — derive from the idea: 2–5 lowercase kebab-case words capturing the gist (e.g. `weekly-digest-email`, `replace-cache-invalidation`, `internal-search-rebuild`). Don't ask the user — derive it. The slug names the **task folder** that will hold this `CONTEXT.md` plus the goals, plan, and result for the effort — the folder layout and discovery rules are defined in `./references/workflow/task-layout.md`.

If the resolved task folder doesn't exist, create it — `.agents/tasks/<slug>/` when no destination was given. If a `CONTEXT.md` already exists at that path, read it first and ask whether to overwrite or pick a different slug — don't clobber an existing task's context.

`CONTEXT.md` is the **static grounding context for the task**: the chosen direction, the assumptions it depends on, the scope decisions already made, plus any external references (tickets, links, pasted specs) the user adds later. It is read by the plan and its result inside the folder. Don't rewrite it during refinement — refine through conversation, then write the final version.

**When the task folder holds a `ticket.md`**, it is the authoritative product-facing ask — read it first as the primary input to refine. Let `CONTEXT.md`'s `## Problem Statement` **cite** `./ticket.md` rather than restating it: the ticket carries the requester's framing, required functional output, and references; `CONTEXT.md` adds the grounding this refinement produces (recommended direction, assumptions, MVP scope, "Not Doing"). See [`./references/workflow/task-layout.md`](./references/workflow/task-layout.md) § *One home per fact*.

### What belongs in CONTEXT.md (and what doesn't)

- ✅ The one-pager content this skill produces (problem framing, MVP scope, "Not Doing", assumptions)
- ✅ External references — tickets, Slack threads, PR links, Figma, design docs
- ✅ Pasted specs, schemas, API responses
- ✅ Standing decisions and constraints the plan must respect
- ❌ Per-step implementation notes — those go in the plan's result file
- ❌ Approach rationale or step breakdowns — those go in the plan
- ❌ Goals / acceptance criteria — those go in the sibling `goals.md`
- ❌ Verify criteria — those go in the plan's _Steps_
- ❌ Conversation summaries or TODO scratchpads

## Process

This skill runs the shared two-phase ideation method — **Phase 1 (Diverge)** and **Phase 2 (Converge)** — defined in `./references/workflow/ideation.md`. Run both phases from there (the testable, plan-specific goals are deferred to `plan-task`'s goals step, not written here), then complete **Phase 3** below to produce the artifact.

### Phase 3 — Sharpen

Write the one-pager to the resolved task folder's `CONTEXT.md`. Then post a short summary in this exact shape, so the user can copy-paste the next command. For a task whose root is the canonical one or a registered one, where the bare slug resolves:

```
Context: .agents/tasks/<slug>/CONTEXT.md
Slug: <slug>

Next: /plan-task <slug>
```

For a task whose root is neither, the handoff token is the folder's absolute path (that is the only case where a bare slug does not resolve):

```
Context: <abs-path>/CONTEXT.md
Slug: <slug>

Next: /plan-task <abs-path>/
```

`plan-task` discovers `CONTEXT.md` by resolving the task folder. The handoff token is the **slug** when the folder sits in the canonical root or a registered one, and the folder's **absolute path** only when its root is neither (`./references/workflow/task-layout.md` § *One task, one flat folder*) — so for that last case the `Next:` line must carry the path. The pre-formatted next-command is what makes the handoff frictionless; don't drop it or paraphrase it.

The "Not Doing" list is the most valuable part — focus is about saying no to good ideas. Make trade-offs explicit.

## Don't Rationalize

- "This idea is clear enough already" — If the user invoked `refine-idea`, it wasn't.
- "Three phases is overkill" — The phases each do one thing. Skipping them collapses the artifact into a plan that hasn't earned its assumptions.
- "I'll surface assumptions later" — Untested assumptions kill ideas. Surface them before committing to a direction.
- "More variations is better" — 5–8 considered variations beat 20 shallow ones.
- "The user liked the first idea, ship that" — Liking the first idea doesn't validate it. Run the convergent stress-test anyway.

## Verification

Confirm the protocol invariants before finishing:

- [ ] One-pager written to the resolved task folder's `CONTEXT.md` per `./references/workflow/context-schema.md` — `**Status:** refined`, `**Domain:**` inferred (or asked when clearly non-code and unclear); an existing `CONTEXT.md` not silently overwritten
- [ ] When a `ticket.md` is present, it was read as the primary input and `## Problem Statement` cites it rather than restating the ask
- [ ] Chat summary carries the literal `Next: /plan-task <token>` handoff line — token = slug for a canonical task, absolute folder path otherwise
- [ ] Multiple directions explored, not just the user's first framing; hidden assumptions listed with how each could be validated
- [ ] "Not Doing" list makes trade-offs explicit, with reasons

## CONTEXT.md Structure

Write the file using the canonical schema in `./references/workflow/context-schema.md`. Adapt section depth to the idea's size — keep the one-pager portion to one page where possible. Fill the sections from the two-phase pass: the "How Might We" problem statement, the recommended direction, the key assumptions, the MVP scope, and the "Not Doing" list.

Write `**Status:** refined` — the one-shot origin marker for a file this skill produced, never mutated after creation. Infer `**Domain:**` from the idea (e.g. `engineering` for a code change, `relocation` or `negotiation` otherwise); default to `engineering` only when the work is code or genuinely ambiguous within a coding context, and when the effort is clearly non-code but the right domain is unclear, **ask** rather than stamping a wrong label.

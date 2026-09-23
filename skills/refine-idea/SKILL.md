---
name: refine-idea
description: Use when asked to refine, ideate, sharpen, or stress-test a vague idea or rough concept before planning.
argument-hint: '[idea or concept] [destination path]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: take the task's `**Domain:**` (default `engineering`; infer from the request when there's no `CONTEXT.md` yet, and record it in the `CONTEXT.md` you write) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, …). If the domain has no pack, run the neutral methodology and say so.

Turn a raw idea into a sharp concept worth building: divergent exploration, convergent evaluation, then a written one-pager at `<task-folder>/CONTEXT.md`, the static grounding `plan-task` and `implement-task` consume. The output is that file on disk, not a chat message; after writing it, summarize briefly and point at it.

## When to Refine (and When Not To)

**Refine when** the idea is vague enough that planning would guess at scope, several framings are plausible and none is chosen, hidden assumptions could kill the idea, or the user wants their thinking stress-tested.

**Skip when** the user already knows what to build or the problem is concrete → `plan-task`; when they ask how something works → `explore`. Say so and recommend the skill directly.

## Output File

**Location:** `<task-folder>/CONTEXT.md`, the folder resolved per the **resolve-or-create** rules in `./references/workflow/task-layout.md`, a new one placed by `./references/workflow/task-destinations.md`.

The slug is 2–5 lowercase kebab-case words capturing the gist (`weekly-digest-email`, `replace-cache-invalidation`). Derive it; do not ask. Create the folder when missing. If a `CONTEXT.md` already exists there, read it first and ask whether to overwrite or pick a different slug.

Label the terminal session for the resolved folder per `./references/workflow/terminal-session.md`.

`CONTEXT.md` holds the chosen direction, its assumptions, the scope decisions made, and the external references the user adds later. Refine through conversation, then write the final version once.

**When the folder holds a `ticket.md`**, read it first as the primary input. `## Problem Statement` cites `./ticket.md` rather than restating it, and `CONTEXT.md` adds the grounding this refinement produces (`./references/workflow/one-home.md` § *One home per fact*).

### What belongs in CONTEXT.md (and what doesn't)

- ✅ The one-pager: problem framing, recommended direction, assumptions, MVP scope, "Not Doing"
- ✅ External references: tickets, threads, PR links, designs, pasted specs and schemas
- ✅ Standing decisions and constraints the plan must respect
- ❌ Implementation notes, approach rationale, step breakdowns, verify criteria: the plan and its result
- ❌ Goals and acceptance criteria: the sibling `goals.md`
- ❌ Conversation summaries or TODO scratchpads

## Process

**Load the destination's shared grounding first.** Once the folder is resolved, read the applicable `GROUP_CONTEXT.md` files, root to task, per `./references/workflow/task-store.md` § *Shared group context*. A destination outside a registered root inherits none. The chain bounds the ideation: it narrows which directions stay viable and marks which assumptions are settled above this task. Where the one-pager leans on an inherited constraint, `## References` cites that file rather than absorbing it (`./references/workflow/context-schema.md`).

Run **Phase 1 (Diverge)** and **Phase 2 (Converge)** from `./references/workflow/ideation.md`, then Phase 3 below. Testable goals are `plan-task`'s, not written here.

### Phase 3 — Sharpen

Write the one-pager to the resolved folder's `CONTEXT.md`, then post this summary so the user can paste the next command. The handoff token is the bare slug where it resolves and the folder's absolute path otherwise (`./references/workflow/task-layout.md` § *One task, one flat folder*):

```
Context: <task-folder>/CONTEXT.md
Slug: <slug>

Next: /plan-task <slug>
```

or, by path:

```
Context: <abs-path>/CONTEXT.md
Slug: <slug>

Next: /plan-task <abs-path>/
```

Do not drop or paraphrase the `Next:` line. The "Not Doing" list is the most valuable part: make trade-offs explicit.

## CONTEXT.md Structure

Copy `./references/templates/CONTEXT.md` and fill it from the two-phase pass: the "How Might We" problem statement, the recommended direction, the key assumptions, the MVP scope, and the "Not Doing" list. Keep the one-pager to about a page.

Infer `**Domain:**` from the idea (`engineering` for a code change, `relocation` or `negotiation` otherwise). Default to `engineering` only for code or ambiguity within a coding context; when the effort is clearly non-code and the domain is unclear, ask rather than stamp a wrong label.

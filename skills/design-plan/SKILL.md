---
name: design-plan
description: Use when asked to plan, design, architect, scope, or break down a feature or change before implementation.
argument-hint: '[task or feature description]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line as a visible confirmation, **before** any other text or tool calls in this skill, on its own line — substitute `<version>` with the value on the **Version** line at the top of `./AGENTS.md`:

    ✅ Core agents-kit@<version> rules applied

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill produces an implementation plan as a file inside `.agents/tasks/<slug>/`. The plan is the contract that `implement-plan` later executes against. Each task directory groups one or more related plans plus a shared `CONTEXT.md`.

The user provides a task or feature request. They may include context about constraints, preferences, or prior discussion.

**CRITICAL**: The output of this skill is a written plan file on disk, not a conversation message. After writing it, summarize the plan briefly in the chat and point at the file.

## References

Before working, read any applicable checklists from `references/engineering/`. Skip ones that don't apply.

## When to Plan (and When Not To)

**Plan when:**

- Task spans multiple files or modules
- Multiple viable approaches exist with meaningful trade-offs
- Changes affect shared code with wide blast radius
- Requirements are ambiguous and need decomposition
- High-risk changes to critical paths

**Skip planning when:**

- Single-file change with obvious implementation
- Bug fix with clear root cause and location
- User has already specified the exact approach
- The task is smaller than the plan would be
- The idea is too vague to scope — run `refine-idea` first, then return here

If the task doesn't warrant a full plan, say so and suggest proceeding directly with implementation.

## Plan File Output

**Location:** `.agents/tasks/<slug>/<task-slug>.plan.md` at the project root.

- `<slug>` — names the **task directory** that holds `CONTEXT.md` plus every plan and result for the effort. Derived from the task: 2–5 lowercase kebab-case words capturing the gist (e.g. `add-csv-export`, `migrate-auth-middleware`, `fix-stale-cache-invalidation`). Don't ask the user — derive it. **If the user passed a slug that resolves to an existing `.agents/tasks/<slug>/` directory (typically from `refine-idea`), reuse it — don't create a new one.**
- `<task-slug>` — names the plan file within the directory. For a single-plan task, mirror the directory name: `.agents/tasks/add-csv-export/add-csv-export.plan.md`. For a directory that holds multiple related plans, use a distinct task slug per plan (e.g. `schema.plan.md`, `api.plan.md`, `ui.plan.md`).
- **Numbering:** prefix `<task-slug>` with `NN-` (e.g. `01-schema.plan.md`, `02-api.plan.md`) **only when** plans must be implemented in a specific blocking order. Omit numbering when plans are independent or can land in any order.

If `.agents/tasks/<slug>/` doesn't exist, create it. If a plan file with the same `<task-slug>` already exists, append a short suffix (`-2`, `-3`).

The plan file is the **contract**. Once written, `implement-plan` consumes it and updates step checkboxes as work completes. Avoid rewriting the plan in place during planning iteration unless the user asks for revisions — refine through conversation, then write the final version.

## Planning Process

### 1. Clarify Requirements

- Restate the task to confirm understanding; separate explicit requirements from assumptions
- List ambiguities — ask before proceeding if critical
- Identify what "done" looks like for this task

### 2. Resolve the Task Directory and Read CONTEXT.md

The task directory `.agents/tasks/<slug>/` is the authoritative home for this plan and any sibling plans. `CONTEXT.md` inside it is the shared context every plan in the directory builds on.

Resolve the directory in this order:

- **User passed a slug that resolves to an existing `.agents/tasks/<slug>/`** — reuse it. Read `CONTEXT.md` if present; treat its problem statement, target user, MVP scope, "Not Doing" list, key assumptions, and any references as inputs. List existing `*.plan.md` files so you don't duplicate or conflict with prior work.
- **User passed a slug with no matching directory** — create `.agents/tasks/<slug>/`. If `CONTEXT.md` doesn't exist, write a skeleton (template below) before drafting the plan. Confirm the slug with the user only if it differs meaningfully from what they typed.
- **User passed no slug** — derive one from the task description and proceed as above.

If multiple `.agents/tasks/*/` directories look like plausible matches for the user's request, list them and ask — don't guess.

#### CONTEXT.md skeleton (created when missing)

The skeleton below is the canonical CONTEXT.md schema, shared with `refine-idea` (which produces it via Phases 1–3) so downstream consumers (`review-plan`, `implement-plan`, and the design-plan reuse step) read the same section names regardless of how the task started. When `design-plan` skips the idea step, populate `Problem Statement` and `Key Assumptions to Validate` from the user's task description; leave the other sections as placeholders for the user to fill in.

```markdown
# <task name>

**Status:** drafted-by-design-plan

## Problem Statement

<one-sentence framing of what this task is solving>

## Target User & Success

- **Who:** <specific user / role — placeholder; ask or fill in when known>
- **Success looks like:** <observable outcome — placeholder; ask or fill in when known>

## Recommended Direction

<the chosen direction and why — leave as a placeholder if the user hasn't run `refine-idea`; revisit before starting work>

## Key Assumptions to Validate

- [ ] <assumption that, if wrong, would invalidate the plan> — <how to test it>

## MVP Scope

- **In:** <minimum to test the core assumption — placeholder; fill in once scope is clear>
- **Out:** <what's deferred — placeholder>

## Not Doing (and Why)

- <intentional exclusion — placeholder; surface explicit trade-offs as the plan develops>

## Open Questions

- <question the plan can't yet answer — placeholder>

## References

_(External links, pasted specs, ticket numbers, screenshots, cross-cutting notes. Read by every plan in this task directory.)_
```

`CONTEXT.md`'s `**Status:**` is a one-shot origin marker; the plan file owns the working lifecycle. Full status vocabulary across all task files is registered in `references/engineering/task-lifecycle.md` — read it once if you're unsure which value to write.

The user is expected to enrich `CONTEXT.md` over time (links, specs, decisions). Don't dump per-step notes, approach rationale, or verify criteria into it — those belong in the plan or its result file. Placeholder sections are intentional: leave them in place even if empty so downstream skills can find the same section names.

### 3. Explore the Codebase

**CRITICAL**: Always ground the plan in what already exists. Read before designing — this is the forward exploration pass; `review-plan` will independently verify assumptions later if invoked.

- Search for related implementations to use as models; map affected files and shared code in the blast radius
- Note existing constraints (tech debt, API contracts, performance budgets)

### 4. Evaluate Approaches

Compare viable approaches — and actively look for ones the user may not have considered.

Even when the user suggests a specific approach, consider whether a different solution would be more optimal. The goal is to arrive at the best implementation, not just validate the first idea. If an alternative is clearly better, recommend it with a clear explanation of why.

**However**, don't fabricate alternatives to fill a comparison table when one approach is clearly right. State it and explain why alternatives don't apply.

For each approach, assess:

- **Alignment** — How well does it match existing codebase patterns?
- **Simplicity** — What's the minimum complexity to meet requirements?
- **Risk** — What could go wrong? How reversible is it?
- **Effort** — Relative size (S/M/L)

### 5. Define Scope

Explicitly state:

- **In scope** — What will be changed
- **Out of scope** — What will NOT be changed, even if related
- **Boundaries** — Where this work ends and future work begins

**IMPORTANT**: Scope definition prevents creep during implementation. Be precise. A vague scope produces vague work.

### 6. Break Down Steps

Create an ordered list of implementation steps. Each step must be a **verifiable piece of work** — after completing it, there's a concrete way to confirm it worked before moving on.

**Order steps as vertical slices, not horizontal layers.** Each step should deliver a complete user-visible (or caller-visible) capability — schema + API + UI for one thing — rather than building all schemas, then all APIs, then all UI. Vertical slicing surfaces integration risk early and keeps the system in a working, demoable state between steps. Use horizontal ordering only when a foundational layer (e.g. shared types, a migration) genuinely has no vertical seam.

For each step:

- **What** — Brief description of the change (one concern per step)
- **Verify** — How to confirm it works (run a test, check a behavior, see output, verify types pass)
- **Depends on** — Prior steps required (if any)

The verification criterion is non-negotiable. If you can't state how to verify a step, it's either too vague or too small to be a step.

Step sizing:

- Too coarse: "Implement the feature" — not actionable, not verifiable as a unit
- Too fine: "Add import statement" — noise, not independently meaningful
- Right size: "Add validation hook with error state for the form fields" — one concern, verifiable by rendering the form and checking error states appear

Break a step down further when any of these are true:

- The title contains "and" (it's two steps wearing one hat)
- It touches two or more independent subsystems (e.g. auth and billing)
- Its acceptance can't be stated in 3 or fewer bullets
- It would touch more than ~5 files

**Step format in the plan file:**

```markdown
### Step 1 — <short title>

- [ ] **What:** <one-sentence change>
- **Verify:** <how to confirm>
- **Depends on:** <prior step numbers, or "none">
```

The leading `- [ ]` checkbox is the marker `implement-plan` flips to `- [x]` when the step is done, with a link to the result file section appended.

### 7. Add Checkpoints

Per-step `Verify` confirms one unit of work. It does **not** catch the case where step 3 silently broke step 1's behavior. For plans with more than ~5 steps, insert a **Checkpoint** every 2–3 steps that re-verifies the integrated system, not just the latest change.

A checkpoint asserts:

- Test suite still passes (not just the test for the latest step)
- Build / typecheck still succeeds
- A concrete end-to-end flow still works (name the flow — "user can log in and see dashboard", not "core flow")

Checkpoints are not steps — they don't get a `- [ ]` checkbox that `implement-plan` flips. They are gates `implement-plan` must pause at to confirm before proceeding to the next batch of steps. Skip them entirely for short plans (≤5 steps) where the final step's verification doubles as an end-to-end check.

**Checkpoint format in the plan file:**

```markdown
### Checkpoint after Step N

- Test suite passes
- Build / typecheck succeeds
- End-to-end: <name the concrete flow — e.g. "user can log in and see dashboard">
```

### 8. Identify Risks

Only flag risks that are **specific to this task** — not generic checklists.

For each real risk:

- What could go wrong (concrete scenario, not vague category)
- How likely it is given what you found in exploration
- How to mitigate or investigate before it becomes a problem

### 9. Flag Open Questions

If the plan has assumptions that could invalidate the approach, surface them explicitly. A plan with known unknowns is more useful than one that hides them.

## Scaling Plan Depth

Match the plan's detail to the task's complexity:

- **Medium** (2-5 files, clear pattern) — Steps 1, 5, 6 — skip approach comparison, light on risks
- **Large** (5-15 files, some ambiguity) — All steps, moderate detail
- **Complex** (architectural, cross-cutting) — All steps, deep exploration, multiple approaches compared

## Don't Rationalize

- "I already know the codebase well enough" — Read the code anyway. Memory drifts; the code is the truth.
- "There's only one way to do this" — If you haven't explored alternatives, you don't know that.
- "The risks are obvious, no need to list them" — Generic risk awareness is not risk identification. Be specific or admit there are none.
- "This is too simple to plan" — If the user asked for a plan, the task warranted one.
- "I'll figure out the scope during implementation" — Undefined scope produces undefined work. Bound it now.
- "I'll just output the plan in chat" — The plan must be a file. `implement-plan` reads it from disk.

## Verification

- [ ] Task directory `.agents/tasks/<slug>/` exists (reused if it already existed, created otherwise)
- [ ] `CONTEXT.md` present in the task directory; skeleton written if it didn't exist
- [ ] Plan written to `.agents/tasks/<slug>/<task-slug>.plan.md` — mirroring the directory name for single-plan tasks, distinct task slug per plan otherwise
- [ ] Numbering prefix (`NN-`) used **only** when plans have a blocking order
- [ ] Slug derived from task, kebab-case, 2–5 words
- [ ] Each step has `- [ ]` checkbox marker, **What**, **Verify**, **Depends on**
- [ ] Plan is grounded in actual code exploration, not assumptions
- [ ] Each step is independently verifiable
- [ ] Steps are ordered as vertical slices unless a foundational layer requires otherwise
- [ ] No step violates the size cap (no "and" in title, ≤1 subsystem, ≤5 files, ≤3-bullet acceptance)
- [ ] Plans with >5 steps include checkpoints every 2–3 steps that re-verify the integrated system
- [ ] Scope boundaries are explicit (in/out of scope stated)
- [ ] Risks are specific to this task, not generic checklists
- [ ] Open questions that could invalidate the approach are surfaced

## Plan File Structure

Write the file with this top-level layout. Adapt sections to task size — not every plan needs every section.

```markdown
# <task title>

**Status:** to-do
**Context:** [./CONTEXT.md](./CONTEXT.md)
**Result:** _(populated by `implement-plan`: link to `./<task-slug>.result.md`)_

## Task Understanding

<restatement and any clarifying notes>

## Exploration Findings

<key patterns, affected files, constraints discovered>

## Approach

<recommended approach with rationale; comparison table only if multiple viable options>

## Scope

- **In scope:** ...
- **Out of scope:** ...
- **Boundaries:** ...

## Steps

### Step 1 — <title>

- [ ] **What:** ...
- **Verify:** ...
- **Depends on:** none

### Step 2 — <title>

- [ ] **What:** ...
- **Verify:** ...
- **Depends on:** Step 1

### Checkpoint after Step 2 _(only for plans >5 steps)_

- Test suite passes
- Build / typecheck succeeds
- End-to-end: <name the concrete flow>

## Risks

- ...

## Open Questions

- ...
```

The plan file's `**Status:**` value (`to-do` here) is part of the lifecycle owned by `implement-plan`. Full vocabulary and transitions for plan and result files are registered in `references/engineering/task-lifecycle.md` — that's the single source of truth across all task artifacts.

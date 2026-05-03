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
3. Output the following line verbatim to the user as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core rules applied (./AGENTS.md)

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill produces an implementation plan as a file in `.agents/plans/`. The plan is the contract that `implement-plan` later executes against.

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

**Location:** `.agents/plans/<slug>.md` at the project root.

- `<slug>` — derived from the task: 2–5 lowercase kebab-case words capturing the gist (e.g. `add-csv-export`, `migrate-auth-middleware`, `fix-stale-cache-invalidation`). Don't ask the user — derive it.

If `.agents/plans/` doesn't exist, create it. If a plan with the same slug already exists, append a short suffix (`-2`, `-3`).

The plan file is the **contract**. Once written, `implement-plan` consumes it and updates step checkboxes as work completes. Avoid rewriting the plan in place during planning iteration unless the user asks for revisions — refine through conversation, then write the final version.

## Planning Process

### 1. Clarify Requirements

- Restate the task to confirm understanding; separate explicit requirements from assumptions
- List ambiguities — ask before proceeding if critical
- Identify what "done" looks like for this task

### 2. Check for a Refined Idea

A one-pager from `refine-idea` (in `.agents/ideas/<slug>.md`) is the authoritative input for this plan when one exists. **Don't try to auto-discover it** — slugs re-derived from a task phrasing don't reliably match the slug `refine-idea` chose, and silently picking the wrong file is worse than picking none.

The user must pass the source explicitly — either a slug (e.g. `/design-plan weekly-digest-email`) or a path (`/design-plan .agents/ideas/weekly-digest-email.md`):

- **User passed a slug or path that resolves to a file** — read it; treat its problem statement, target user, MVP scope, "Not Doing" list, and key assumptions as inputs to the plan. Don't re-derive scope from scratch.
- **User passed a slug or path that doesn't resolve** — say so, list the `*.md` files in `.agents/ideas/` (if any), and ask which one (if any) was meant. None is a valid answer.
- **User passed no slug or path** — proceed without a one-pager; do not block, do not auto-pick from `.agents/ideas/`. If you suspect there should be one, ask once.

The one-pager's `**Plan:**` field is intentionally a placeholder until this skill writes the plan. After writing the plan file (final step below), update that field in place to link the new `.agents/plans/<slug>.md`.

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

- [ ] Plan written to `.agents/plans/<slug>.md`
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
- [ ] If a `refine-idea` one-pager was used as input, its `**Plan:**` field now links to the new plan file

## Plan File Structure

Write the file with this top-level layout. Adapt sections to task size — not every plan needs every section.

```markdown
# <task title>

**Status:** ready
**Result:** _(populated by `implement-plan`: link to `<slug>.result.md`)_

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

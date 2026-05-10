---
name: plan-task
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

This skill produces an implementation plan as a file inside `.agents/tasks/<slug>/`, paired with a sibling **spec file** that captures the testable acceptance criteria. The plan is the contract that `implement-plan` later executes against; the spec is the contract for what "done" means. Each task directory groups one or more related plans (each with its own spec) plus a shared `CONTEXT.md`.

The user provides a task or feature request. They may include context about constraints, preferences, or prior discussion.

**CRITICAL**: The output of this skill is two written files on disk — `<task-slug>.spec.md` and `<task-slug>.plan.md` — not a conversation message. After writing them, summarize briefly in the chat and point at the files.

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

## Output Files

This skill writes **two paired files** per plan: a spec and a plan. Both live in `.agents/tasks/<slug>/` at the project root.

- `<slug>` — names the **task directory** that holds `CONTEXT.md` plus every plan, spec, and result for the effort. Derived from the task: 2–5 lowercase kebab-case words capturing the gist (e.g. `add-csv-export`, `migrate-auth-middleware`, `fix-stale-cache-invalidation`). Don't ask the user — derive it. **If the user passed a slug that resolves to an existing `.agents/tasks/<slug>/` directory (typically from `refine-idea`), reuse it — don't create a new one.**
- `<task-slug>` — names the file pair within the directory. For a single-plan task, mirror the directory name: `.agents/tasks/add-csv-export/add-csv-export.{spec,plan}.md`. For a directory that holds multiple related plans, use a distinct task slug per pair (e.g. `schema.{spec,plan}.md`, `api.{spec,plan}.md`, `ui.{spec,plan}.md`).
- **Numbering:** prefix `<task-slug>` with `NN-` (e.g. `01-schema.plan.md`, `02-api.plan.md`) **only when** plans must be implemented in a specific blocking order. Omit numbering when plans are independent or can land in any order. The spec file uses the same prefix.

If `.agents/tasks/<slug>/` doesn't exist, create it. If a spec or plan file with the same `<task-slug>` already exists, append a short suffix (`-2`, `-3`) — keep the spec/plan stems matched.

**Spec file (`<task-slug>.spec.md`)** — the contract for what "done" means. Carries a short task description and a free-form bullet list of acceptance criteria. **No `**Status:**` field.** The user may hand-author it; if they do, this skill reads and respects it instead of regenerating.

**Plan file (`<task-slug>.plan.md`)** — the contract for how the work is executed. Once written, `implement-plan` consumes it and updates step checkboxes as work completes. Avoid rewriting the plan in place during planning iteration unless the user asks for revisions — refine through conversation, then write the final version.

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

The skeleton below is the canonical CONTEXT.md schema, shared with `refine-idea` (which produces it via Phases 1–3) so downstream consumers (`review-plan`, `implement-plan`, and the plan-task reuse step) read the same section names regardless of how the task started. When `plan-task` skips the idea step, populate `Problem Statement` and `Key Assumptions to Validate` from the user's task description; leave the other sections as placeholders for the user to fill in.

```markdown
# <task name>

**Status:** drafted-by-plan-task

## Problem Statement

<one-sentence framing of what this task is solving>

## Acceptance Criteria

_(Per-plan acceptance criteria live in each plan's `<task-slug>.spec.md`. This skill drafts that spec before the plan and asks for clarification when requirements are unclear.)_

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

### 3. Draft the Spec

Before designing the plan, write `.agents/tasks/<slug>/<task-slug>.spec.md` — the contract for what "done" means. This pins requirements before approach selection so steps and verification can be derived from concrete acceptance criteria, not from a moving target.

**Resolve in this order:**

- **Spec already exists for this `<task-slug>`** (hand-authored or from a prior session) — read it, apply `references/engineering/acceptance-criteria.md` to each criterion, restate the criteria back to the user (calling out any that fail the checklist), and ask whether to proceed as-is or revise. Do not silently overwrite.
- **No spec exists** — draft one from the user's task description and any signal in `CONTEXT.md` (problem statement, recommended direction, key assumptions). Run each draft criterion through `references/engineering/acceptance-criteria.md` before writing the file; ask clarifying questions for any criterion that fails the checklist (testable, specific, outcome-oriented, singular, bounded, stated as behavior).

**Clarifying questions** — ask only when needed, batched into a single round. Each question must:

- Reference the specific criterion (or missing criterion) it addresses.
- Explain why the answer matters (which criterion it sharpens, which step it would change).
- Suggest options when possible — "should bulk export include archived rows? A: yes, with a flag; B: no, archived stays excluded; A matches the existing single-row export, B matches the UI filter default" — not open-ended "what should we do?"

If the user answers in chat, update the spec to reflect the answers before moving on. If the user defers a question, leave the affected criterion marked with a trailing `_(unresolved: <short note>)_` so `review-plan` and `implement-plan` see it.

**Spec file content:**

- A short task description (2–3 sentences — what this plan delivers and for whom)
- A free-form bullet list of acceptance criteria — short, observable, externally-verifiable statements

Keep criteria **outcome-oriented**, not implementation-oriented. "User can export the current filter as CSV with a custom delimiter" is good. "Add a `formatCsv()` helper" is not — that belongs in the plan's steps.

**Spec file template:**

```markdown
# Spec: <task title>

**Plan:** [./<task-slug>.plan.md](./<task-slug>.plan.md)

## Description

<2–3 sentence summary of what this plan delivers and for whom>

## Acceptance Criteria

- <Criterion 1 — short, observable, externally-verifiable>
- <Criterion 2>
- <Criterion 3>
```

The spec carries no `**Status:**` field by design — it is a static input, not a lifecycle artifact. The user mutates it freely between sessions; downstream skills (`review-plan`, `implement-plan`, `resume-task`) read it but never write to it.

### 4. Explore the Codebase

**CRITICAL**: Always ground the plan in what already exists. Read before designing — this is the forward exploration pass; `review-plan` will independently verify assumptions later if invoked.

- Search for related implementations to use as models; map affected files and shared code in the blast radius
- Note existing constraints (tech debt, API contracts, performance budgets)

### 5. Evaluate Approaches

Compare viable approaches — and actively look for ones the user may not have considered.

Even when the user suggests a specific approach, consider whether a different solution would be more optimal. The goal is to arrive at the best implementation, not just validate the first idea. If an alternative is clearly better, recommend it with a clear explanation of why.

**However**, don't fabricate alternatives to fill a comparison list when one approach is clearly right. State it and explain why alternatives don't apply.

For each approach, assess:

- **Alignment** — How well does it match existing codebase patterns?
- **Simplicity** — What's the minimum complexity to meet requirements?
- **Risk** — What could go wrong? How reversible is it?
- **Effort** — Relative size (S/M/L)

### 6. Define Scope

Explicitly state:

- **In scope** — What will be changed
- **Out of scope** — What will NOT be changed, even if related
- **Boundaries** — Where this work ends and future work begins

**IMPORTANT**: Scope definition prevents creep during implementation. Be precise. A vague scope produces vague work.

### 7. Break Down Steps

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

### 8. Add Checkpoints

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

### 9. Identify Risks

Only flag risks that are **specific to this task** — not generic checklists.

For each real risk:

- What could go wrong (concrete scenario, not vague category)
- How likely it is given what you found in exploration
- How to mitigate or investigate before it becomes a problem

### 10. Flag Open Questions

If the plan has assumptions that could invalidate the approach, surface them explicitly. A plan with known unknowns is more useful than one that hides them.

## Scaling Plan Depth

Match the plan's detail to the task's complexity. The spec step (Step 3) is required at every depth — even small tasks benefit from a few explicit acceptance criteria.

- **Medium** (2-5 files, clear pattern) — Steps 1–3, 6, 7 — skip approach comparison, light on risks
- **Large** (5-15 files, some ambiguity) — All steps, moderate detail
- **Complex** (architectural, cross-cutting) — All steps, deep exploration, multiple approaches compared

## Don't Rationalize

- "I already know the codebase well enough" — Read the code anyway. Memory drifts; the code is the truth.
- "There's only one way to do this" — If you haven't explored alternatives, you don't know that.
- "The risks are obvious, no need to list them" — Generic risk awareness is not risk identification. Be specific or admit there are none.
- "This is too simple to plan" — If the user asked for a plan, the task warranted one.
- "I'll figure out the scope during implementation" — Undefined scope produces undefined work. Bound it now.
- "I'll skip the spec, the plan steps make it obvious" — Steps describe how to get there; criteria describe what done means. Without criteria, `implement-plan` has no acceptance gate and `review-plan` has nothing to check coverage against.
- "The acceptance criteria are obvious" — If they're obvious, they cost nothing to write down. If they're not, that's exactly when you needed them.
- "The criterion is roughly the right shape, that's good enough" — Run it through `references/engineering/acceptance-criteria.md`. Vague criteria survive coverage analysis and pass the acceptance gate by reinterpretation; that's the failure mode the checklist catches.
- "The user gave a vague task, I'll just guess what they want" — Ask. Clarifying questions during the spec step are cheaper than reworking the plan after implementation.
- "I'll just output the plan and spec in chat" — Both must be files on disk. `implement-plan` and `review-plan` read them from there.

## Verification

- [ ] Task directory `.agents/tasks/<slug>/` exists (reused if it already existed, created otherwise)
- [ ] `CONTEXT.md` present in the task directory; skeleton written if it didn't exist
- [ ] Spec written to `.agents/tasks/<slug>/<task-slug>.spec.md` — short description + free-form bullet criteria, no `**Status:**` field
- [ ] Hand-authored spec read and respected if present; not silently overwritten
- [ ] Each acceptance criterion in the spec passes the checks in `references/engineering/acceptance-criteria.md`, or is marked `_(unresolved: ...)_` with a deferred clarifying question
- [ ] Clarifying questions asked when criteria failed the checklist (testable, specific, outcome-oriented, singular, bounded, stated as behavior); user answers folded into the spec before drafting the plan
- [ ] Plan written to `.agents/tasks/<slug>/<task-slug>.plan.md` — stem matches its sibling spec
- [ ] Plan's `**Spec:**` line links to `./<task-slug>.spec.md`
- [ ] Numbering prefix (`NN-`) used **only** when plans have a blocking order; spec and plan share the same prefix
- [ ] Slug derived from task, kebab-case, 2–5 words
- [ ] Each step has `- [ ]` checkbox marker, **What**, **Verify**, **Depends on**
- [ ] Plan steps collectively cover every criterion in the spec (no orphan criteria)
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
**Spec:** [./<task-slug>.spec.md](./<task-slug>.spec.md)
**Result:** _(populated by `implement-plan`: link to `./<task-slug>.result.md`)_

## Task Understanding

<restatement and any clarifying notes>

## Exploration Findings

<key patterns, affected files, constraints discovered>

## Approach

<recommended approach with rationale; side-by-side bullet list of alternatives only if multiple viable options>

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

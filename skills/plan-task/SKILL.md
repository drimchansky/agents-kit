---
name: plan-task
description: Use when asked to plan, design, architect, scope, or break down a feature or change before implementation.
argument-hint: '[task or feature description, task directory]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, `planning.md`, …). If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill produces an implementation plan inside a resolved task directory, paired with a sibling **spec file** that captures the testable acceptance criteria. The plan is the contract that `implement-task` later executes against; the spec is the contract for what "done" means. Each task directory groups one or more related plans (each with its own spec) plus a shared `CONTEXT.md`.

The user provides a task or feature request. They may include context about constraints, preferences, or prior discussion.

**CRITICAL**: The output of this skill is two written files on disk — `<task-slug>.spec.md` and `<task-slug>.plan.md` — not a conversation message. After writing them, summarize briefly in the chat and point at the files.

## When to Plan (and When Not To)

**Plan when:**

- The work spans multiple areas or artifacts
- Multiple viable approaches exist with meaningful trade-offs
- Changes affect shared or foundational pieces with wide blast radius
- Requirements are ambiguous and need decomposition
- High-risk or hard-to-reverse changes

**Skip planning when:**

- Single, obvious change
- The cause and the fix are already clear and localized
- User has already specified the exact approach
- The task is smaller than the plan would be
- The idea is too vague to scope — run `refine-idea` first, then return here

When the domain is code, `./references/engineering/planning.md` gives the engineering-specific version of these heuristics (file counts, root-cause bug fixes).

If the task doesn't warrant a full plan, say so and suggest proceeding directly with implementation.

## Output Files

This skill writes **two paired files** per plan: a spec and a plan. Both live in the resolved task directory — either standalone at `.agents/tasks/<slug>/` or inside a project group at `.agents/tasks/<project>/<slug>/`.

- `<slug>` — names the **task directory** that holds `CONTEXT.md` plus every plan, spec, and result for the effort. Derived from the task: 2–5 lowercase kebab-case words capturing the gist (e.g. `add-csv-export`, `migrate-auth-middleware`, `fix-stale-cache-invalidation`). Don't ask the user — derive it. **If the user passed a slug that resolves to an existing active task directory (typically from `refine-idea`), reuse it — don't create a new one.**
- `<task-slug>` — names the file pair within the directory. For a single-plan task, mirror the directory name: `.agents/tasks/add-csv-export/add-csv-export.{spec,plan}.md`. For a directory that holds multiple related plans, use a distinct task slug per pair (e.g. `schema.{spec,plan}.md`, `api.{spec,plan}.md`, `ui.{spec,plan}.md`).
- **Numbering:** prefix `<task-slug>` with `NN-` (e.g. `01-schema.plan.md`, `02-api.plan.md`) **only when** plans must be implemented in a specific blocking order. Omit numbering when plans are independent or can land in any order. The spec file uses the same prefix.

If no matching active task directory exists, create `.agents/tasks/<slug>/` by default. If a spec or plan file with the same `<task-slug>` already exists, append a short suffix (`-2`, `-3`) — keep the spec/plan stems matched.

**Spec file (`<task-slug>.spec.md`)** — the contract for what "done" means. Carries a short task description and a free-form bullet list of acceptance criteria. **No `**Status:**` field.** The user may hand-author it; if they do, this skill reads and respects it instead of regenerating.

**Plan file (`<task-slug>.plan.md`)** — the contract for how the work is executed. Once written, `implement-task` consumes it and updates step checkboxes as work completes. Avoid rewriting the plan in place during planning iteration unless the user asks for revisions — refine through conversation, then write the final version.

## Planning Process

### 1. Clarify Requirements

- Restate the task to confirm understanding; separate explicit requirements from assumptions
- List ambiguities — ask before proceeding if critical
- Identify what "done" looks like for this task

### 2. Resolve the Task Directory and Read CONTEXT.md

The resolved task directory is the authoritative home for this plan and any sibling plans. `CONTEXT.md` inside it is the shared context every plan in the directory builds on.

Resolve the directory in this order:

- **User passed a task directory path** — use it if it points at a task directory (standalone or inside a project group). If it points inside `archive/`, confirm before adding new work to an archived task.
- **User passed a slug** — resolve it against active task directories per `./references/workflow/task-layout.md`: standalone `.agents/tasks/<slug>/` first, then project task subdirectories `.agents/tasks/*/<slug>/`, excluding `archive/`. If exactly one matches, reuse it. If multiple match, list them and ask — don't guess. If none match, look inside `archive/`; if an archived task matches, ask whether to revive it or create a fresh active task.
- **User passed a slug with no matching active or archived directory** — create `.agents/tasks/<slug>/`. If `CONTEXT.md` doesn't exist, write a skeleton (template below) before drafting the plan. Confirm the slug with the user only if it differs meaningfully from what they typed.
- **User passed no slug** — derive one from the task description and proceed as above.

If multiple active task directories look like plausible matches for the user's request, list them and ask — don't guess.

Task directories may be standalone or grouped under a project with a shared `PROJECT.md`, and finished tasks may live in an `archive/` subdirectory. When listing candidates, exclude `archive/` and descend into a project group's task subdirectories; look inside `archive/` only when a requested slug isn't among the active directories. See `./references/workflow/task-layout.md`.

If the resolved `CONTEXT.md` carries a `**Project:**` header, read the linked `PROJECT.md` too — it is the shared project-level context (charter, decision log, cross-task references) that sits above this task's `CONTEXT.md` and is authoritative for anything spanning more than one task.

#### CONTEXT.md skeleton (created when missing)

The skeleton below is the canonical CONTEXT.md schema, shared with `refine-idea` (which produces it via Phases 1–3) so downstream consumers (`review-task`, `implement-task`, and the plan-task reuse step) read the same section names regardless of how the task started. When `plan-task` skips the idea step, infer `**Domain:**` from the task description (see the guidance below the skeleton) and populate `Problem Statement` and `Key Assumptions to Validate` from it; leave the other sections as placeholders for the user to fill in.

```markdown
# <task name>

**Status:** drafted-by-plan-task
**Domain:** <domain>

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

`CONTEXT.md`'s `**Status:**` is a one-shot origin marker; the plan file owns the working lifecycle. Full status vocabulary across all task files is registered in `./references/workflow/task-lifecycle.md` — read it once if you're unsure which value to write. The `**Domain:**` line names which domain pack every skill in this directory loads. **Infer it from the task description** (e.g. `engineering` for a code change, `bureaucracy` for a residence application), or carry over the value if `refine-idea` already set one. Default to `engineering` when the work is code or the domain is genuinely ambiguous *within a coding context* — but when the task is clearly non-code and the right domain is unclear, **ask** rather than stamping a label, since a wrong `**Domain:**` silently loads the wrong rules. See `./references/workflow/domain-packs.md`.

When this task is part of a project group — a directory with a shared `PROJECT.md` and sibling task directories — add a `**Project:** [../PROJECT.md](../PROJECT.md)` line directly under `**Domain:**` so downstream skills load the shared project context. Omit it for a standalone task. See `./references/workflow/task-layout.md`.

The user is expected to enrich `CONTEXT.md` over time (links, specs, decisions). Don't dump per-step notes, approach rationale, or verify criteria into it — those belong in the plan or its result file. Placeholder sections are intentional: leave them in place even if empty so downstream skills can find the same section names.

### 3. Draft the Spec

Before designing the plan, write `<task-dir>/<task-slug>.spec.md` — the contract for what "done" means. This pins requirements before approach selection so steps and verification can be derived from concrete acceptance criteria, not from a moving target.

**Resolve in this order:**

- **Spec already exists for this `<task-slug>`** (hand-authored or from a prior session) — read it, apply `./references/workflow/acceptance-criteria.md` to each criterion, restate the criteria back to the user (calling out any that fail the checklist), and ask whether to proceed as-is or revise. Do not silently overwrite.
- **No spec exists** — draft one from the user's task description and any signal in `CONTEXT.md` (problem statement, recommended direction, key assumptions). Run each draft criterion through `./references/workflow/acceptance-criteria.md` before writing the file; ask clarifying questions for any criterion that fails the checklist (testable, specific, outcome-oriented, singular, bounded, stated as behavior).

**Clarifying questions** — ask only when needed, batched into a single round. Each question must:

- Reference the specific criterion (or missing criterion) it addresses.
- Explain why the answer matters (which criterion it sharpens, which step it would change).
- Suggest options when possible — "should bulk export include archived rows? A: yes, with a flag; B: no, archived stays excluded; A matches the existing single-row export, B matches the UI filter default" — not open-ended "what should we do?"

If the user answers in chat, update the spec to reflect the answers before moving on. If the user defers a question, leave the affected criterion marked with a trailing `_(unresolved: <short note>)_` so `review-task` and `implement-task` see it.

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

The spec carries no `**Status:**` field by design — it is a static input, not a lifecycle artifact. The user mutates it freely between sessions; downstream skills (`review-task`, `implement-task`, `resume-task`) read it but never write to it.

### 4. Explore the Domain's Reality

**CRITICAL**: Always ground the plan in what already exists. Explore before designing — this is the forward exploration pass; `review-task` will independently verify assumptions later if invoked. Follow the resolved domain's exploration guide; when the domain is code, that's `./references/engineering/exploration.md`.

- Search for related prior work to use as a model; map what the change will affect (its blast radius)
- Note existing constraints (debt, contracts, budgets, prior commitments)

### 5. Evaluate Approaches

Compare viable approaches — and actively look for ones the user may not have considered.

Even when the user suggests a specific approach, consider whether a different solution would be more optimal. The goal is to arrive at the best implementation, not just validate the first idea. If an alternative is clearly better, recommend it with a clear explanation of why.

**However**, don't fabricate alternatives to fill a comparison list when one approach is clearly right. State it and explain why alternatives don't apply.

For each approach, assess:

- **Alignment** — How well does it match existing patterns and conventions?
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

Create an ordered list of steps. Each step must be a **verifiable piece of work** — after completing it, there's a concrete way to confirm it worked before moving on.

**Order steps as vertical slices, not horizontal layers.** Each step should deliver a complete, observable outcome — one whole thing end to end — rather than building all of one layer, then all of the next. Vertical slicing surfaces integration risk early and keeps the work in a usable, demoable state between steps. Use layered ordering only when a foundational piece genuinely has no vertical seam.

For each step:

- **What** — Brief description of the change (one concern per step)
- **Verify** — How to confirm it works. The criterion is non-negotiable; if you can't state how to verify a step, it's too vague or too small to be a step.
- **Depends on** — Prior steps required (if any)

Break a step down further when: its title contains "and" (two steps wearing one hat); it touches two or more independent subsystems; or its acceptance can't be stated in 3 or fewer bullets. When the domain is code, `./references/engineering/planning.md` adds the engineering sizing guidance (a ~5-file cap, the concrete `Verify` recipe, and worked too-coarse / too-fine / right-size examples).

**Step format in the plan file:**

```markdown
### Step 1 — <short title>

- [ ] **What:** <one-sentence change>
- **Verify:** <how to confirm>
- **Depends on:** <prior step numbers, or "none">
- **Due:** <date the step must finish by, or "none">
- **Lead time:** <how long the step takes once started — e.g. "visa: ~8 weeks", or "none">
```

The leading `- [ ]` checkbox is the marker `implement-task` flips to `- [x]` when the step is done, with a link to the result file section appended.

`**Due:**` and `**Lead time:**` are **optional**. Omit them (or set `none`) for code work, where steps are ordered by `Depends on:`, not the calendar. They earn their place in time-anchored domains (a relocation, an event) where deadlines and external lead times — not just logical dependencies — drive ordering and surface the long-pole steps that must start early. They are planning information the actor reads; nothing in the kit schedules off them.

### 8. Add Checkpoints

Per-step `Verify` confirms one unit of work. It does **not** catch the case where step 3 silently broke step 1's outcome. For plans with more than ~5 steps, insert a **Checkpoint** every 2–3 steps that re-verifies the integrated whole, not just the latest change.

A checkpoint re-asserts that everything done so far still holds together — including a concrete end-to-end outcome, named ("user can log in and see dashboard", not "core flow"). When the domain is code, the specific assertions are in `./references/engineering/planning.md` (full test suite passes, build / typecheck succeeds, the named flow runs end to end).

Checkpoints are not steps — they get no `- [ ]` checkbox that `implement-task` flips. They are gates `implement-task` must pause at to confirm before proceeding to the next batch of steps. Skip them entirely for short plans (≤5 steps) where the final step's verification doubles as an end-to-end check.

**Checkpoint format in the plan file:**

```markdown
### Checkpoint after Step N

- <assertion that the integrated whole still holds>
- End-to-end: <name the concrete outcome — e.g. "user can log in and see dashboard">
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

- **Medium** (small, clear pattern) — Steps 1–3, 6, 7 — skip approach comparison, light on risks
- **Large** (bigger, some ambiguity) — All steps, moderate detail
- **Complex** (cross-cutting, structural) — All steps, deep exploration, multiple approaches compared

When the domain is code, `./references/engineering/planning.md` gives file-count proxies for these tiers.

## Don't Rationalize

- "I already know what's there well enough" — Check anyway. Memory drifts; the current reality is the truth.
- "There's only one way to do this" — If you haven't explored alternatives, you don't know that.
- "The risks are obvious, no need to list them" — Generic risk awareness is not risk identification. Be specific or admit there are none.
- "This is too simple to plan" — If the user asked for a plan, the task warranted one.
- "I'll figure out the scope during implementation" — Undefined scope produces undefined work. Bound it now.
- "I'll skip the spec, the plan steps make it obvious" — Steps describe how to get there; criteria describe what done means. Without criteria, `implement-task` has no acceptance gate and `review-task` has nothing to check coverage against.
- "The acceptance criteria are obvious" — If they're obvious, they cost nothing to write down. If they're not, that's exactly when you needed them.
- "The criterion is roughly the right shape, that's good enough" — Run it through `./references/workflow/acceptance-criteria.md`. Vague criteria survive coverage analysis and pass the acceptance gate by reinterpretation; that's the failure mode the checklist catches.
- "The user gave a vague task, I'll just guess what they want" — Ask. Clarifying questions during the spec step are cheaper than reworking the plan after implementation.
- "I'll just output the plan and spec in chat" — Both must be files on disk. `implement-task` and `review-task` read them from there.

## Verification

- [ ] Resolved task directory exists (reused if it already existed, created otherwise)
- [ ] `CONTEXT.md` present in the task directory; skeleton written if it didn't exist
- [ ] `**Domain:**` inferred from the task and written (carried over from `refine-idea` if set; asked when the task is clearly non-code and the domain is ambiguous, never silently defaulted to `engineering` for non-code work)
- [ ] For a project-grouped task: `**Project:**` header added to `CONTEXT.md` and the linked `PROJECT.md` read for context
- [ ] Spec written to `<task-dir>/<task-slug>.spec.md` — short description + free-form bullet criteria, no `**Status:**` field
- [ ] Hand-authored spec read and respected if present; not silently overwritten
- [ ] Each acceptance criterion in the spec passes the checks in `./references/workflow/acceptance-criteria.md`, or is marked `_(unresolved: ...)_` with a deferred clarifying question
- [ ] Clarifying questions asked when criteria failed the checklist (testable, specific, outcome-oriented, singular, bounded, stated as behavior); user answers folded into the spec before drafting the plan
- [ ] Plan written to `<task-dir>/<task-slug>.plan.md` — stem matches its sibling spec
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
**Result:** _(populated by `implement-task`: link to `./<task-slug>.result.md`)_

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
- **Due:** none _(optional; date the step must finish by)_
- **Lead time:** none _(optional; how long it takes once started)_

### Step 2 — <title>

- [ ] **What:** ...
- **Verify:** ...
- **Depends on:** Step 1

### Checkpoint after Step 2 _(only for plans >5 steps)_

- <assertion that the integrated whole still holds>
- End-to-end: <name the concrete outcome>

## Risks

- ...

## Open Questions

- ...
```

The plan file starts at `to-do` (written by this skill); `implement-task` then drives it through `executing` to `done`. If the user decides not to proceed **before execution begins** — a triage or scoping call, such as dropping a now-obsolete sibling plan — set the plan's `**Status:**` to `skipped` rather than deleting it or leaving a stale `to-do`; add a `<task-slug>.result.md` only if it's worth recording why. Full vocabulary and transitions for plan and result files are registered in `./references/workflow/task-lifecycle.md` — that's the single source of truth across all task artifacts.

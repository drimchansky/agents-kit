---
name: plan-task
description: Use when asked to plan, design, architect, scope, or break down a feature or change before implementation.
argument-hint: '[task or feature description, task folder]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, `planning.md`, …). If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill produces an implementation plan inside a resolved task folder, paired with a sibling **goals file** that captures the testable acceptance criteria. The plan is the contract that `implement-task` later executes against; the goals file is the contract for what "done" means. Each task folder holds one plan (with its goals) plus a `CONTEXT.md`; a multi-part effort becomes several sibling task folders, not many plans in one folder.

The user provides a task or feature request. They may include context about constraints, preferences, or prior discussion.

**CRITICAL**: The output of this skill is two written files on disk — `goals.md` and `plan.md` — not a conversation message. After writing them, summarize briefly in the chat and point at the files.

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

This skill writes **two paired files** per plan: a goals file and a plan. Both live in the resolved task folder at `.agents/tasks/<slug>/`, alongside its `CONTEXT.md`, under fixed role names.

- `<slug>` — names the **task folder** that holds `CONTEXT.md` plus the goals, plan, and result for the effort. Derived from the task: 2–5 lowercase kebab-case words capturing the gist (e.g. `add-csv-export`, `migrate-auth-middleware`, `fix-stale-cache-invalidation`). Don't ask the user — derive it. **If the user passed a slug that resolves to an existing active task folder (typically from `refine-idea`), reuse it — don't create a new one.**
- **Fixed file names.** Inside the folder the goals file and plan are always `goals.md` and `plan.md` — role names, no slug prefix, one plan per folder (so `.agents/tasks/add-csv-export/goals.md` and `.../plan.md`). Skills find them by these fixed names, never by a path someone typed.
- **Multi-part efforts.** When the work won't fit one plan, split it into several sibling task folders (one plan each), not multiple plans in one folder. Ordering between siblings lives in their folder names — see `./references/workflow/task-layout.md`.

If no matching active task folder exists, create `.agents/tasks/<slug>/` by default. If the slug collides with an existing folder for a different effort, pick a more specific slug.

**Goals file (`goals.md`)** — the contract for what "done" means. Carries a `## Goals` list of durably-ID'd `G<n>` acceptance criteria, with no description prose. **No `**Status:**` field.** The user may hand-author it; if they do, this skill reads and respects it instead of regenerating.

**Plan file (`plan.md`)** — the contract for how the work is executed. Once written, `implement-task` consumes it and updates step checkboxes as work completes. Avoid rewriting the plan in place during planning iteration unless the user asks for revisions — refine through conversation, then write the final version.

## Planning Process

### 1. Clarify Requirements

- Restate the task to confirm understanding; separate explicit requirements from assumptions
- List ambiguities — ask before proceeding if critical
- Identify what "done" looks like for this task

### 2. Resolve the Task Folder and Read CONTEXT.md

The resolved task folder is the authoritative home for this plan. `CONTEXT.md` inside it is the static context this plan builds on.

Resolve the folder in this order:

- **User passed a task folder path** — use it if it points at a task folder. If it points inside `archive/`, confirm before adding new work to an archived task.
- **User passed a slug** — resolve it to `.agents/tasks/<slug>/`, excluding `archive/`. If it matches an active folder, reuse it. If none matches, look inside `.agents/tasks/archive/<slug>/`; if an archived task matches, ask whether to revive it or create a fresh active task. See `./references/workflow/task-layout.md`.
- **User passed a slug with no matching active or archived folder** — create `.agents/tasks/<slug>/`. If `CONTEXT.md` doesn't exist, write a skeleton (template below) before drafting the plan. Confirm the slug with the user only if it differs meaningfully from what they typed.
- **User passed no slug** — derive one from the task description and proceed as above.

If multiple active task folders look like plausible matches for the user's request, list them and ask — don't guess.

#### CONTEXT.md skeleton (created when missing)

The skeleton below is the canonical CONTEXT.md schema, shared with `refine-idea` (which produces it via Phases 1–3) so downstream consumers (`review-task`, `implement-task`, and the plan-task reuse step) read the same section names regardless of how the task started. When `plan-task` skips the idea step, infer `**Domain:**` from the task description (see the guidance below the skeleton) and populate `Problem Statement` and `Key Assumptions to Validate` from it; leave the other sections as placeholders for the user to fill in.

```markdown
# <task name>

**Status:** drafted-by-plan-task
**Domain:** <domain>

## Problem Statement

<one-sentence framing of what this task is solving>

## Goals

_(Goals live in `goals.md`. This skill drafts that file before the plan and asks for clarification when requirements are unclear.)_

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

_(External links, pasted specs, ticket numbers, screenshots, cross-cutting notes. Read by the plan and its result in this task folder.)_
```

`CONTEXT.md`'s `**Status:**` is a one-shot origin marker; the plan file owns the working lifecycle. Full status vocabulary across all task files is registered in `./references/workflow/task-lifecycle.md` — read it once if you're unsure which value to write. The `**Domain:**` line names which domain pack every skill in this directory loads. **Infer it from the task description** (e.g. `engineering` for a code change, `bureaucracy` for a residence application), or carry over the value if `refine-idea` already set one. Default to `engineering` when the work is code or the domain is genuinely ambiguous *within a coding context* — but when the task is clearly non-code and the right domain is unclear, **ask** rather than stamping a label, since a wrong `**Domain:**` silently loads the wrong rules. See `./references/workflow/domain-packs.md`.

The user is expected to enrich `CONTEXT.md` over time (links, specs, decisions). Don't dump per-step notes, approach rationale, or verify criteria into it — those belong in the plan or its result file. Don't dump cross-task narrative into it either: tasks are independent folders with no shared layer above them, so anything a sibling task needs is duplicated into its own `CONTEXT.md`. Placeholder sections are intentional: leave them in place even if empty so downstream skills can find the same section names.

### 3. Draft the Goals

Before designing the plan, write `<task-dir>/goals.md` — the contract for what "done" means. This pins requirements before approach selection so steps and verification can be derived from concrete, durably-ID'd goals, not from a moving target.

**Resolve in this order:**

- **Goals already exist for this task** (hand-authored or from a prior session) — read them, apply `./references/workflow/acceptance-criteria.md` to each goal, restate the goals back to the user (calling out any that fail the checklist), and ask whether to proceed as-is or revise. Do not silently overwrite.
- **No goals file exists** — draft one from the user's task description and any signal in `CONTEXT.md` (problem statement, recommended direction, key assumptions). Run each draft goal through `./references/workflow/acceptance-criteria.md` before writing the file; ask clarifying questions for any goal that fails the checklist (testable, specific, outcome-oriented, singular, bounded, stated as behavior).

**Clarifying questions** — ask only when needed, batched into a single round. Each question must:

- Reference the specific goal (or missing goal) it addresses.
- Explain why the answer matters (which goal it sharpens, which step it would change).
- Suggest options when possible — "should bulk export include archived rows? A: yes, with a flag; B: no, archived stays excluded; A matches the existing single-row export, B matches the UI filter default" — not open-ended "what should we do?"

If the user answers in chat, update the goals to reflect the answers before moving on. If the user defers a question, leave the affected goal marked with a trailing `_(unresolved: <short note>)_` so `review-task` and `implement-task` see it.

**Goals file content:**

- A `## Goals` list of `- G<n> — <outcome>` bullets — short, observable, externally-verifiable statements, each carrying a durable ID

Keep goals **outcome-oriented**, not implementation-oriented. "User can export the current filter as CSV with a custom delimiter" is good. "Add a `formatCsv()` helper" is not — that belongs in the plan's steps.

**Goals file template:**

```markdown
# Goals: <task title>

**Plan:** [./plan.md](./plan.md)

## Goals

- G1 — <short, observable, externally-verifiable outcome>
- G2 — <outcome>
- G3 — <outcome>
```

The goals file carries no `**Status:**` field by design — it is a static input, not a lifecycle artifact. The user mutates it freely between sessions; downstream skills (`review-task`, `implement-task`, `resume-task`) read it but never write to it.

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

- **In scope** — which goals this plan delivers (by ID), and what will be changed to deliver them
- **Out of scope** — which goals are deferred (by ID), and what will NOT be changed, even if related
- **Boundaries** — Where this work ends and future work begins

Express the in/out split as a **partition of the goal IDs** with explicit lists (`delivered: G1, G3 · deferred: G4`), not as re-prosed intent — the goals are the single source, so scope names them rather than restating what they cover. Do not use ranges: retired goal IDs can leave gaps, so `G1-G3` is ambiguous once `G2` has been removed.

**IMPORTANT**: Scope definition prevents creep during implementation. Be precise. A vague scope produces vague work.

### 7. Break Down Steps

Create an ordered list of steps. Each step must be a **verifiable piece of work** — after completing it, there's a concrete way to confirm it worked before moving on.

**Order steps as vertical slices, not horizontal layers.** Each step should deliver a complete, observable outcome — one whole thing end to end — rather than building all of one layer, then all of the next. Vertical slicing surfaces integration risk early and keeps the work in a usable, demoable state between steps. Use layered ordering only when a foundational piece genuinely has no vertical seam.

For each step:

- **What** — Brief description of the change (one concern per step)
- **Verify** — How to confirm it works. The criterion is non-negotiable; if you can't state how to verify a step, it's too vague or too small to be a step.
- **Goal** — Which goal ID(s) this step delivers (`G1, G3`), or `none (infra/refactor)` for a setup/refactor step with no user-visible goal
- **Depends on** — Prior steps required (if any)

Break a step down further when: its title contains "and" (two steps wearing one hat); it touches two or more independent subsystems; or its acceptance can't be stated in 3 or fewer bullets. When the domain is code, `./references/engineering/planning.md` adds the engineering sizing guidance (a ~5-file cap, the concrete `Verify` recipe, and worked too-coarse / too-fine / right-size examples).

**Step format in the plan file:**

```markdown
### Step 1 — <short title>

- [ ] **What:** <one-sentence change>
- **Verify:** <how to confirm>
- **Goal:** <goal ID(s) this step delivers — e.g. `G1, G3` — or `none (infra/refactor)`>
- **Depends on:** <prior step numbers, or "none">
- **Due:** <date the step must finish by, or "none">
- **Lead time:** <how long the step takes once started — e.g. "visa: ~8 weeks", or "none">
```

The leading `- [ ]` checkbox is the marker `implement-task` flips to `- [x]` when the step is done, with a link to the result file section appended.

The `**Goal:**` line cites the goal ID(s) the step delivers, or `none (infra/refactor)` for a step that delivers no user-visible goal — the first-class escape for setup/refactor work. `review-task` keys coverage off these citations (each goal ID should map to ≥1 step, each non-escaped step to ≥1 goal), so a step that delivers a goal must name it. The schema lives in `./references/workflow/task-layout.md`.

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

Match the plan's detail to the task's complexity. The goals step (Step 3) is required at every depth — even small tasks benefit from a few explicit goals.

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
- "I'll skip the goals, the plan steps make it obvious" — Steps describe how to get there; goals describe what done means. Without goals, `implement-task` has no acceptance gate and `review-task` has nothing to check coverage against.
- "The goals are obvious" — If they're obvious, they cost nothing to write down. If they're not, that's exactly when you needed them.
- "The goal is roughly the right shape, that's good enough" — Run it through `./references/workflow/acceptance-criteria.md`. Vague goals survive coverage analysis and pass the acceptance gate by reinterpretation; that's the failure mode the checklist catches.
- "The user gave a vague task, I'll just guess what they want" — Ask. Clarifying questions during the goals step are cheaper than reworking the plan after implementation.
- "I'll just output the plan and goals in chat" — Both must be files on disk. `implement-task` and `review-task` read them from there.

## Verification

- [ ] Resolved task folder exists (reused if it already existed, created otherwise)
- [ ] `CONTEXT.md` present in the task folder; skeleton written if it didn't exist
- [ ] `**Domain:**` inferred from the task and written (carried over from `refine-idea` if set; asked when the task is clearly non-code and the domain is ambiguous, never silently defaulted to `engineering` for non-code work)
- [ ] Goals written to `<task-dir>/goals.md` — `## Goals` list of `- G<n> —` bullets with durable IDs, no `## Description`, no `**Status:**` field
- [ ] Hand-authored goals read and respected if present; not silently overwritten
- [ ] Each goal in `goals.md` passes the checks in `./references/workflow/acceptance-criteria.md`, or is marked `_(unresolved: ...)_` with a deferred clarifying question
- [ ] Clarifying questions asked when goals failed the checklist (testable, specific, outcome-oriented, singular, bounded, stated as behavior); user answers folded into the goals before drafting the plan
- [ ] Plan written to `<task-dir>/plan.md`
- [ ] Plan's `**Goals:**` line links to `./goals.md`
- [ ] Slug derived from task, kebab-case, 2–5 words
- [ ] Each step has `- [ ]` checkbox marker, **What**, **Verify**, **Goal**, **Depends on**
- [ ] Plan steps collectively cover every goal — each goal ID cited by ≥1 step, and every non-infra step cites ≥1 goal (no orphan goals, no orphan steps)
- [ ] `## Scope` states the in/out split as a partition of goal IDs (`delivered: … · deferred: …`)
- [ ] Every goal in `goals.md` carries a durable `G<n>` ID; the plan template carries no `## Task Understanding` section
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
**Goals:** [./goals.md](./goals.md)
**Result:** _(populated by `implement-task`: link to `./result.md`)_

## Exploration Findings

<key patterns, affected files, constraints discovered>

## Approach

<recommended approach with rationale; side-by-side bullet list of alternatives only if multiple viable options>

## Scope

- **In scope:** <delivered goal IDs · what changes>
- **Out of scope:** <deferred goal IDs · what won't change>
- **Boundaries:** ...

## Steps

### Step 1 — <title>

- [ ] **What:** ...
- **Verify:** ...
- **Goal:** <IDs, or none (infra/refactor)>
- **Depends on:** none
- **Due:** none _(optional; date the step must finish by)_
- **Lead time:** none _(optional; how long it takes once started)_

### Step 2 — <title>

- [ ] **What:** ...
- **Verify:** ...
- **Goal:** <IDs, or none (infra/refactor)>
- **Depends on:** Step 1

### Checkpoint after Step 2 _(only for plans >5 steps)_

- <assertion that the integrated whole still holds>
- End-to-end: <name the concrete outcome>

## Risks

- ...

## Open Questions

- ...
```

The plan file starts at `to-do` (written by this skill); `implement-task` then drives it through `executing` to `done`. If the user decides not to proceed **before execution begins** — a triage or scoping call, such as dropping a now-obsolete sibling plan — set the plan's `**Status:**` to `skipped` rather than deleting it or leaving a stale `to-do`; add a `result.md` only if it's worth recording why. Full vocabulary and transitions for plan and result files are registered in `./references/workflow/task-lifecycle.md` — that's the single source of truth across all task artifacts.

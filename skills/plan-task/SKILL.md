---
name: plan-task
description: Use when asked to plan, design, architect, scope, or break down a feature or change before implementation.
argument-hint: '[task or feature description, task folder or destination path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
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

This skill writes **two paired files** per plan: a goals file and a plan. Both live in the resolved task folder — canonically `.agents/tasks/<slug>/` — alongside its `CONTEXT.md`, under fixed role names.

- `<slug>` — names the **task folder** that holds `CONTEXT.md` plus the goals, plan, and result for the effort. Derived from the task: 2–5 lowercase kebab-case words capturing the gist (e.g. `add-csv-export`, `migrate-auth-middleware`, `fix-stale-cache-invalidation`). Don't ask the user — derive it. **If the user passed a slug that resolves to an existing active task folder, or a path to one (typically from `refine-idea`), reuse it — don't create a new one.** A path is used verbatim, anywhere on disk; its folder name is the slug.
- **Fixed file names.** Inside the folder the goals file and plan are always `goals.md` and `plan.md` — role names, no slug prefix, one plan per folder (so `.agents/tasks/add-csv-export/goals.md` and `.../plan.md`). Skills find them by these fixed names — the folder itself may be given by a path someone typed, but the files inside it never are.
- **Multi-part efforts.** When the work won't fit one plan, split it into several sibling task folders (one plan each), not multiple plans in one folder. Ordering between siblings lives in their folder names — see `./references/workflow/task-layout.md`. When the cut itself deserves a proposal — an approved ADR / RFC / epic-scale ask — hand the split to `decompose-task` (`./references/workflow/decomposition.md`).

If no matching active task folder exists, create one — `.agents/tasks/<slug>/` by default, or per the user's destination path (interpreted by the *Destination paths* rule in `./references/workflow/task-layout.md`). If the slug collides with an existing folder for a different effort, pick a more specific slug.

**Goals file (`goals.md`)** — the contract for what "done" means. Carries a `## Goals` list of durably-ID'd `G<n>` acceptance criteria, with no description prose. **No `**Status:**` field.** The user may hand-author it; if they do, this skill reads and respects it instead of regenerating.

**Plan file (`plan.md`)** — the contract for how the work is executed. Once written, `implement-task` consumes it and updates step checkboxes as work completes. Avoid rewriting the plan in place during planning iteration unless the user asks for revisions — refine through conversation, then write the final version.

## Planning Process

### 1. Clarify Requirements

- Restate the task to confirm understanding; separate explicit requirements from assumptions
- List ambiguities — ask before proceeding if critical
- Identify what "done" looks like for this task

### 2. Resolve the Task Folder and Read CONTEXT.md

The resolved task folder is the authoritative home for this plan. `CONTEXT.md` inside it is the static context this plan builds on. When the folder also holds a `ticket.md`, read it — it is the authoritative product-facing ask, and this plan's `goals.md` is derived by sharpening its acceptance criteria (Step 3).

Resolve the folder per the **resolve-or-create** discovery rules in `./references/workflow/task-layout.md`, including its *Destination paths* rule — cite it, don't restate it. When creating a folder whose `CONTEXT.md` doesn't exist, scaffold one (see the skeleton step below) before drafting the plan, and confirm the slug only if it differs meaningfully from what the user typed.

If multiple active task folders look like plausible matches for the user's request, list them and ask — don't guess.

#### Ticket-first tasks

This skill never drafts the ticket. When the work should start from a product-facing ask, run `/prepare-ticket` first — pointing it at the task folder so it writes `<task-folder>/ticket.md` — then run this skill. With the ticket already in the folder the branches below fire on their own: the skeleton's `Problem Statement` cites `./ticket.md`, and Step 3 sharpens the ticket's criteria into goals. If a `CONTEXT.md` already exists (e.g. from `refine-idea`), this skill never rewrites it (see Step 10) — surface any missing `./ticket.md` citation in chat rather than editing it.

#### CONTEXT.md skeleton (created when missing)

When `plan-task` runs without a prior `refine-idea` pass, scaffold a `CONTEXT.md` using the canonical schema in `./references/workflow/context-schema.md`. Write `**Status:** drafted-by-plan-task`, populate `Problem Statement` and `Key Assumptions to Validate` from the task description — or, when a `ticket.md` is present, have `Problem Statement` cite `./ticket.md` and derive the assumptions from it — and leave the other sections as placeholders so downstream consumers (`review-task`, `implement-task`, the reuse step) read the same section names regardless of how the task started.

**Infer `**Domain:**` from the task description** (e.g. `engineering` for a code change, `bureaucracy` for a residence application), or carry over the value if `refine-idea` already set one. Default to `engineering` when the work is code or the domain is genuinely ambiguous *within a coding context* — but when the task is clearly non-code and the right domain is unclear, **ask** rather than stamping a label, since a wrong `**Domain:**` silently loads the wrong rules. See `./references/workflow/domain-packs.md`.

### 3. Draft the Goals

Before designing the plan, write `<task-dir>/goals.md` — the contract for what "done" means. This pins requirements before approach selection so steps and verification can be derived from concrete, durably-ID'd goals, not from a moving target.

**Resolve in this order:**

- **Goals already exist for this task** (hand-authored or from a prior session) — read them, apply `./references/workflow/acceptance-criteria.md` to each goal, restate the goals back to the user (calling out any that fail the checklist), and ask whether to proceed as-is or revise. Do not silently overwrite.
- **No goals file exists** — draft one. When the folder holds a `ticket.md`, derive the goals from it first: **sharpen each of the ticket's acceptance criteria into one or more durably-ID'd `G<n>` goals** (see [`./references/workflow/ticket-format.md`](./references/workflow/ticket-format.md) § *Ticket → goals*), making the product-level language precise and testable rather than mirroring it. Otherwise draft from the user's task description and any signal in `CONTEXT.md` (problem statement, recommended direction, key assumptions). Either way, run each draft goal through `./references/workflow/acceptance-criteria.md` before writing the file; ask clarifying questions for any goal that fails the checklist (testable, specific, outcome-oriented, singular, bounded, stated as behavior).

**Flag externally-verified goals.** A goal that can only be confirmed *outside* your working session — a human/client sign-off, or a live/production state you can't drive in-session (e.g. "deployed and verified live", "verified by the client") — carries an `(external)` token right after its ID: `- G5 (external) — <outcome>`. Marking it right is load-bearing: an `(external)` goal parks the task at `in-review` instead of letting it reach `done` on code-complete alone, and un-marking one that really is external lets the task finalize without the sign-off. When it's unclear whether a goal is agent-verifiable or external, ask (batch it with the clarifying questions below). See `./references/workflow/acceptance-criteria.md`.

**Clarifying questions** — ask only when needed, batched into a single round. Each question must:

- Reference the specific goal (or missing goal) it addresses.
- Explain why the answer matters (which goal it sharpens, which step it would change).
- Suggest options when possible — "should bulk export include archived rows? A: yes, with a flag; B: no, archived stays excluded; A matches the existing single-row export, B matches the UI filter default" — not open-ended "what should we do?"

If the user answers in chat, update the goals to reflect the answers before moving on. If the user defers a question, leave the affected goal marked with a trailing `_(unresolved: <short note>)_` so `review-task` and `implement-task` see it.

**Goals file content:**

- A `## Goals` list of `- G<n> — <outcome>` bullets — short, observable, externally-verifiable statements, each carrying a durable ID; a goal verified outside your session carries an optional `(external)` token after its ID

Keep goals **outcome-oriented**, not implementation-oriented. "User can export the current filter as CSV with a custom delimiter" is good. "Add a `formatCsv()` helper" is not — that belongs in the plan's steps.

**Goals file template:**

```markdown
# Goals: <task title>

**Plan:** [./plan.md](./plan.md)

## Goals

- G1 — <short, observable, externally-verifiable outcome>
- G2 — <outcome>
- G3 (external) — <outcome verified outside the session: human/client sign-off or live check>
```

The goals file carries no `**Status:**` field by design — it is a static input, not a lifecycle artifact. The user mutates it freely between sessions; downstream skills (`review-task`, `implement-task`, `resume-task`) read it but never write to it. `reconcile-task` alone may add or reword a goal, and only through a confirmed judgment item (`./references/workflow/task-lifecycle.md`).

### 4. Explore the Domain's Reality

Ground the plan in what already exists — explore before designing. This is the forward exploration pass; `review-task` will independently verify assumptions later if invoked. Follow the resolved domain's exploration guide; when the domain is code, that's `./references/engineering/exploration.md`.

- Search for related prior work to use as a model; map what the change will affect (its blast radius)
- Note existing constraints (debt, contracts, budgets, prior commitments)
- `CONTEXT.md` already records part of this grounding (References, Recommended Direction, Key Assumptions). Verify what it settles still holds, but don't restate it — the plan's `## Exploration Findings` carries only the **deltas** this pass discovered beyond `CONTEXT.md`, citing its sections for the rest. See `./references/workflow/task-layout.md` § *One home per fact*.

### 5. Evaluate Approaches

Compare viable approaches — and actively look for ones the user may not have considered.

Even when the user suggests a specific approach, consider whether a different solution would be more optimal. The goal is to arrive at the best implementation, not just validate the first idea. If an alternative is clearly better, recommend it with a clear explanation of why.

**However**, don't fabricate alternatives to fill a comparison list when one approach is clearly right. State it and explain why alternatives don't apply.

When `CONTEXT.md` carries a `## Recommended Direction`, treat it as the starting point: the plan's `## Approach` **cites** it and records only the refinements and decisions made at plan time — not a restatement of the direction itself.

For each approach, weigh alignment with existing patterns, the minimum complexity that meets the requirements, risk and reversibility, and relative effort — a line per axis is enough.

### 6. Define Scope

Explicitly state:

- **In scope** — which goals this plan delivers (by ID), and what will be changed to deliver them
- **Out of scope** — which goals are deferred (by ID), and what will NOT be changed, even if related
- **Boundaries** — Where this work ends and future work begins

Express the in/out split as a **partition of the goal IDs** with explicit lists (`delivered: G1, G3 · deferred: G4`), not as re-prosed intent — the goals are the single source, so scope names them rather than restating what they cover. Do not use ranges: retired goal IDs can leave gaps, so `G1-G3` is ambiguous once `G2` has been removed. The same citation rule covers exclusion rationale: the *why* behind an exclusion lives in CONTEXT's "Not Doing" — the plan's out-of-scope entry names the deferred goal IDs and what won't change, and cites CONTEXT for the reasons rather than re-prosing them. When a `ticket.md` states In/Out scope, the goal-ID partition must reflect its product-level boundary; cite the ticket rather than re-prosing it.

Scope definition prevents creep during implementation. Be precise — a vague scope produces vague work.

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
- **Touches:** <the artifacts/directories this step edits — its declared edit surface — or "none">
```

The leading `- [ ]` checkbox is the marker `implement-task` flips to `- [x]` when the step is done, with a link to the result file section appended.

The `**Goal:**` line cites the goal ID(s) the step delivers, or `none (infra/refactor)` for a step that delivers no user-visible goal — the first-class escape for setup/refactor work. `review-task` keys coverage off these citations (each goal ID should map to ≥1 step, each non-escaped step to ≥1 goal), so a step that delivers a goal must name it. The schema lives in `./references/workflow/task-layout.md`.

`**Due:**` and `**Lead time:**` are **optional**. Omit them (or set `none`) for code work, where steps are ordered by `Depends on:`, not the calendar. They earn their place in time-anchored domains (a relocation, an event) where deadlines and external lead times — not just logical dependencies — drive ordering and surface the long-pole steps that must start early. They are planning information the actor reads; nothing in the kit schedules off them.

`**Touches:**` is likewise **optional**: the artifacts or directories the step is expected to edit — its declared edit surface. It has one consumer: `implement-task`'s `-p` parallel lane, which runs steps concurrently only when no `Depends on:` path connects them *and* their declared surfaces are pairwise disjoint. A step without the line (or with `none`) simply runs serially, so declare surfaces only where parallel execution is plausible and the surfaces are genuinely separate. When the domain is code, `./references/engineering/planning.md` lists the shared-artifact traps to check before calling two surfaces disjoint.

### 8. Add Checkpoints

Per-step `Verify` confirms one unit of work. It does **not** catch the case where step 3 silently broke step 1's outcome. For plans with more than ~5 steps, insert a **Checkpoint** every 2–3 steps that re-verifies the integrated whole, not just the latest change. This section is the single home for checkpoint cadence and shape — the domain pack's planning file owns what a checkpoint asserts, and other skills cite this section rather than restating it.

A checkpoint re-asserts that everything done so far still holds together — including a concrete end-to-end outcome, named ("user can log in and see dashboard", not "core flow"). When the domain is code, the specific assertions are in `./references/engineering/planning.md`.

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

The plan's `## Open Questions` holds only questions that **arose during planning** and aren't already tracked in CONTEXT's `## Open Questions` — cite those instead of copying them. An answer is later recorded where its question lives (`./references/workflow/task-layout.md` § *One home per fact*). If this pass answers a question CONTEXT tracks, surface the answer in chat — this skill never annotates an existing `CONTEXT.md`; the annotation lands there later via a reconciler (`./references/workflow/reconciliation.md`).

## Scaling Plan Depth

Match the plan's detail to the task's complexity — depth scales, but every tier still has to satisfy the Verification checklist below. The goals step (Step 3) is required at every depth — even small tasks benefit from a few explicit goals.

- **Medium** (small, clear pattern) — Steps 1–4, 6–10 — skip approach comparison (Step 5); keep exploration, risks, and open questions light but real
- **Large** (bigger, some ambiguity) — All steps, moderate detail
- **Complex** (cross-cutting, structural) — All steps, deep exploration, multiple approaches compared

When the domain is code, `./references/engineering/planning.md` gives file-count proxies for these tiers.

## Don't Rationalize

- "I already know what's there well enough" — Check anyway. Memory drifts; the current reality is the truth.
- "There's only one way to do this" — If you haven't explored alternatives, you don't know that.
- "This is too simple to plan" — If the user asked for a plan, the task warranted one.
- "I'll figure out the scope during implementation" — Undefined scope produces undefined work. Bound it now.
- "The goals are obvious" — If they're obvious, they cost nothing to write down. If they're not, that's exactly when you needed them.
- "The user gave a vague task, I'll just guess what they want" — Ask. Clarifying questions during the goals step are cheaper than reworking the plan after implementation.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Task folder resolved or created per `task-layout.md`; `CONTEXT.md` present (skeleton with `**Status:** drafted-by-plan-task` and an inferred — or asked-for — `**Domain:**` when it was missing)
- [ ] `goals.md` written with durable `G<n>` IDs and `(external)` markers where verification happens outside the session; no `**Status:**` field; hand-authored goals respected; each goal passes `./references/workflow/acceptance-criteria.md` or is marked `_(unresolved: ...)_`
- [ ] When a `ticket.md` is present, every one of its acceptance criteria is sharpened into ≥1 `G<n>` goal, and no goal contradicts the ticket's stated scope
- [ ] `plan.md` written at `to-do` with link-headers to `./CONTEXT.md` and `./goals.md` (and `./ticket.md` when the task has one); every step carries the `- [ ]` checkbox, **What**, **Verify**, **Goal**, **Depends on**
- [ ] Coverage is a closed mapping: every goal ID cited by ≥1 step, every non-infra step cites ≥1 goal, and `## Scope` partitions all goal IDs into delivered / deferred (explicit lists, no ranges)
- [ ] No `CONTEXT.md` content restated — sibling sections cited; the plan carries only plan-time deltas (*One home per fact*)
- [ ] Plan grounded in the domain's actual reality; checkpoints every 2–3 steps for plans >5 steps
- [ ] Risks specific to this task; open questions that could invalidate the approach surfaced
- [ ] Store index refreshed when the store has one — walk up from the task folder for `scripts/generate-index.mjs`, run `node <that-root>/scripts/generate-index.mjs`, skip silently when the script or `node` is absent (`./references/workflow/task-layout.md` § *Store-level artifacts*)

## Plan File Structure

Write the file with this top-level layout. Adapt sections to task size — not every plan needs every section.

```markdown
# <task title>

**Status:** to-do
**Ticket:** [./ticket.md](./ticket.md) _(only when the task has one)_
**Deliverable:** [./adr.md](./adr.md) _(only for a doc task: its work-product file — see `./references/workflow/task-layout.md` § Doc-task files)_
**Context:** [./CONTEXT.md](./CONTEXT.md)
**Goals:** [./goals.md](./goals.md)
**Result:** _(populated by `implement-task`: link to `./result.md`)_

## Exploration Findings

<plan-time deltas only: key patterns, affected files, constraints discovered beyond ./CONTEXT.md — cite its sections rather than restating them>

## Approach

<recommended approach with rationale; when CONTEXT § Recommended Direction exists, cite it and record only plan-time refinements; side-by-side bullet list of alternatives only if multiple viable options>

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
- **Touches:** none _(optional; the step's edit surface — pairwise-disjoint surfaces enable `implement-task -p`)_

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

- <questions that arose during planning; CONTEXT's open questions are cited, not copied>
```

The plan file starts at `to-do` (written by this skill); `implement-task` then drives it through `executing` to `done` — or parks it at `in-review` when the goals include an `(external)` item still awaiting verification, reaching `done` only once that's confirmed. If the user decides not to proceed **before execution begins** — a triage or scoping call, such as dropping a now-obsolete sibling plan — set the plan's `**Status:**` to `skipped` rather than deleting it or leaving a stale `to-do`; add a `result.md` only if it's worth recording why. Full vocabulary and transitions for plan and result files are registered in `./references/workflow/task-lifecycle.md` — that's the single source of truth across all task artifacts.

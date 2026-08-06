---
name: plan-task
description: Use when asked to plan, design, architect, scope, or break down a feature or change before implementation.
argument-hint: '[task or feature description, task folder or destination path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, `planning.md`, …). If the domain has no pack, run the neutral methodology and say so.

This skill produces an implementation plan inside a resolved task folder, paired with a sibling **goals file** carrying the testable acceptance criteria. The plan is the contract `implement-task` executes against; the goals file is the contract for what "done" means.

## When to Use

**Plan when** the work spans multiple areas or artifacts; viable approaches have meaningful trade-offs; the change hits shared or foundational pieces with wide blast radius; requirements are ambiguous and need decomposition; the change is high-risk or hard to reverse.

**Skip when** the change is single and obvious; cause and fix are already clear and localized; the user specified the exact approach; the task is smaller than the plan would be — say so and suggest going straight to implementation. An idea too vague to scope goes to `refine-idea` first, then back here.

For code, `./references/engineering/planning.md` gives these heuristics in engineering terms (file counts, root-cause bug fixes).

## Inputs

- The user's task or feature request, plus any context they give on constraints, preferences, or prior discussion.
- A slug or destination path, when they supply one.
- The resolved folder's `CONTEXT.md` — the static grounding this plan builds on — and its `ticket.md` when present, the authoritative product-facing ask. Both read-only here.

## Invariants

**CRITICAL**: the output of this skill is two written files on disk — `goals.md` and `plan.md` — not a conversation message. After writing them, summarize briefly in the chat and point at the files. A third file, `diagram.md`, is written only when Step 5a's test warrants it.

- **One folder, fixed names.** Everything lands in the resolved task folder — canonically `.agents/tasks/<slug>/` — beside its `CONTEXT.md`, under fixed role names: always `goals.md` and `plan.md`, no slug prefix, one plan per folder. Skills find them by these names; the folder itself may be a path someone typed, the files inside it never are.
- **Slug.** The folder name is the slug: 2–5 lowercase kebab-case words capturing the gist (`add-csv-export`, `fix-stale-cache-invalidation`). Derive it — don't ask. A slug colliding with an existing folder for a different effort gets a more specific one.
- **Multi-part efforts.** Work that won't fit one plan splits into sibling task folders, one plan each — never several plans in one folder. Ordering between siblings lives in their folder names (`./references/workflow/task-layout.md`). When the cut itself deserves a proposal — an approved ADR / RFC / epic-scale ask — hand it to `decompose-task` (`./references/workflow/decomposition.md`).
- **Never written here.** An existing `CONTEXT.md` (Step 10) and an existing hand-authored `goals.md` (Step 3) are read and respected, never rewritten. This skill never drafts a `ticket.md` either — `/prepare-ticket` does, pointed at the task folder. And don't rewrite `plan.md` in place during planning iteration unless the user asks for revisions: refine through conversation, then write the final version.
- **One home per fact.** Anything the folder already records is cited, never restated; the plan carries only the deltas this pass adds (`./references/workflow/task-layout.md` § *One home per fact*). Steps 4, 5, 6, and 10 apply it to their own sections.

**`goals.md`** — the contract for what "done" means: a `## Goals` list of durably-ID'd `G<n>` acceptance criteria, no description prose, and **no `**Status:**` field**, being a static input rather than a lifecycle artifact. The user may hand-author it and edits it freely between sessions; `review-task`, `implement-task`, and `resume-task` read it and never write to it. `reconcile-task` alone may add or reword a goal, and only through a confirmed judgment item (`./references/workflow/task-lifecycle.md`).

**`plan.md`** — the contract for how the work is executed; `implement-task` consumes it and flips its step checkboxes as work completes.

## Planning Process

### 1. Clarify Requirements

Restate the task to confirm understanding, separating explicit requirements from assumptions. List ambiguities — ask before proceeding if critical. Identify what "done" looks like.

### 2. Resolve the Task Folder and Read CONTEXT.md

Resolve per the **resolve-or-create** discovery rules in `./references/workflow/task-layout.md`, including its *Destination paths* rule — cite it, don't restate it. Reuse an existing active folder a slug or path resolves to (typically from `refine-idea`); create one only when nothing matches. Several plausible matches → list them and ask. Confirm the slug only if it differs meaningfully from what the user typed.

The folder is this plan's authoritative home. Read its `CONTEXT.md`, and its `ticket.md` when present — Step 3 sharpens the ticket's criteria into goals. An existing `CONTEXT.md` is never rewritten; surface a missing `./ticket.md` citation in chat instead of editing it.

**Scaffold a missing `CONTEXT.md`** before drafting the plan, per `./references/workflow/context-schema.md`: `**Status:** drafted-by-plan-task`; `Problem Statement` and `Key Assumptions to Validate` from the task description, or — with a `ticket.md` present — `Problem Statement` citing `./ticket.md` and the assumptions derived from it; every other section left a placeholder, so downstream consumers read the same section names however the task started.

**Infer `**Domain:**`** from the task description (`engineering` for a code change, `bureaucracy` for a residence application), or carry over what `refine-idea` set. Default to `engineering` for code work or ambiguity *within a coding context*; when the task is clearly non-code and the right domain is unclear, **ask** rather than stamping a label — a wrong `**Domain:**` silently loads the wrong rules.

### 3. Draft the Goals

Write `<task-dir>/goals.md` before designing the plan: pinning requirements before approach selection is what lets steps and verification derive from concrete, durably-ID'd goals instead of a moving target.

- **Goals already exist** (hand-authored or from a prior session) — read them, run each through `./references/workflow/acceptance-criteria.md`, restate them to the user calling out any that fail, and ask whether to proceed as-is or revise. Never silently overwrite.
- **No goals file** — draft one. With a `ticket.md` in the folder, derive from it first: **sharpen each of its acceptance criteria into one or more durably-ID'd `G<n>` goals** (`./references/workflow/ticket-format.md` § *Ticket → goals*) — precise and testable, not a mirror of the product-level language. Otherwise draft from the task description and any signal in `CONTEXT.md`. Either way, every draft goal passes `./references/workflow/acceptance-criteria.md` before the file is written.

**Flag externally-verified goals.** A goal confirmable only *outside* your working session — a human/client sign-off, or a live/production state you can't drive in-session — carries an `(external)` token right after its ID (`./references/workflow/acceptance-criteria.md`). Marking it right is load-bearing: an `(external)` goal parks the task at `in-review` instead of letting it reach `done` on code-complete alone, and un-marking one that really is external lets the task finalize without the sign-off. Unclear which a goal is → ask.

**Clarifying questions** — for a goal that fails the checklist or whose verification class is unclear. Ask only when needed, batched into one round. Each names the specific goal (or missing goal) it addresses, says why the answer matters (which goal it sharpens, which step it would change), and offers options rather than an open-ended "what should we do?". Update the goals from the answers before moving on; a question the user defers leaves its goal marked `_(unresolved: <short note>)_` so `review-task` and `implement-task` see it.

Goals stay **outcome-oriented**, not implementation-oriented — short, observable, externally-verifiable: "User can export the current filter as CSV with a custom delimiter" is a goal; "Add a `formatCsv()` helper" is a plan step. Template: § *Output*.

### 4. Explore the Domain's Reality

Ground the plan in what already exists — explore before designing. This is the forward pass; `review-task` verifies assumptions independently later if invoked. Follow the resolved domain's exploration guide; for code, `./references/engineering/exploration.md`.

- Search for related prior work to use as a model; map the change's blast radius.
- Note existing constraints: debt, contracts, budgets, prior commitments.
- Confirm what `CONTEXT.md` already settles (References, Recommended Direction, Key Assumptions) still holds; `## Exploration Findings` then carries only this pass's deltas, citing CONTEXT's sections for the rest.

### 5. Evaluate Approaches

Compare viable approaches, actively looking for ones the user may not have considered. Even when the user names one, consider whether a different solution is more optimal and recommend it, with a clear explanation, when it clearly is. **However**, don't fabricate alternatives to fill a comparison list when one approach is clearly right — state that it is, and why the alternatives don't apply.

Weigh each on alignment with existing patterns, the minimum complexity that meets the requirements, risk and reversibility, and relative effort — a line per axis is enough.

A `CONTEXT.md` `## Recommended Direction` is the starting point: `## Approach` **cites** it and records only the plan-time refinements and decisions.

### 5a. Draw the Task Diagram (when warranted)

With the approach chosen, draw the task's optional `diagram.md` when the resolved domain pack's diagram guidance says the change warrants one — for code, `./references/engineering/planning.md` § *The task diagram*, which owns the warranted test, what a diagram depicts, its altitude, and the notation. This skill owns only the timing and the file; it carries no diagram or Mermaid knowledge of its own.

- **Warranted** → write `<task-dir>/diagram.md` in the format fixed by `./references/workflow/task-layout.md` § *The diagram file*, its dated `**Reflects:**` line anchored `as of the plan`, and add the `**Diagram:**` link-header to the plan.
- **Not warranted, or the resolved domain ships no diagram guidance** → write nothing, add no header. This is where most tasks land, and absence is the intended state rather than a gap: nothing records the decision, and no skill later reports the file as missing. Drawing one for a change with no structural shape is the failure mode to watch; the pack's not-warranted examples are the calibration.

### 6. Define Scope

- **In scope** — which goals this plan delivers (by ID), and what will be changed to deliver them
- **Out of scope** — which goals are deferred (by ID), and what will NOT be changed, even if related
- **Boundaries** — where this work ends and future work begins

Express the in/out split as a **partition of the goal IDs** in explicit lists (`delivered: G1, G3 · deferred: G4`), never re-prosed intent and never ranges (`./references/workflow/task-layout.md` § *The goals file*). An exclusion's *why* stays in CONTEXT's "Not Doing", and a `ticket.md`'s In/Out scope fixes the product-level boundary the partition must reflect — cite both rather than re-prosing them. Scope is what prevents creep during implementation; a vague one produces vague work.

### 7. Break Down Steps

An ordered list of steps, each a **verifiable piece of work**: after completing it there's a concrete way to confirm it worked before moving on.

**Order steps as vertical slices, not horizontal layers.** Each delivers a complete, observable outcome — one whole thing end to end — rather than all of one layer, then all of the next. Vertical slicing surfaces integration risk early and keeps the work usable and demoable between steps. Use layered ordering only when a foundational piece genuinely has no vertical seam.

Every step carries **What** (one concern, one sentence), **Verify** (how to confirm it works — non-negotiable; a step you can't state a verification for is too vague or too small to be a step), **Goal**, and **Depends on**; three further lines are optional. Format: § *Output*.

- **`Goal:`** — the goal ID(s) the step delivers (`G1, G3`), or `none (infra/refactor)`, the first-class escape for setup/refactor work with no user-visible goal. `review-task` keys coverage off these citations, so a step that delivers a goal must name it (`./references/workflow/task-layout.md` § *The goals file*).
- **`Due:` / `Lead time:`** *(optional)* — omit them, or set `none`, for code work, ordered by `Depends on:` rather than the calendar. They earn their place in time-anchored domains (a relocation, an event) where deadlines and external lead times drive ordering and surface the long-pole steps that must start early. Planning information the actor reads; nothing in the kit schedules off them.
- **`Touches:`** *(optional)* — the artifacts or directories the step is expected to edit, its declared edit surface. `implement-task`'s executors are the consumers: its automatic parallel batch runs steps concurrently only when each declares a surface, no `Depends on:` path connects them, *and* the declared surfaces are pairwise disjoint, and a serial executor stays inside a declared surface as its scope bound. Undeclared (or `none`) runs serially — so declare only where parallel execution is plausible and the surfaces are genuinely separate. For code, `./references/engineering/planning.md` lists the shared-artifact traps to check first.

Break a step down further when its title contains "and" (two steps wearing one hat), it touches two or more independent subsystems, or its acceptance can't be stated in 3 or fewer bullets. For code, `./references/engineering/planning.md` adds the engineering sizing guidance — a ~5-file cap, the concrete `Verify` recipe, worked too-coarse / too-fine / right-size examples.

### 8. Add Checkpoints

Per-step `Verify` confirms one unit of work. It does **not** catch the case where step 3 silently broke step 1's outcome. For plans of more than ~5 steps, insert a **Checkpoint** every 2–3 steps that re-verifies the integrated whole, not just the latest change. Skip them entirely for short plans (≤5 steps), where the final step's verification doubles as an end-to-end check.

A checkpoint re-asserts that everything done so far still holds together — including a concrete end-to-end outcome, named ("user can log in and see dashboard", not "core flow"). For code, the specific assertions are in `./references/engineering/planning.md`.

Checkpoints are not steps — no `- [ ]` checkbox for `implement-task` to flip. They are gates it must pause at to confirm before the next batch of steps. Format: § *Output*.

This section is the single home for checkpoint cadence and shape; the domain pack's planning file owns what a checkpoint asserts, and other skills cite this section rather than restating it.

### 9. Identify Risks

Flag only risks **specific to this task**, never a generic checklist. For each: what could go wrong (a concrete scenario, not a vague category), how likely it is given what exploration found, and how to mitigate or investigate it before it becomes a problem.

### 10. Flag Open Questions

Surface assumptions that could invalidate the approach — a plan with known unknowns is more useful than one that hides them.

`## Open Questions` holds only questions that **arose during planning** and aren't already tracked in CONTEXT's `## Open Questions`; cite those instead of copying them. If this pass answers one CONTEXT tracks, surface the answer in chat: this skill never annotates an existing `CONTEXT.md`, and the annotation lands there later via a reconciler (`./references/workflow/reconciliation.md`).

## Scaling Plan Depth

Match the plan's detail to the task's complexity. Depth scales, but every tier still satisfies the Verification checklist below, and Step 3 is required at every depth — even small tasks benefit from a few explicit goals.

- **Medium** (small, clear pattern) — Steps 1–4, 5a, 6–10; skip approach comparison (Step 5); keep exploration, risks, and open questions light but real
- **Large** (bigger, some ambiguity) — all steps, moderate detail
- **Complex** (cross-cutting, structural) — all steps, deep exploration, multiple approaches compared

For code, `./references/engineering/planning.md` gives file-count proxies for these tiers.

## Don't Rationalize

- "I already know what's there well enough" — Check anyway. Memory drifts; the current reality is the truth.
- "There's only one way to do this" — If you haven't explored alternatives, you don't know that.
- "This is too simple to plan" — If the user asked for a plan, the task warranted one.
- "I'll figure out the scope during implementation" — Undefined scope produces undefined work. Bound it now.
- "The goals are obvious" — If they're obvious, they cost nothing to write down. If they're not, that's exactly when you needed them.
- "The user gave a vague task, I'll just guess what they want" — Ask. Clarifying questions during the goals step are cheaper than reworking the plan after implementation.

## Output

**`goals.md`:**

```markdown
# Goals: <task title>

**Plan:** [./plan.md](./plan.md)

## Goals

- G1 — <short, observable, externally-verifiable outcome>
- G2 — <outcome>
- G3 (external) — <outcome verified outside the session: human/client sign-off or live check>
```

**`plan.md`** — this top-level layout, adapted to task size; not every plan needs every section:

```markdown
# <task title>

**Status:** to-do
**Ticket:** [./ticket.md](./ticket.md) _(only when the task has one)_
**Deliverable:** [./adr.md](./adr.md) _(only for a doc task — `./references/workflow/task-layout.md` § Doc-task files)_
**Context:** [./CONTEXT.md](./CONTEXT.md)
**Goals:** [./goals.md](./goals.md)
**Diagram:** [./diagram.md](./diagram.md) _(only when the change warranted one — see Step 5a)_
**Result:** _(populated by `implement-task`: link to `./result.md`)_

## Exploration Findings

<key patterns, affected files, constraints — this pass's deltas beyond ./CONTEXT.md only (Step 4)>

## Approach

<the recommended approach and its rationale (Step 5); a side-by-side bullet list of alternatives only when several are viable>

## Scope

- **In scope:** <delivered goal IDs · what changes>
- **Out of scope:** <deferred goal IDs · what won't change>
- **Boundaries:** ...

## Steps

### Step 1 — <short title>

- [ ] **What:** <one-sentence change>
- **Verify:** <how to confirm>
- **Goal:** <goal ID(s) this step delivers — e.g. `G1, G3` — or `none (infra/refactor)`>
- **Depends on:** <prior step numbers, or "none">
- **Due:** none _(optional; the date it must finish by)_
- **Lead time:** none _(optional; how long it takes once started — e.g. "visa: ~8 weeks")_
- **Touches:** none _(optional; the step's declared edit surface)_

### Step 2 — <short title>

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

Each step's leading `- [ ]` is the marker `implement-task` flips to `- [x]`, appending a link to the result file section. The plan starts at `to-do`, written by this skill; `implement-task` drives it through `executing` to `done` — or parks it at `in-review` when the goals include an `(external)` item still awaiting verification. If the user decides not to proceed **before execution begins** — a triage or scoping call, such as dropping a now-obsolete sibling plan — set `**Status:**` to `skipped` rather than deleting the plan or leaving a stale `to-do`, and add a `result.md` only if it's worth recording why. Full vocabulary and transitions: `./references/workflow/task-lifecycle.md`.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Folder resolved or created per `task-layout.md`; `CONTEXT.md` present — a scaffolded one carrying `**Status:** drafted-by-plan-task` and an inferred (or asked-for) `**Domain:**`
- [ ] `goals.md` written: durable `G<n>` IDs, `(external)` markers where verification leaves the session, no `**Status:**` field, hand-authored goals respected, each goal passing `./references/workflow/acceptance-criteria.md` or marked `_(unresolved: ...)_`
- [ ] With a `ticket.md` present, every acceptance criterion sharpened into ≥1 `G<n>` goal, and no goal contradicting the ticket's stated scope
- [ ] `plan.md` written at `to-do` with link-headers to `./CONTEXT.md`, `./goals.md`, and `./ticket.md` when the task has one; every step carrying the `- [ ]` checkbox, **What**, **Verify**, **Goal**, **Depends on**
- [ ] Coverage closed: every goal ID cited by ≥1 step, every non-infra step citing ≥1 goal, `## Scope` partitioning all goal IDs into delivered / deferred (explicit lists, no ranges)
- [ ] `diagram.md` written with its `**Reflects:**` line and cited by the plan's `**Diagram:**` header when the pack's guidance warranted one — neither when it didn't; absence never annotated
- [ ] No `CONTEXT.md` content restated — sibling sections cited, the plan carrying only plan-time deltas
- [ ] Plan grounded in the domain's actual reality; checkpoints every 2–3 steps for plans >5 steps
- [ ] Risks specific to this task; open questions that could invalidate the approach surfaced
- [ ] Store index refreshed when the store has one, per `./references/workflow/task-layout.md` § *Store-level artifacts*

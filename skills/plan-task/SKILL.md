---
name: plan-task
description: Use when asked to plan, design, architect, scope, or break down a feature or change before implementation.
argument-hint: '[task or feature description, task folder or destination path]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, `planning.md`, …). If the domain has no pack, run the neutral methodology and say so.

Write two files into the resolved task folder: `goals.md`, the acceptance contract, and `plan.md`, the execution contract `implement-task` runs. Then summarize briefly in chat and point at the files.

## When to Use

**Plan when** the work spans several areas or artifacts, approaches carry real trade-offs, the change hits shared pieces with wide blast radius, requirements need decomposition, or the change is hard to reverse.

**Skip when** the change is single and obvious, the fix is already clear and localized, the user fixed the approach, or the task is smaller than its plan: say so and suggest implementing directly. An idea too vague to scope goes to `refine-idea` first. For code, `./references/engineering/planning.md` gives these heuristics in file counts.

## Inputs

The user's request with any constraints or prior discussion; a slug or destination path when given; the folder's `CONTEXT.md` and, when present, `ticket.md`. Both files are read-only here.

## Invariants

- **One folder, fixed names.** `goals.md` and `plan.md` land beside `CONTEXT.md` in the folder Step 2 resolves, one plan per folder, no slug prefix.
- **Slug.** The folder name is 2–5 lowercase kebab-case words capturing the gist (`add-csv-export`). Derive it; do not ask. Pick a more specific one when it collides with a different effort's folder.
- **Multi-part efforts.** Work that will not fit one plan splits into sibling folders, one plan each, ordered by folder name (`./references/workflow/task-siblings.md`). An approved ADR, RFC, or epic-scale ask goes to `decompose-task` (`./references/workflow/decomposition.md`).
- **Never written here.** An existing `CONTEXT.md` and an existing hand-authored `goals.md` are read, never rewritten. `ticket.md` is `/prepare-ticket`'s. Refine `plan.md` through conversation and write it once, unless the user asks for revisions in place.
- **One home per fact.** Cite what the folder already records; the plan carries only this pass's deltas (`./references/workflow/one-home.md` § *One home per fact*).

`goals.md` is a static input: a `## Goals` list of `G<n>` criteria, no description prose, no `**Status:**` field (`./references/workflow/task-goals.md`). `review-task` and `resume-task` read it. The reconcilers and `implement-task` may edit it as a judged edit, the last never grading its own run against a goal it changed (`./references/workflow/task-authorship.md`).

## Planning Process

### 1. Clarify Requirements

Restate the task, separating explicit requirements from assumptions. Ask about critical ambiguities before proceeding. Identify what "done" looks like.

### 2. Resolve the Task Folder and Read CONTEXT.md

Resolve per the **resolve-or-create** rules in `./references/workflow/task-layout.md`; a new folder lands by `./references/workflow/task-destinations.md`. Reuse an existing active folder the slug or path resolves to; several plausible matches → list them and ask. Confirm the slug only when it differs meaningfully from what the user typed.

Read `CONTEXT.md` and `ticket.md`. Surface a missing `./ticket.md` citation in chat rather than editing it in.

**Read inherited grounding** before Step 3: the ancestor `GROUP_CONTEXT.md` files, root to task, per `./references/workflow/task-store.md` § *Shared group context*. They bind the goals, approach, and steps, and add no goal the ask does not carry. `## References`, `## Exploration Findings`, and `## Approach` cite the group file behind an inherited fact rather than copying it (`./references/workflow/context-schema.md`). Outside a registered root nothing is inherited.

**Scaffold a missing `CONTEXT.md`** from `./references/templates/CONTEXT.md` per `./references/workflow/context-schema.md`: `Problem Statement` and `Key Assumptions to Validate` from the task description, or from `./ticket.md` when present, every other section left a placeholder.

**Infer `**Domain:**`** from the task, or carry over what `refine-idea` set. Default to `engineering` for code or ambiguity within a coding context. When the task is clearly non-code and the domain is unclear, ask: a wrong `**Domain:**` loads the wrong rules.

### 3. Draft the Goals

Write `goals.md` before designing the plan, so steps and verification derive from fixed, ID'd goals.

- **Goals exist:** run each through `./references/workflow/acceptance-criteria.md`, restate them naming any that fail, and ask whether to proceed or revise. Never silently overwrite.
- **No goals file:** with a `ticket.md`, sharpen each acceptance criterion into one or more `G<n>` goals (`./references/workflow/ticket-format.md` § *Ticket → goals*). Otherwise draft from the task description and `CONTEXT.md`. Every draft goal passes `./references/workflow/acceptance-criteria.md` before the file is written.

A goal confirmable only outside the session, a sign-off or a live state, carries the `(external)` marker (`./references/workflow/acceptance-criteria.md` § *Externally-verified goals — the `(external)` marker*). Unclear which class a goal is → ask.

Where the task's resolved repository declares live verification (`./references/workflow/task-delivery.md` § *Repo delivery declarations*, the repository per its § *Branch and worktree creation* → **Which repository**), the draft carries a `G<n> (external)` goal naming the live outcome and its yardstick. A hand-authored `goals.md` lacking one is surfaced, never amended. The gate's execution half is `./references/workflow/task-delivery-edges.md` § *The live-verification gate*. <!-- cold -->

**Goals clarification** uses one batched round for goals that fail the checklist or whose verification class is unclear. Each question names the goal, says which step it changes, and offers options. This round does not settle Step 5's approach choices. A deferred question leaves its goal marked `_(unresolved: <short note>)_` for `review-task` and `implement-task`.

Goals are outcomes, not implementation: "User can export the current filter as CSV" is a goal; "Add a `formatCsv()` helper" is a step.

### 4. Explore the Domain's Reality

Explore before designing, per the domain's exploration guide (`./references/engineering/exploration.md` for code): prior work to model on, blast radius, existing constraints. Confirm what `CONTEXT.md` settles still holds; `## Exploration Findings` carries only this pass's deltas and cites CONTEXT for the rest.

### 5. Evaluate Approaches

Compare viable approaches, including ones the user may not have considered, and recommend a better one when warranted. With only one viable approach, explain the constraint without fabricating alternatives. Weigh alignment with existing patterns, minimum complexity, risk and reversibility, and effort, a line per axis.

Take unresolved impactful approach choices through `./AGENTS.md` § *Ask Before Assuming*, even when goals are clear.
`## Approach` cites CONTEXT's `## Recommended Direction` and records only plan-time refinements.

### 6. Define Scope

- **In scope:** the goals this plan delivers, by ID, and what changes.
- **Out of scope:** the goals deferred, by ID, and what stays unchanged even if related.
- **Boundaries:** where this work ends.

Write the split as the goal-ID partition `./references/workflow/task-goals.md` fixes: explicit lists, no ranges. An exclusion's *why* stays in CONTEXT's "Not Doing"; a `ticket.md`'s In/Out scope fixes the product boundary. Cite both.

### 7. Break Down Steps

Order steps as vertical slices, each delivering one observable outcome end to end, so integration risk surfaces early. Use layers only when a foundational piece has no vertical seam.

Every step carries **What** (one concern, one sentence), **Verify** (how to confirm it worked; a step without one is too vague or too small), **Goal**, and **Depends on**. Format: § *Output*.

- **`Goal:`** the goal IDs the step delivers, or `none (infra/refactor)`. Every goal is delivered by at least one step; `review-task` keys coverage off these lines (`./references/workflow/task-goals.md`).
- **`Due:` / `Lead time:`** *(optional)* for time-anchored domains; omit for code.
- **`Touches:`** *(optional)* the step's declared edit surface. `implement-task` runs steps in parallel only when each declares one, no `Depends on:` path connects them, and the surfaces are pairwise disjoint; undeclared runs serially. Declare only where parallel execution is plausible. For code, `./references/engineering/planning.md` lists the shared-artifact traps.

Split a step whose title contains "and", touches two independent subsystems, or needs more than three acceptance bullets. For code, `./references/engineering/planning.md` adds sizing guidance and worked examples.

### 8. Add Checkpoints

For plans over ~5 steps, insert a **Checkpoint** every 2–3 steps that re-verifies the integrated whole. Skip them for shorter plans, where the last step's verification doubles as the end-to-end check.

A checkpoint names concrete end-to-end outcomes the health recipe cannot prove ("user can log in and see dashboard"); the integrated suite runs at the adjacent health boundary. For code, `./references/engineering/planning.md` gives the assertions. Checkpoints are gates, not steps: no `- [ ]` checkbox. Format: § *Output*.

### 9. Identify Risks

Only risks specific to this task: the concrete scenario, its likelihood given exploration, and the mitigation.

### 10. Flag Open Questions

`## Open Questions` holds only questions that arose during planning and are not in CONTEXT's `## Open Questions`; cite those. An answer to one CONTEXT tracks is surfaced in chat; a reconciler annotates it later (`./references/workflow/reconciliation.md` § *Annotation formats*). <!-- cold -->

## Scaling Plan Depth

Step 3 and Step 5's unresolved-choice gate run at every depth.

- **Medium** (small, clear pattern): Steps 1–4 and 6–10, with Step 5 reduced to its gate: no comparison, but an impactful approach choice the exploration surfaces is still asked; explore only the touched files; scope as the partition plus boundaries; risks only where a step carries the mitigation; open questions only where one gates a step.
- **Large** (bigger, some ambiguity): all steps, moderate detail.
- **Complex** (cross-cutting, structural): all steps, deep exploration, several approaches compared.

For code, `./references/engineering/planning.md` gives file-count proxies.

## Output

**`goals.md`**: copy `./references/templates/goals.md`; `(external)` and `_(unresolved: …)_` are its optional bullet glosses.

**`plan.md`**: copy `./references/templates/plan.md`, adapting the layout to task size. Its link-headers point at `./CONTEXT.md`, `./goals.md`, and `./ticket.md` when present. A doc task's `**Deliverable:**` names the file `./references/workflow/doc-task-files.md` assigns; drop the line otherwise.

The plan starts at `to-do`; `implement-task` flips each `- [ ]` and drives the status (`./references/workflow/task-lifecycle.md`). If the user drops the plan before execution begins, set `**Status:**` to `skipped` rather than deleting it, and add a `result.md` only if the reason is worth recording.

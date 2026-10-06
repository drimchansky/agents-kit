---
name: plan-task
description: Use when asked to plan, design, architect, scope, or break down a feature or change before implementation.
argument-hint: "[task or feature description, task folder or destination path; defaults to the session's task]"
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, `planning.md`, …). If the domain has no pack, run the neutral methodology and say so.

Write two files into the resolved task folder: `goals.md`, the acceptance contract, and `plan.md`, the execution contract `implement-task` runs. Then summarize briefly in chat and point at the files.

## When to Use

**Plan when** the work spans several areas or artifacts, approaches carry real trade-offs, the change hits shared pieces with wide blast radius, requirements need decomposition, or the change is hard to reverse.

**Skip when** the change is single and obvious, the fix is already clear and localized, the user fixed the approach, or the task is smaller than its plan: say so and suggest implementing directly. An idea too vague to scope goes to `refine-idea` first. For code, `./references/engineering/planning.md` gives these heuristics in file counts.

## Inputs

The user's request with any constraints or prior discussion; a slug or destination path when given; the folder's `CONTEXT.md` and, when present, `ticket.md`. Their content is read-only here, apart from the loader's identifier repair in `CONTEXT.md` (§ *Invariants*).

## Invariants

- **One folder, fixed names.** `goals.md` and `plan.md` land beside `CONTEXT.md` in the folder Step 2 resolves, one plan per folder, no slug prefix.
- **Slug.** The folder name is 2–5 lowercase kebab-case words capturing the gist (`add-csv-export`). Derive it; do not ask. Pick a more specific one when it collides with a different effort's folder.
- **Multi-part efforts.** Assess independently useful, verifiable delivery seams before drafting steps (`./references/workflow/task-siblings.md`). Apply `./references/workflow/decomposition.md`'s one-task boundary when deciding whether to propose siblings through `decompose-task`; materialize a confirmed cut only after its proposal.
- **Existing content.** An existing `CONTEXT.md` and hand-authored goal acceptance wording are read, not rewritten. The loader's proven identifier repair is the sole exception for `CONTEXT.md` and `goals.md` (`./references/workflow/task-authorship.md`). `ticket.md` is `/prepare-ticket`'s. Refine `plan.md` through conversation and write it once, unless the user asks for revisions in place.
- **One home per fact.** Cite what the folder already records; the plan carries only this pass's deltas (`./references/workflow/one-home.md` § *One home per fact*).

`goals.md` is a static acceptance input: a `## Goals` list of `G<n>` criteria, no description prose, no `**Status:**` field (`./references/workflow/task-goals.md`). Its proven identifier repair changes no acceptance wording. The reconcilers and `implement-task` may edit semantic content as a judged edit; the latter grades it in the next run (`./references/workflow/task-authorship.md`).

## Planning Process

### 1. Clarify Requirements

Restate the task, separating explicit requirements from assumptions. Ask about critical ambiguities before proceeding. Identify what "done" looks like.

### 2. Resolve the Task Folder and Read CONTEXT.md

Resolve per the **resolve-or-create** rules in `./references/workflow/task-layout.md`; a new folder lands by `./references/workflow/task-destinations.md`. With no argument and a request that names no other work, use the one task this session established, such as the folder `refine-idea` or `prepare-ticket` just wrote; with several, list them and ask. Otherwise derive the slug from the request, asking when it is unclear whether the request continues the established task. Reuse an existing active folder the slug or path resolves to; several plausible matches → list them and ask. Confirm the slug only when it differs meaningfully from what the user typed. For a new folder, fix its path here but create it, with its `CONTEXT.md`, only once Step 7 keeps one task, so a route to `decompose-task` leaves no stray folder.

For an existing folder, run `./references/workflow/task-layout.md` § *Reading a resolved folder* before drafting goals, including its pre-plan `--repair` path. Report applied mappings and unresolved diagnostics. If `state` is null because no plan exists, inspect `goals.md` and task-local references using the repair diagnostics before assigning new IDs. Under an explicit read-only request, inspect existing goal definitions and references manually; the default CLI needs a plan and cannot validate this pre-plan case. Do not draft from an ambiguous identity or treat a failed repair as valid intake.

Read `CONTEXT.md` and `ticket.md`. Surface a missing `./ticket.md` citation in chat rather than editing it in.

**Read inherited grounding** before Step 3: the ancestor `GROUP_CONTEXT.md` files, root to task, per `./references/workflow/task-store.md` § *Shared group context*. They bind the goals, approach, and steps, and add no goal the ask does not carry. `## References`, `## Exploration Findings`, and `## Approach` cite the group file behind an inherited fact rather than copying it (`./references/workflow/context-schema.md`). Outside a registered root nothing is inherited.

**Scaffold a missing `CONTEXT.md`** (for a new folder, when Step 7 creates it) from `./references/templates/CONTEXT.md` per `./references/workflow/context-schema.md`: fill `Problem Statement` from the task description, or cite `./ticket.md` when present. Add `Key Assumptions to Validate` only for actual assumptions; leave no empty headings or template prompts.

**Infer `**Domain:**`** from the task, or carry over what `refine-idea` set. Default to `engineering` for code or ambiguity within a coding context. When the task is clearly non-code and the domain is unclear, ask: a wrong `**Domain:**` loads the wrong rules.

### 3. Draft the Goals

Draft goals before designing the plan, so scope and delivery seams derive from fixed, ID'd outcomes. Write a new `goals.md` after Step 7 selects the one-task boundary and before writing plan steps.

- **Goals exist:** run each through `./references/workflow/acceptance-criteria.md`, restate them naming any that fail, and ask whether to proceed or revise. Never silently overwrite acceptance wording.
- **No goals file:** with a `ticket.md`, sharpen each acceptance criterion into one or more `G<n>` goals (`./references/workflow/ticket-format.md` § *Ticket → goals*). Otherwise draft from the task description and `CONTEXT.md`. Every draft goal passes `./references/workflow/acceptance-criteria.md` before the file is written in Step 7.

A goal confirmable only outside the session, a sign-off or a live state, carries the `(external)` marker (`./references/workflow/acceptance-criteria.md` § *Externally-verified goals — the `(external)` marker*). Unclear which class a goal is → ask.

For engineering tasks, resolve live verification by affected target under `./references/engineering/acceptance-gate.md`, regardless of declarations or goal wording. Add an `(external)` goal only when the requested outcome itself needs downstream confirmation. Do not silently add one to hand-authored goals merely for the gate.

**Goals clarification** uses one batched round for goals that fail the checklist or whose verification class is unclear. Each question names the goal, says which step it changes, and offers options. This round does not settle Step 5's approach choices. A deferred question leaves its goal marked `_(unresolved: <short note>)_` for `review-task` and `implement-task`.

Lead each goal with the benefit or observable behavior for a user, caller, or operator. Internal work may name an operational outcome. Keep thresholds, compatibility obligations, and failure behavior as acceptance details; place commands and test recipes in the delivering step's `Verify`. "User can export the current filter as CSV" is a goal; "Add a `formatCsv()` helper" is a step.

### 4. Explore the Domain's Reality

Explore before designing, per the domain's exploration guide (`./references/engineering/exploration.md` for code): prior work to model on, blast radius, existing constraints. Confirm what `CONTEXT.md` settles still holds; add `## Exploration Findings` only for this pass's deltas and cite CONTEXT for the rest.

### 5. Evaluate Approaches

Compare viable approaches, including ones the user may not have considered, and recommend a better one when warranted. With only one viable approach, explain the constraint without fabricating alternatives. Weigh alignment with existing patterns, minimum complexity, risk and reversibility, and effort, a line per axis.

Take unresolved impactful approach choices through `./AGENTS.md` § *Ask Before Assuming*, even when goals are clear.
When an approach decision is needed, `## Approach` cites CONTEXT's `## Recommended Direction` if present and records only plan-time refinements.

### 6. Define Scope

- **In scope:** the goals this plan delivers, by ID, and what changes.
- **Out of scope:** the goals deferred, by ID, and what stays unchanged even if related.
- **Boundaries:** where this work ends.

Write the split as the goal-ID partition `./references/workflow/task-goals.md` fixes: explicit lists, no ranges. An exclusion's *why* stays in CONTEXT's "Not Doing"; a `ticket.md`'s In/Out scope fixes the product boundary. Cite both.

### 7. Break Down Steps

For an engineering plan, fill the template's `## Live verification` after Scope; drop that section for other domains. List each affected target and its preprod/prod disposition under `./references/engineering/acceptance-gate.md` § *Resolve live targets*. For applicable environments, name expected-release evidence, workload and health checks, the live functional check, and the changed browser journey for frontend targets. Name the verifier and next action for checks that must wait. A justified `not applicable` entry cites the repository evidence for no deployed runtime or absent environment. An unknown target or missing access remains pending, never `not applicable`. Do not force a live check into a new goal or a local implementation step solely to make coverage appear complete.

Assess whether the goals form delivery outcomes that can land and be verified independently. If so, route to `decompose-task` for its proposal and confirmation before this planner creates a new folder or writes new goals or a plan (`./references/workflow/decomposition.md`); goal count alone is not a split rule. Keep a tightly coupled fix together. If the user requested one task, retain one folder and plan while using the seams to bound steps and checkpoints. Write the drafted goals here before writing plan steps.

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

**`plan.md`**: copy `./references/templates/plan.md`, adapting the layout to task size. Its link-headers point at `./CONTEXT.md` and `./goals.md`. When the folder holds a ticket, add `**Ticket:** [./ticket.md](./ticket.md)`. A doc task's `**Deliverable:**` names the file `./references/workflow/doc-task-files.md` assigns. Keep `**Result:** not yet started` until execution creates `result.md`. Add `## Exploration Findings`, `## Approach`, `## Risks`, and `## Open Questions` only when they contain this pass's content. A settled choice's evidence takes the dated decision heading in `./references/workflow/context-schema.md` § *Field notes*. Omit empty optional fields, sections, and literal template prompts.

Place each Step 8 checkpoint after the step it follows, under a `### Checkpoint after Step N` heading where N is that step's number. Beneath it, list each end-to-end outcome as a plain bullet without a `- [ ]` checkbox. Keep that exact heading: `task-state`, `implement-task`, and checkpoint commits match it, so other wording silently drops the gate.

For engineering, include the resolved `## Live verification` section from Step 7. Repository declarations can fill its mapping but are not a prerequisite.

The plan starts at `to-do`; `implement-task` flips each `- [ ]` and drives the status (`./references/workflow/task-lifecycle.md`). If the user drops the plan before execution begins, set `**Status:**` to `skipped` rather than deleting it, and add a `result.md` only if the reason is worth recording.

After writing both files, close the chat with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*):

- **Done:** `goals.md` and `plan.md` written, each pointing at its file, plus a scaffolded `CONTEXT.md` or the loader's applied repair.
- **Know:** the task's handoff token, unresolved loader diagnostics, live-verification targets left pending, a missing `./ticket.md` citation, and an answer to a CONTEXT open question that awaits a reconciler.
- **Awaiting you:** goals marked `_(unresolved: …)_` and `## Open Questions` entries that gate a step, pointing at their files.
- **Next:** `/review-task` for a Large or Complex plan, or one with integration points, shared changes, or new patterns; `/implement-task` otherwise. Both resolve the session's task, so the command prints bare and Know carries the handoff token (`./references/workflow/user-facing-messages.md` § *Blocks*).

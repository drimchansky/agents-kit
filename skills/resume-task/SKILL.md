---
name: resume-task
description: Use when asked to resume, catch up on, brief, hand off, status of, or check progress on a task folder (canonically under `.agents/tasks/`) — prints a brief, then writes its settled corrections to the task. A read-only request produces the brief without edits.
argument-hint: "[task slug or path; defaults to the session's task] [-s]"
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core. This skill mostly observes; pull in deeper pack files only if you dig into a step's work. If the domain has no pack, run the neutral methodology and say so.

Print the full brief before the first edit or folder move. Then apply settled findings to the task's own files. An explicit read-only request ends with the brief. Execute no plan work and change no work products or Git state.

Compare the task with current artifacts. Read a cited external source only when needed to verify a specific claim. Create no briefing file.

## Flags

- `-s`: check the task's cited sources under `./references/workflow/source-check.md` while assembling the brief. Print its References section before the first correction. On a read-only request, report the check and skip all writes. Without the flag, skip this source check.

## When to Use

**Use when** returning to a task, handing off, reviewing progress, or checking whether current work still matches the plan.

**Skip when** execution, acceptance, or blocker resolution is needed → `implement-task`; feasibility is the question → `review-task`. With no task, suggest `refine-idea` or `plan-task`. For a fresh plan with no result, read the plan directly.

## Process

### 1. Resolve the Task Folder

Use **resolve-current-or-ask** in `./references/workflow/task-layout.md` § *Discovery rules for skills*. Accept a full `plan.md` path directly; ask on ambiguous resolution.

For a folder under Backlog, offer activation using `./references/workflow/implement-task-edges.md` § *Activating a backlogged task*. Move the folder only after printing the brief and receiving explicit confirmation on a writable run. <!-- cold -->

### 2. Load Artifacts

Use the read-only loader command in `./references/workflow/task-layout.md` § *Reading a resolved folder* for the initial brief on every run. Load current inherited group grounding. Report `structure.diagnostics` and keep this pre-edit baseline. Defer even proven identifier repairs until the correction phase. When no readable plan exists, say so. Read any `approaches.md` and test each approach-wait entry in `CONTEXT.md` under `./references/workflow/task-approaches.md` § *Approach-wait entries*. Check for execution holds and route the handoff under that file's § *Other readers and writers*. Cite a selected comparison's dated decision in the brief. For a planless task without a comparison, keep the `plan-task` handoff. Do not present coverage as complete when structure is unreliable.

Open only the task artifacts listed below for the brief. Keep the source ledger out of all artifact reads and content searches. Only the requested `-s` check reads that ledger.


- `goals.md`: the full Goals list by `G<n>`, including unresolved markers.
- `result.md`: orient from Current state. Read the relevant step and checkpoint records, the final commit record, Acceptance, Live verification, and Open findings under `./references/workflow/task-result.md`. Capture the active Blocked or In review section verbatim. Read each goal's last verdict in Acceptance. Verify the digest against the underlying records.
- `CONTEXT.md`: Domain, current grounding and Open Questions.
- `plan.md`: Scope, pending steps, Verify, Depends on, Due, Lead time, touched paths, and Open Questions. Take status and goal-file state from the report.
- `approaches.md`, when present: current decision, unresolved questions, and original dated selection evidence. Surface pending discussion without treating it as an approved approach.
- `ticket.md`, when present: the ask and acceptance criteria.

Flag missing context as an incomplete scaffold and missing goals as preventing acceptance. Check `./references/workflow/task-lifecycle.md` § *Status values* and § *Companion result file* for missing companions or required sections. Report `skipped` as abandoned; a missing result there is expected. Report a valid blocked pause with its cause and in-review with its awaited external goals and engineering live checks.

### 3. Reconstruct State from Checkboxes

Use the report's ordered steps, checkboxes, next pending step/body, checkpoint outcomes, and result-anchor resolution. A null checkpoint outcome means not run. For a checked step with `anchorResolves: false`, report the unresolved link. Determine whether it warrants repair under `./references/workflow/task-layout.md` § *Result format before writing*. Prefer checkboxes over conflicting plan prose and note the disagreement.

### 4. Drift Check Against Current Reality

Observe current artifacts even when the result is recent; history alone cannot verify present behavior. Partition claims:

- **Done/shipped**: claims in Shipped blocks or checked steps. Verify each still holds; lost behavior is drift.
- **Commit coverage**: for each checked step with a Commit field, compare the verified work with the contents of its recorded SHA. Use the last Commit field in a merged record. If that revision lacks the verified work, report the mismatch and propose removing the field. Keep a currently verified step checked. A newer commit containing the work supplies no replacement here.
- **Pending**: unchecked work may be absent without drift. If the pending work appears in current artifacts, run the authored Verify and domain per-unit checks before proposing to check it. A path or prior commit alone proves no outcome.
- **Current state**: compare the gloss and Next against markers and completed actions, including delivery after `done`. Tag stale claims `warn` even if Pointers are current. Check local branch/SHA pointers against the repository. State which external pointers went unchecked. A stale digest alone proves no lifecycle or acceptance change.

Compare current inherited constraints with ticket scope, context direction and assumptions, pending steps, shipped claims, and met goals. Quote both conflicting statements and sources. Cite group paths from the selected root and task sections, step numbers, or goal IDs. Tag contradictions `warn`, or `block` when a pending step cannot run as written. A changed chain alone creates no finding. Apply the grounding and group-write terms in `./references/workflow/task-writes.md` to an established conflict.

For code claims, apply `./references/engineering/exploration.md` § *Blast-radius / drift verification (used by review and resume)*. Other domains use their own artifacts and verification recipe.

With Acceptance present, re-check every `met` goal on a done plan. On an executing plan, spot-check reachable met goals. For a current-format task, missing Acceptance on done is `block`; a met goal that no longer holds is `warn`. Carry `pending external` and engineering pending checks as outstanding with what is awaited; neither is drift nor unmet. Historically completed tasks follow `./references/engineering/acceptance-gate.md` § *Acceptance-gate recipe*.

Tag findings `info` (FYI), `warn` (review before resuming), or `block` (update required before execution). Always render Drift since plan, with `No drift detected.` when clean.

### 5. Produce the Brief

Print every applicable section of the template from the pre-edit state. Show the evidence for each proposed correction. On a read-only request or skipped plan, stop with the Handoff and leave every file byte-identical.

### 6. Apply corrections

Apply `./references/workflow/task-writes.md` and `./references/workflow/task-progress.md` to the printed findings. On a model-invoked run, ask before each correction and wait for its answer. Name the affected files and the required Current state refresh. On a user-invoked run apply settled corrections. Refer unresolved impactful choices to the user and preserve them with their options and owner.

- After the brief, run the loader's identifier repair only for authorized corrections. If its atomic repair would include an unapproved mapping, hold it. Report the loader outcome under the task-layout contract before relying on repaired identities.
- Clear unbacked checkboxes and lower disproved lifecycle or goal claims under the progress gate. Verify pending steps before checking them. Apply the progress gate's verification-only Commit rule to existing and newly checked steps. Apply the closing gate if verified advances leave no step open.
- An informational observation alone changes no marker. Report absent goals or context to plan-task. For a cleared external blocker refresh the pointer and route execution to implement-task.
- Apply settled answers at their owning files. Refresh stale Current state and Open findings from the resulting evidence. Print the change list and one Handoff naming remaining decisions and their owners.

## Output Template

```markdown
# Resume: <task title>

**Task dir:** `<resolved task folder path>`
**Goals:** `goals.md`
**Plan:** `plan.md` (Status: <status>)
**Result:** `result.md` or "not yet started"

## Status

<N of M steps done; lifecycle state; acceptance state and external remainder. Mark a quoted Current-state gloss verified or stale after checking it.>

## Goals

- G1 — <goal verbatim, preserving (external)> — _<latest verdict by ID in Acceptance>_

<Keep met-with-caveats notes and pending-external requirements. Without a recorded verdict, use not yet checked; unresolved-marked goals use unresolved.>

## Done

- Step 1 — <title> ([result](./result.md#step-1--<slug>))

## Up next

- Step <N> — <title>
    - **Verify:** <criterion>
    - **Depends on:** <prior step numbers, a sibling task or one of its steps, or "none", as the plan writes it>
    - **Due / Lead time:** <when set>
    - **Touches:** <when set>

## Blocked

<The active Blocked section verbatim>

## In review

<The active In review section verbatim, including awaited external goals>

## Drift since plan

- [warn] <claim, current evidence, consequence>

<When clean: No drift detected.>

## Open findings

<Current unresolved findings, evidence, owner, and next action.>

## Open questions

<Deduplicate context/plan/comparison questions and unresolved goals. Replace questions the result already answers with their answers.>

```

Omit empty sections except Drift since plan. Close after the corrections, or after the brief on a read-only run, with the Handoff from `./references/workflow/user-facing-messages.md` § *Blocks*. Name confirmed changes, the task token, actionable drift, unresolved decisions and approach holds. Give the first executable next action and its command.

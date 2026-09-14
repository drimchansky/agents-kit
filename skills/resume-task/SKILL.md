---
name: resume-task
description: Use when asked to resume, catch up on, brief, hand off, status of, or check progress on a task folder (canonically under `.agents/tasks/`) — produces a chat-only briefing. Read-only.
argument-hint: '[task folder path]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core. This skill mostly observes; pull in deeper pack files only if you dig into a step's work. If the domain has no pack, run the neutral methodology and say so.

Brief an existing task's status, completed work, drift, and next action in chat only. This skill edits no task file, code, or Git state and executes no plan work. Its sole write exception is a user-confirmed Backlog activation move (`./references/workflow/implement-task-edges.md` § *Activating a backlogged task*).

Run no reference sweep. The reconcilers sweep cited links (`./references/workflow/reconciliation-sweep.md` § *Scope*); this citation marks the boundary and is not loaded on any path. <!-- cold -->

Quote `observations.md` with its dates as cached observations, never live state. Claim verification may read URL-hosted domain artifacts under the domain's `verification.md`. Create no `BRIEF.md` or scratch briefing file.

## When to Use

**Use when** returning to a task, handing off, reviewing progress, or checking whether current work still matches the plan.

**Skip when** findings need write-back or cited-reference freshness → `resume-task-reconcile`; session discoveries need recording → `reconcile-task`; execution, acceptance, or blocker resolution is needed → `implement-task`; feasibility is the question → `review-task`. With no task, suggest `refine-idea` or `plan-task`. For a fresh plan with no result, read the plan directly.

## Process

### 1. Resolve the Task Folder

Use **resolve-current-or-ask** in `./references/workflow/task-layout.md` § *Discovery rules for skills*. Accept a full `plan.md` path directly; ask on ambiguous resolution.

For a folder under Backlog, offer activation using `./references/workflow/implement-task-edges.md` § *Activating a backlogged task*. Only explicit confirmation permits the whole-folder move. <!-- cold -->

### 2. Load Artifacts

Apply `./references/workflow/task-layout.md` § *Reading a resolved folder*, including current inherited group grounding. Report exit 1 as no readable `plan.md` and suggest `plan-task`.

Then read what the brief needs beyond the report:

- `goals.md`: the full Goals list by `G<n>`, including unresolved markers.
- `result.md`: orient from `currentState`, then read the latest Step or Full Run. Capture every Blocked and In review block and any Acceptance section verbatim. Treat the digest as derived, unverified metadata. Ignore its legacy Status header (`./references/workflow/task-lifecycle.md` § *`result.md` — no status field*).
- `CONTEXT.md`: the Domain header and Open Questions only.
- `plan.md`: the next step's Due, Lead time, and touched paths, plus Open Questions for the brief. Take status and goal-file state from the report.
- `ticket.md`, when present: the ask and acceptance criteria.
- `observations.md`, when present: dated cached observations (`./references/workflow/task-observations.md`). Absence is normal. <!-- cold -->

Flag missing context as an incomplete scaffold and missing goals as preventing acceptance. Check `./references/workflow/task-lifecycle.md` § *Status values* and § *Companion result file* for missing companions or required sections. Report `skipped` as abandoned; a missing result there is expected. Report a valid blocked pause with its cause and in-review with its awaited external goals.

### 3. Reconstruct State from Checkboxes

Use the report's ordered steps, checkboxes, next pending step/body, checkpoint outcomes, and result-anchor resolution. A null checkpoint outcome means not run. A checked step with `anchorResolves: false` has unbacked evidence: report drift. Prefer checkboxes over conflicting plan prose and note the disagreement.

### 4. Drift Check Against Current Reality

Observe current artifacts even when the result is recent; history alone cannot verify present behavior. Partition claims:

- **Done/shipped**: claims in Shipped blocks or checked steps. Verify each still holds; lost behavior is drift.
- **Pending**: unchecked work may be absent without drift. An already-existing pending artifact warrants `info`.
- **Current state**: compare the gloss and Next against markers and completed actions. Tag stale claims `warn`. Check local branch/SHA pointers against the repository. Fetch no external-system pointer; quote its dated observation or state it was not checked.

Compare current inherited constraints with ticket scope, context direction and assumptions, pending steps, shipped claims, and met goals. Quote both conflicting statements and sources. Cite group paths from the selected root and task sections, step numbers, or goal IDs. Tag contradictions `warn`, or `block` when a pending step cannot run as written. A changed chain alone creates no finding. Propose no edits to group files or the plan (`./references/workflow/task-store.md` § *Shared group context*).

For code claims, apply `./references/engineering/exploration.md` § *Blast-radius / drift verification (used by review and resume)*. Other domains use their own artifacts and verification recipe.

With Acceptance present, re-check every `met` goal on a done plan. The one reduced check requires a watermark, no commits after it, and a clean tree: re-run the cheapest met goal's verifying action and name the branch. On an executing plan, spot-check reachable met goals. Missing Acceptance on done is `block`; a met goal that no longer holds is `warn`. Carry `pending external` as outstanding with what is awaited; it is neither drift nor unmet.

Tag findings `info` (FYI), `warn` (review before resuming), or `block` (update required before execution). Always render Drift since plan, with `No drift detected.` when clean.

Run `node <kit-root>/scripts/commit-scan.ts <task folder>` for commits since watermark. Resolve `<kit-root>` through `./references/workflow/task-store.md` § *Resolving `<kit-root>`*; CLI/JSON: `./references/scripts/commit-scan.md`. <!-- cold -->

Read the reported range; do not re-derive it. Report each returned commit and nominated steps. Include every `candidate` in `steps`, even when its nominating SHAs fall beyond the returned 20 commits. State the cap against `total`. Nominations are leads, never completion evidence (`./references/workflow/reconciliation-commits.md`).

This brief never seeds, re-seeds, or advances a watermark, and never runs a candidate's Verify criterion. Follow `./references/workflow/reconciliation-commits.md` § *Read/write split*.

Render Commits since watermark by scan state:

- `ok`: the commit list or explicit empty-range line, naming any `refFallback`.
- `no-watermark`: missing baseline; nothing scanned.
- `orphaned`: watermark no longer an ancestor of the resolved ref; nothing scanned.
- `no-checkout`: for a store task acting on the session's repository, render `Unscanned` and name that repository. The script cannot reach it from the folder; resolve it under `./references/workflow/reconciliation-commits.md` § *The scan*. Omit the section only when no repository answers or the checkout holds none of the plan's paths.

Unavailable kit root, script, or Node also renders Unscanned with the reason; never imply an empty range.

### 5. Produce the Brief

Print the template to chat with a concrete next action. Stop after the brief; execution belongs to `implement-task`.

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

- G1 — <goal verbatim, preserving (external)> — _<acceptance tag by ID>_

<Keep met-with-caveats notes and pending-external requirements. Without Acceptance, use not yet checked; unresolved-marked goals use unresolved.>

## Done

- Step 1 — <title> ([result](./result.md#step-1--<slug>))

## Up next

- Step <N> — <title>
    - **Verify:** <criterion>
    - **Depends on:** <prior steps>
    - **Due / Lead time:** <when set>
    - **Touches:** <when set>

## Blocked

<Every Blocked block verbatim>

## In review

<In review blocks verbatim, including awaited external goals>

## Drift since plan

- [warn] <claim, current evidence, consequence>

<When clean: No drift detected.>

## Commits since watermark

- <SHA, date, paths, nominated steps; pending candidate or checked info>

<Or one of these lines, following Step 4:>

No commits since <sha> touch a step's paths.
No watermark recorded — baseline missing; nothing scanned. A reconcile run seeds it.
Watermark <sha> is no longer an ancestor of <ref> — orphaned; nothing scanned. A reconcile run re-seeds it.
Unscanned — the task acts on <repo>, which the scan cannot reach from a store-resident folder.

## Open questions

<Deduplicate context/plan questions and unresolved goals. Replace questions the result already answers with their answers.>

## Where to start

<2–3 sentences naming the first file, command, or drift item to resolve.>
```

Omit empty sections except Drift since plan. Commits since watermark follows Step 4's rendering conditions.

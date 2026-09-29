# implement-task: Non-Default Branches

Read the applicable branch when triggered. `implement-task §N` refers to that skill's process step.

## Reviving a skipped plan

First check placement. Slug discovery may resolve Archive (`./task-layout.md`). If archived, stop and have the user move the folder out with manual `mv`, then rerun; archiving is one-way.

Otherwise take the registered `skipped → executing` edge and resume normally. Preserve existing results and append new sections under implement-task §5.

## Activating a backlogged task

At implement-task/resume-task resolution, detect an immediate parent named Backlog case-insensitively (`./task-backlog.md`).

Offer activation to the container's parent, naming both locations. Execution cannot run in parked folders (`./task-backlog.md` § *Planning acts in place; execution activates first*).

- On confirmation, move the whole folder in one operation and continue at its destination.
- On refusal, stop and report that it remains parked.
- If the destination exists, stop and surface the collision without overwriting.

## Task worktree

Creation placement, naming, sanction, and degrade: `./task-delivery.md`. Re-entry, removal, and branch-convention proposals: `./task-delivery-edges.md`.

**Creation** runs at implement-task §3 before executing status, under § *Branch and worktree creation*. Resolve the repository through Which repository, not task-folder placement. Skip silently for documentation/bureaucratic tasks or missing repositories. Announce a resolved repository containing none of the plan's paths. Neither skip records a pointer or degrade. Creation failures follow `./task-delivery.md` § *Branch and worktree creation* → **When creation is unavailable**.

**Re-entry** runs at §1 for implementation after checking § *Verification-only continuation*. A merged or missing recorded branch stops implementation: ask whether to create a fresh follow-up or treat delivery as complete (`./task-delivery-edges.md` § *Re-entry on resume*). With no recorded branch, including a prior degrade, apply §3 creation as a first delivery run.

Announce re-entered/recreated worktrees like new ones. Preserve the recorded branch identity rather than substituting another worktree's branch.

## Automatic parallel batch

Follow `./parallel-batch.md` § *Coordinator-side parallel batch* for placement, frozen shared tree, gates, and cleanup. Announce qualifying steps and eligibility before launch. The coordinator alone writes task files and statuses.

**Eligibility.** Apply all parallel-batch conditions and its serial default when uncertain. Implement-task also requires steps within one checkpoint-bounded batch and explicit disjoint Touches surfaces. Respect Depends on paths. Missing or `none` Touches means serial delegation.

**Run.** Execute serial steps before launch unless they depend directly/transitively on batch steps. Dependent serial steps wait until the integrated batch health boundary. Keep each group in plan order.

**Merge at the batch bound**, applying ordered gates per step in plan order. Coordinator re-proof covers the full outcome tier after incorporation; worktree proof or criterion alone cannot replace it. Serial fallback takes intake instead. Record, check off, and link a step only after it passes, with Executed under implement-task §5. No health command runs between individual merges.

At a checkpoint, run its assertions after every batch step finishes, then one health pass for all accumulated work. Either failure is integrated Stop-the-Line. Without a checkpoint, merge at the natural bound before dependent serial work or acceptance. Run one boundary there; add no invented checkpoint.

## Plan revisions

- Take unresolved impactful revisions through `./execution-recovery.md` § *Scope changes mid-execution* in either mode before dependent writes.
- Revise affected scope/steps in place, adding needed units or removing obsolete ones. Keep numbers stable where possible; insert `Step 3a`/`Step 3b`.
- Record what changed and why in the affected step's Deviations from plan.
- Abandonment requires explicit confirmation before setting skipped (`./task-lifecycle.md`). Record the reason and stop, retaining the plan.

## An open criterion leg

A browser, device, or human check unavailable in-session remains part of the criterion. Name it before launch as explicitly open under `./parallel-batch.md` § *Coordinator-side parallel batch* → **An unexecutable leg is carried open**. Removing it cannot turn partial proof into a pass.

Leave the step unchecked and record the open leg, assertion, and verifier. When it gates an external goal or engineering live check, park in-review with the pending goal verdict or named check. Resume through § *Reaching done from in-review*.

When the user accepts an option containing their verification leg, keep it open until they report the outcome.

## Reaching done from in-review

### Verification-only continuation

When local implementation is complete and only named downstream checks or explicitly open verification legs remain, verify them without re-entering or recreating a task branch solely to observe delivery (`./task-delivery-edges.md` § *Verification source after delivery*). Such a leg may leave its step unchecked; verify the leg, then record and check off the step through implement-task §4 when its criterion passes. A merged or removed branch does not stop this path. Select the finalization health surface through that section: an affected deployable engineering target needs its intended delivered source, while documentation and supported local-only work use current work-product health. When required source proof or its matching health surface is unavailable, keep `in-review` and record the missing proof, owner, and next action in In review and Current state. Missing source proof is pending, not a failed health boundary. A defect found by an actual source-health or live check takes the existing unmet-work path below. A repair needing implementation uses § *Task worktree* and its branch decision; observation grants no new Git or deployment write permission.

For reported external verification, re-gate pending goals against the best available proxy: confirmation, receipt, or reported live state (`./acceptance-criteria.md`). Change each passing Acceptance tag to met and append its confirmation, retaining the original evidence. Independently re-check each engineering live target under `../engineering/acceptance-gate.md`; a reported green state or healthy workload without the expected release is insufficient. Record new observations and retain unresolved checks in In review (`./task-lifecycle.md` § *Companion result file*).

A goal named by In review because a Grounding corrected record rewrote it requires live verification, not a proxy. Append its verdict beside the external goals; unmet or a failed live check returns the plan to executing. A semantic goal edit this run retains implement-task § *Correcting Grounding Where It's Wrong*'s later-run gate. If a future rollout or missing access remains, stay in-review without Completed. Once every check passes or has a supported N/A, run fresh integrated health on the selected surface (`./task-delivery-edges.md` § *Verification source after delivery*; `./execution-loop.md` § *Health boundaries*). An unrelated checkout or historical boundary cannot prove delivered-source health when that source is required.

After success, append the evidence before advancing:

```markdown
## Health boundary — YYYY-MM-DD

**Trigger:** later-run `in-review → done` finalization
**Health:** <the boundary on the selected finalization surface, recorded to the shape the resolved domain fixes (`../engineering/verification.md` § *What a boundary records* for code)>

---
```

Finalize only through implement-task §§7–8 and add Completed. Refresh Current state from the observed release and cleanup outcome without rewriting original Acceptance evidence. A failed boundary produces no success section or finalization: take `in-review → executing`, then §4 Blocked, recording failure and the last green boundary. Review findings requiring changes likewise return to executing.

**Worktree removal comes last** on both this path and direct finalization, after boundary and status updates (`./task-delivery-edges.md` § *Removal*).

- Observed merged PR and clean tree: remove worktree/local branch and record both in this path's dated section, or the direct run's record.
- Dirty, unpushed, or unmerged work: refuse removal and record why there; finalization still stands. Preserve the work without forced removal.

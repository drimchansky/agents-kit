# implement-task: Non-Default Branches

The `implement-task` skill's non-default branches — reviving a `skipped` plan, activating a backlogged task, the diagram re-check, the automatic parallel batch, mid-execution plan revisions, a criterion leg left open for someone else to verify, and the later-run `in-review` → `done` finalization — split out of that skill's SKILL.md, which keeps the loop, the templates, and the gates. Read the section a branch names when its condition fires. An `implement-task §N` reference names that SKILL.md's process step.

## Reviving a skipped plan

**Check where the folder sits first.** A bare slug falls back to `Archive/<slug>/` (`./task-layout.md`) and skipped tasks are the ones that get archived, so a revive can land there — but a live task under `Archive/` is stranded outside every active listing `resume-task` and `review-task` build, and `archive-task` would refuse it as non-terminal. Resolved under `Archive/` → **stop**: have the user move it out (a manual `mv`; archiving is one-way), then re-run.

Otherwise flip `skipped → executing` (the registered revive edge) and continue as a normal run. An existing result file — the record of why the work was dropped — simply stays: the append-only rule holds, and this run's sections append after it (implement-task §5).

## Activating a backlogged task

**Check the container at resolution too** (implement-task §1). The condition is the resolved folder's immediate parent being named `Backlog` — matched case-insensitively (`./task-backlog.md`) — however resolution reached it: the bare-slug container fallback, an explicit folder path, or a `plan.md` path. `resume-task` takes this branch at its own resolution step, on the same terms.

Such a task is parked, and execution does not run on it in place (`./task-backlog.md` § *Planning acts in place; execution activates first*) — location alone carries "parked", so a run left where it lies would leave live work sitting where every active listing excludes it. **Offer activation instead:** name the folder, name the container's parent it would return to, and ask.

- **Confirmed** → `mv` the whole folder to that parent in one operation — one move keeps the folder's internal `./` links intact (the move mechanics `./task-backlog.md` cites) — then continue the run against the new location.
- **Declined** → **stop**, reporting that the task stays parked. Never execute a task in place under `Backlog/`.
- **`<container-parent>/<slug>` already exists** → **stop** and surface it; never clobber it.

The asymmetry with § *Reviving a skipped plan* above is deliberate: an archived task is finished, so getting it back out is the user's own `mv`; a backlogged one is exactly the work this run is about to start, so the move is offered here.

## Diagram re-check

Three points re-check it: **each checkpoint**, **each structural plan revision** (implement-task §6), **the acceptance gate** (implement-task §7). No diagram → skip all three, absence unreported (`./task-diagram.md`).

Compare the drawing against what shipped and record *what was compared* — which nodes and edges, against which files; that record is what keeps the gate off rubber-stamping. Then:

- **Matches** → re-anchor and re-date `**Reflects:**`. No repaint, no render-check.
- **Diverged** → repaint to what shipped, render-check per the pack's diagram guidance (code: `../engineering/planning.md` § *The task diagram*, which owns the notation and the render-check), record the divergence and why in that step's or checkpoint's result section, then re-anchor and re-date the same way.

Either way `**Reflects:**` leaves anchored to the gate — `as of Step N` (the last step completed here) or `as of the acceptance gate` — dated today, replacing the plan-time `as of the plan`.

A divergence is usually information, not failure: the build revealed what the plan didn't anticipate, which is what implement-task §6 surfaces. Stop-the-Line only when the shipped structure contradicts a goal.

## Automatic parallel batch

Eligible independent steps run concurrently through the same contract and binding. Batch mechanics are not restated: worktree placement, the frozen shared tree, the merge gates, and cleanup are `./parallel-batch.md` § *Coordinator-side parallel batch*, run as written there. This section adds only eligibility, merge point, and record.

No flag: when a batch qualifies, launch it and **announce it in chat** — which steps, why eligible — so automatic parallelism is never silent. The contract's invariants hold: the coordinator owns the shared tree, both task files, and every status; executors never touch the task folder.

**Eligibility.** Every condition in the cited section applies as written, its when-in-doubt-run-serially default included. This skill adds:

- the steps sit in the same checkpoint-bounded batch (between the last checkpoint and the next);
- each declares its surface as a `**Touches:**` line — the declared surface the cited disjointness test and surface check read; `Depends on:` is the dependency path they read.

No `**Touches:**` line (or `**Touches:** none`) → serially-delegated.

**Run** per the cited *Run* rules. In a mixed batch, serial steps depending on a batch step — directly or transitively — run only after the batch's declared health boundary on the integrated tree; every other serial step runs before launch; both in plan order.

**Merge at the batch's bound** — run the cited ordered gates per batch step, **in plan order**, plan order being this skill's declared unit order. Its integrated re-proof is that step's full outcome tier — never the health recipe, never the criterion alone; record the step only after it passes, by flipping the checkbox and appending the result section with its `**Executed:**` field (implement-task §5), as in serial execution. The cited mechanics expose each incorporated change set; no project-health command runs between merged steps.

When the batch directly reaches its bounding checkpoint, run that checkpoint's assertions once every batch step has executed — merged or fallen back to serial — then run its health recipe **once** for both the checkpoint and the batch. Failure in either is Stop-the-Line on the integrated tree. Otherwise merge at its natural bound — before the first dependent serial step, or before the acceptance gate for the plan's tail — and don't invent an implicit checkpoint there. At a dependent-work bound, run one health boundary before the dependent step; at the tail, the full-plan boundary runs once before acceptance.

## Plan revisions

- **Update the plan in place** — revise the affected step or scope, add new steps, remove obsolete ones. Keep step numbers stable where possible (insert as `Step 3a`, `Step 3b` rather than renumbering).
- **Record the divergence** under the affected step's `**Deviations from plan:**` field, including *why* the plan changed.
- **Repaint the diagram when the revision changes structure** (only when the task has one), at the revision rather than deferred to the next checkpoint — the revision is the causal event, and in step-by-step mode it is where the user inspects. Same in both modes; run it per § *Diagram re-check* above.
- In step-by-step mode, pause and confirm the revision with the user before continuing.
- **If the right call is to abandon the task** rather than revise it, surface that and get explicit confirmation first — this skill never sets `skipped` on its own (`./task-lifecycle.md`). On confirmation set the plan's `**Status:**` to `skipped`, record why in the result file, and stop — don't delete the plan or leave it dangling in `executing`.

## An open criterion leg

A step's `Verify` sometimes carries a leg nothing in the session can execute — a browser check, a device, a person's eyes. Keeping that leg whole is `./executor-engines-cross-vendor.md` § *Cross-run rules* → **The verify criterion is retargeted, not rewritten**: it is named before launch, carried as an **explicitly open leg**, and never split off to leave a smaller criterion the run can pass. What it costs this skill is here.

**The step is parked, not recorded.** Proving the executable half proves that half and no more, so the checkbox stays unflipped and the step's result section names the open leg, what it asserts, and who is to verify it. A step recorded done on half its criterion puts every later step on an unproved base, which is the failure this branch exists to stop. When the open leg gates a goal, the task lands at `in-review` with that goal's `## Acceptance` line `pending external`, and § *Reaching done from in-review* below is the path out once the user reports the verification happened.

**The offered option's described behavior is the behavior.** Where the run offered the leg to the user and the user took it — they will check it and report back — the run stays open on that leg and closes out only after they do; announcing a hand-off and then closing out as if verified is worse than never having offered.

## Reaching done from in-review

**Reaching `done` from `in-review` (a later re-run).** When the user reports the external verification happened — a confirmation, a receipt, the observed live state — re-run the gate on each `pending external` goal against that **best-available proxy** (`./acceptance-criteria.md`): the user-reported confirmation *is* the sanctioned evidence for an `(external)` goal. Update its `## Acceptance` line to `met`, noting the proxy. Then run a fresh domain health boundary on the current work product — never reuse the earlier tail result, because this record carries no exact boundary identity across runs (`./execution-loop.md` § *Health boundaries*).

On success, append the fresh evidence before advancing status:

```markdown
## Health boundary — YYYY-MM-DD

**Trigger:** later-run `in-review → done` finalization
**Health:** <the boundary on the current work product, recorded to the shape the resolved domain fixes (`../engineering/verification.md` § *What a boundary records* for code)>

---
```

Then finalize to `done` per implement-task §8 and add the `**Completed:**` line. If the fresh boundary fails, do not append the success section and do not finalize: flip the plan through the registered `in-review → executing` edge, then apply implement-task §4's **Blocked** behavior, recording the failed finalization boundary and the last boundary that passed. If review instead surfaced problems, flip the plan back to `executing` and resume — don't force `done`.

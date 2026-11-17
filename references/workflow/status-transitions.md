# Status Transitions: The Non-Forward Registry

Forward vocabulary and companion-result requirements: `./task-lifecycle.md`.

## Downward reconciliation and upward advances

`resume-task-reconcile` and `review-task-reconcile` repair overstated claims through these transitions (`./reconciliation.md`):

- `done → executing`: completed claims fail, a `met` goal regresses, or Acceptance is missing. It also applies when the plan holds an unchecked step, or a current goal's latest verdict by ID across Acceptance and Reconciliation is missing or predates a change in what the goal requires (`./reconciliation.md` § *Grounding docs change on evidence, never silently*). Record the repair in Reconciliation.
- `in-review → executing`: implementation claims behind an agent-verifiable `met` goal or a live check no longer hold. It also applies when the plan holds an unexecuted step, or a current goal's latest verdict by ID across Acceptance and Reconciliation is missing or predates a change in what the goal requires (`./reconciliation.md` § *Grounding docs change on evidence, never silently*). This goal-verdict condition skips a goal that the result's most recent `**In review:**` section names because an in-review re-run's dated `**Grounding corrected:**` line rewrote it (`../../skills/implement-task/SKILL.md` § *Correcting Grounding Where It's Wrong*). The next `implement-task` run re-gates that goal (`./implement-task-edges.md` § *Verification-only continuation*). An unchecked step is unexecuted when `result.md` has no `## Step <n> —` section and no Full Run section that names it. This case skips a step with such a section, such as an open verification leg (`./implement-task-edges.md` § *An open criterion leg*) or a step a commit record covers (`./reconciliation.md` § *Strengthen only on verified evidence*). Record the repair in Reconciliation.
- `executing → to-do`: no result exists and no evidence shows work happened. Create no result; the printed change list records the repair.

Repairs only weaken; never set `skipped`, `blocked`, or `in-review`. Judged content edits leave state unchanged (`./reconciliation-docs-to-reality.md` § *Repairs weaken; advances go through the shared engine*).

Both directions, `reconcile-task` (session → docs) and the composites (docs → reality), may check steps, record `met`, or advance `to-do → executing`, `executing → done`, `executing → in-review`, and `in-review → done`, but only through `./reconciliation.md` § *Strengthen only on verified evidence*, including its external-goal exception.

Reconciliation never sets `skipped` or edits a skipped plan (`./reconciliation.md` § *Skipped plans are exempt*).

## Terminal vs. live states

**Terminal** states are `done` (completed) and `skipped` (abandoned). **Live** states are `to-do`, `executing`, `blocked`, and `in-review`. An in-review task awaits downstream verification and is not finished.

Terminal exits are docs → reality's `done → executing` repair and `implement-task`'s user-confirmed `skipped → executing` revive. These are explicit acts outside forward progression. Moving from Archive is **un-archive**, separate from revive (`./task-archiving.md`).

Skills acting on finished tasks read this terminal set at run time.

`scripts/lifecycle-constants.ts` holds the terminal set, a sanctioned copy per `references/maintenance/repository.md` § *Consumer lists*. Change that copy alongside this set; `scripts/health-check.ts` and `scripts/task-move.ts` consume it.

## Result-side reconciler writes

Results carry no status header. Repairing out of `done` removes `**Completed:**`; `implement-task` restores it on re-finalization. Create missing result skeletons only for evidenced execution. Append one dated Reconciliation section per run under `./reconciliation.md`; preserve prior narrative.

## Adding or renaming statuses

1. Update this registry and `./task-lifecycle.md`'s vocabulary.
2. Update that file's propagate list: `plan-task`, `choose-approach`, `implement-task`, `resume-task`, `review-task`, `resume-task-reconcile`, `review-task-reconcile`, `fix-findings-reconcile`, `reconcile-task`, and `start-group`.
3. Update the machine-readable vocabulary in `scripts/lifecycle-constants.ts` (`references/maintenance/repository.md` § *Consumer lists*).
4. Run `grep -rn '<old-status>' skills/ references/ scripts/` and update remaining vocabulary uses, including templates.

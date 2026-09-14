# Status Transitions: The Non-Forward Registry

Forward vocabulary and companion-result requirements: `./task-lifecycle.md`.

## Downward reconciliation and upward advances

`resume-task-reconcile` and `review-task-reconcile` repair overstated claims through these transitions (`./reconciliation.md`):

- `done → executing`: completed claims fail, a `met` goal regresses, or Acceptance is missing. Record the repair in Reconciliation.
- `in-review → executing`: implementation claims behind an agent-verifiable `met` goal no longer hold. Record the repair in Reconciliation.
- `executing → to-do`: no result exists and no evidence shows work happened. Create no result; the printed change list records the repair.

Repairs only weaken; never set `skipped`, `blocked`, or `in-review`. Judged content edits leave state unchanged (`./reconciliation-docs-to-reality.md` § *Repairs weaken; advances go through the shared engine*).

Both directions, `reconcile-task` (session → docs) and the composites (docs → reality), may check steps, record `met`, or advance `to-do → executing`, `executing → done`, `executing → in-review`, and `in-review → done`, but only through `./reconciliation.md` § *Strengthen only on verified evidence*, including its external-goal exception.

Reconciliation never sets `skipped` or edits a skipped plan (`./reconciliation.md` § *Skipped plans are exempt*).

## Terminal vs. live states

**Terminal** states are `done` (completed) and `skipped` (abandoned). **Live** states are `to-do`, `executing`, `blocked`, and `in-review`. An in-review task awaits external verification and is not finished.

Terminal exits are docs → reality's `done → executing` repair and `implement-task`'s user-confirmed `skipped → executing` revive. These are explicit acts outside forward progression. Moving from Archive is **un-archive**, separate from revive (`./task-archiving.md`).

Skills acting on finished tasks read this terminal set at run time.

`scripts/lifecycle-constants.ts` holds the terminal set, a sanctioned copy per `AGENTS.md` § *Consumer lists*. Change that copy alongside this set; `scripts/health-check.ts` and `scripts/task-move.ts` consume it.

## Result-side reconciler writes

Results carry no status header. Repairing out of `done` removes `**Completed:**`; `implement-task` restores it on re-finalization. Create missing result skeletons only for evidenced execution. Append one dated Reconciliation section per run under `./reconciliation.md`; preserve prior narrative.

## Adding or renaming statuses

1. Update this registry and `./task-lifecycle.md`'s vocabulary.
2. Update that file's propagate list: `plan-task`, `implement-task`, `resume-task`, `review-task`, `resume-task-reconcile`, `review-task-reconcile`, and `reconcile-task`.
3. Update the machine-readable vocabulary in `scripts/lifecycle-constants.ts` (`AGENTS.md` § *Consumer lists*).
4. Run `grep -rn '<old-status>' skills/ references/ scripts/` and update remaining vocabulary uses, including templates.

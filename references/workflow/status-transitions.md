# Status Transitions: The Non-Forward Registry

Forward vocabulary and companion-result requirements: `./task-lifecycle.md`.

## Non-forward transitions

Apply [Task progress](./task-progress.md#downward-repairs) for `done → executing`, `in-review → executing`, and `executing → to-do`. Apply [Plan status](./task-progress.md#plan-status) for `blocked → executing`. Apply the [revive gate](./task-progress.md#downward-repairs) before `skipped → executing`.

## Terminal vs. live states

**Terminal** states are `done` (completed) and `skipped` (abandoned). **Live** states are `to-do`, `executing`, `blocked`, and `in-review`. An in-review task awaits downstream verification and is not finished.

Moving from Archive is **un-archive**, separate from revive (`./task-archiving.md`).

Skills acting on finished tasks read this terminal set at run time.

`scripts/lifecycle-constants.ts` holds the terminal set, a sanctioned copy per `references/maintenance/repository.md` § *Consumer lists*. Change that copy alongside this set. `scripts/health-check.ts` and `scripts/task-move.ts` consume it.

## Adding or renaming statuses

1. Update this registry and `./task-lifecycle.md`'s vocabulary.
2. Update the consumers named in that file's propagation list.
3. Update the machine-readable vocabulary in `scripts/lifecycle-constants.ts` (`references/maintenance/repository.md` § *Consumer lists*).
4. Search `skills/`, `references/`, and `scripts/` for the old status. Update its remaining uses, including templates.

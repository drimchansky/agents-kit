# Task Lifecycle: Status Registry

When a status name or transition changes, propagate it to `plan-task`, `choose-approach`, `implement-task`, `resume-task`, `review-task`, `fix-findings`, and `start-group`. This registry includes field consumers without direct citations. `archive-task`, `backlog-task`, and `maintain` read the vocabulary at run time and need no update.

Layout: `./task-layout.md`; authorship: `./task-authorship.md`; goals/observations: `./task-goals.md`, `./task-observations.md`; containers: `./task-archiving.md`, `./task-backlog.md`.

## Status values

`scripts/lifecycle-constants.ts` holds the plan vocabulary, a sanctioned copy per `references/maintenance/repository.md` § *Consumer lists*.

Only `plan.md` carries task lifecycle status. A documentation deliverable uses its format sheet's separate vocabulary (`./doc-task-files.md`). Other closed sets are sweep tags (`./source-check.md`) and Acceptance verdicts (`./acceptance-criteria.md`, `./execution-acceptance.md` § *Acceptance discipline*).

### `CONTEXT.md` — no status field

Context has no Status header or lifecycle. Apply `./task-authorship.md` for authorship.

Task writers correct verified grounding and record settled answers under `./task-writes.md`. Apply the write surface in `./task-authorship.md`.

### `goals.md` — no status field

Goals are static input authored before or alongside the plan, without Status or lifecycle. Authorship follows `./task-authorship.md`.

### `plan.md` — lifecycle: `to-do` → `executing` → `done` (or `skipped`); `executing` ⇄ `blocked`; `executing` → `in-review` → `done`; `in-review` → `executing`

- **`to-do`**: `plan-task` created the plan; execution has not begun.
- **`executing`**: execution has begun or a task writer verified work under `./task-progress.md`. The result exists.
- **`blocked`**: execution awaits an external party, dependency, or decision, or a failure cannot be resolved this session. Enter only from executing; return there when cleared. `implement-task` or the user sets it. Record cause, attempts, and required unblock evidence in Blocked, with no Completed line. This is a pause, not abandonment.
- **`in-review`**: implementation and all agent-verifiable goals are satisfied, including acknowledged caveats and authorized deferrals; only outside verification remains. This includes `(external)` goals and engineering live checks without goal IDs (`../engineering/acceptance-gate.md`). Enter from executing through the acceptance gate under `./task-progress.md`. Return to executing when verification reveals failed work. Advance to done through the same gate. Result carries In review with awaited external goals and verifiers, plus engineering pending checks (§ *Companion result file*). Acceptance carries pending-external verdicts for marked goals, and no Completed line.
- **`done`**: the acceptance gate satisfied every goal and applicable engineering live check. `implement-task` enters from executing when no downstream remainder exists, or from in-review after confirmation. Every verified advance takes the gate in `./task-progress.md`. Result carries Acceptance and the dated Completed line.
- **`skipped`**: deliberate abandonment, reachable from to-do or executing. The user decides; `plan-task` or `implement-task` may record that decision, but implement-task never chooses abandonment independently. It is terminal and archivable. A result is optional and records why, without Completed. Only explicit user confirmation permits `implement-task` to revive skipped → executing, creating or updating result as needed.

### `result.md` — no status field

Create result lazily at execution start. It carries no lifecycle header; apply § *Companion result file* and `./task-authorship.md`.

Legacy Status headers in result or context are ignored, unrepaired, and never drift. This includes old context values `refined`, `drafted-by-plan-task`, and `seeded-by-decompose-task`.

Use `./status-transitions.md` for non-forward transitions, terminal exits, and vocabulary changes.

## Companion result file

Apply [Task result](./task-result.md) for section contents and the shape check. Check file existence against plan status:

- `to-do`: no result yet.
- `executing`, `blocked`, `in-review`, `done`: result exists.
- `skipped`: result is optional. When present it records abandonment.

`resume-task` and `review-task` flag missing required companions or records. Live executing, blocked, and in-review plans expect a Current state block. A done plan needs the closing `**Completed:** YYYY-MM-DD` line. Flag missing causes or pending checks based on available evidence.

Goals and observations owe no companion invariant. A missing goals file is a briefing gap. Absent observations is normal.

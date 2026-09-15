# Task Lifecycle: Status Registry

When a status name or transition changes, propagate it to `plan-task`, `implement-task`, `resume-task`, `review-task`, `resume-task-reconcile`, `review-task-reconcile`, and `reconcile-task`. This registry includes field consumers without direct citations. `archive-task`, `backlog-task`, and `maintain` read the vocabulary at run time and need no update.

Layout: `./task-layout.md`; authorship: `./task-authorship.md`; goals/observations: `./task-goals.md`, `./task-observations.md`; containers: `./task-archiving.md`, `./task-backlog.md`.

## Status values

`scripts/lifecycle-constants.ts` holds the plan vocabulary, a sanctioned copy per `AGENTS.md` § *Consumer lists*.

Only `plan.md` carries task lifecycle status. A documentation deliverable uses its format sheet's separate vocabulary (`./doc-task-files.md`). Other closed sets are sweep tags (`./reconciliation-sweep.md` § *Tags*) and Acceptance verdicts (`./acceptance-criteria.md`, `./execution-acceptance.md` § *Acceptance discipline*).

### `CONTEXT.md` — no status field

Context has no Status header or lifecycle. Apply `./task-authorship.md` for authorship.

**Reconciliation carve-out.** `reconcile-task`, `resume-task-reconcile`, and `review-task-reconcile` may minimally annotate References/Open Questions: dated broken links, moved URLs, sourced answers, contradiction rulings, and pending Awaiting decision choices in Open Questions. They may rewrite prose as judged edits under `./reconciliation.md` § *Grounding docs change on evidence, never silently*. Findings must evidence every edit; add nothing outside those annotations and rewrites. Evidence-settled corrections and prior decisions need no renewed input; unresolved impactful choices remain pending under that consent contract. `implement-task` may correct only sections its execution disproves, under its Correcting Grounding rules.

### `goals.md` — no status field

Goals are static input authored before or alongside the plan, without Status or lifecycle. Authorship follows `./task-authorship.md`.

### `plan.md` — lifecycle: `to-do` → `executing` → `done` (or `skipped`); `executing` ⇄ `blocked`; `executing` → `in-review` → `done`; `in-review` → `executing`

- **`to-do`**: `plan-task` created the plan; execution has not begun.
- **`executing`**: `implement-task` began execution; result exists.
- **`blocked`**: execution awaits an external party, dependency, or decision, or a failure cannot be resolved this session. Enter only from executing; return there when cleared. `implement-task` or the user sets it. Record cause, attempts, and required unblock evidence in Blocked, with no Completed line. This is a pause, not abandonment.
- **`in-review`**: implementation and all agent-verifiable goals are satisfied, including acknowledged caveats and authorized deferrals; only marked `(external)` goals await outside verification. Enter from executing through the acceptance gate or reconciliation's verified advance (`./status-transitions.md`). Return to executing when review requires work, including docs-to-reality repair. Advance to done through `implement-task` or reconciliation's shared verification engine. No external goals means no in-review. Result carries In review with each awaited goal and verifier, Acceptance with pending-external verdicts, and no Completed line.
- **`done`**: the acceptance gate satisfied every goal. `implement-task` enters from executing when no external remainder exists, or from in-review after confirmation. Either reconciliation direction may also advance through `./reconciliation.md` § *Strengthen only on verified evidence*. Result carries Acceptance and the dated Completed line.
- **`skipped`**: deliberate abandonment, reachable from to-do or executing. The user decides; `plan-task` or `implement-task` may record that decision, but implement-task never chooses abandonment independently. It is terminal and archivable. A result is optional and records why, without Completed. Only explicit user confirmation permits `implement-task` to revive skipped → executing, creating or appending result as needed. Reconcilers neither revive nor reconcile skipped plans.

### `result.md` — no status field

Create result lazily at execution start. It carries no lifecycle header; apply § *Companion result file* and `./task-authorship.md`.

Legacy Status headers in result or context are ignored, unrepaired, and never drift. This includes old context values `refined`, `drafted-by-plan-task`, and `seeded-by-decompose-task`.

Use `./status-transitions.md` for non-forward transitions, terminal exits, and vocabulary changes.

## Companion result file

Check file existence and required sections against plan status:

- `to-do`: no result yet.
- `executing`: result exists.
- `blocked`: Blocked names the external wait or unresolved failure; no closing Completed. A complete paused pair is conformant.
- `in-review`: In review lists pending `(external)` goals and verifiers; Acceptance tags them pending external; no closing Completed. A complete parked pair is conformant.
- `done`: Acceptance and closing `**Completed:** YYYY-MM-DD` exist.
- `skipped`: result is optional; when present it records abandonment, with no closing Completed.

`resume-task` and `review-task` flag missing required companions or sections. Reconcile composites may create a skeleton when work is evidenced or repair executing to to-do when none is. They flag missing causes or pending goals rather than inventing them.

Goals and observations owe no companion invariant. A missing goals file is a briefing gap; absent observations is normal.

# Task Lifecycle: Status Registry

A task folder holds four core artifacts that share a slug but play distinct roles, plus two optional role files — an upstream `ticket.md` and a derived `observations.md`. Only `plan.md` carries a `**Status:**` header drawn from a closed vocabulary; the grounding file, the result file, the goals file, the ticket, and the observations file deliberately have none. **This file is the single source of truth for lifecycle states.** When a status name or transition changes, update it here first and propagate to the skills that read or write these fields: `plan-task`, `implement-task`, `resume-task`, `review-task`, `resume-task-reconcile`, `review-task-reconcile`, and `reconcile-task`. (`archive-task`, `backlog-task`, and `maintain` also read this vocabulary, but at run time, so they need no update.) Directory layout (the flat task folder and its discovery) is documented separately in the sibling `task-layout.md`; the role-file contracts sit beside it in `./task-goals.md` and `./task-observations.md`, `Archive/` in `./task-archiving.md`, and `Backlog/` in `./task-backlog.md`.

Per-file authorship — who creates and mutates each of these files, the `## Current state` block contract, and the `## Decision log` rule — lives in the sibling `./task-authorship.md`; read it when writing any task-folder file.

## Status values

The `plan.md` vocabulary below has one machine-readable copy — `scripts/lifecycle-constants.ts`, which the scripts import because none of them can read this prose at run time. It is a sanctioned copy per `AGENTS.md` § *Consumer lists*, which names its importers: change a status name here and change it there in the same edit, or every task in the renamed state reads as `unknown` to every script that judges one.

**That lifecycle is the only `**Status:**` vocabulary a task folder registers.** A doc task's deliverable carries a `**Status:**` header too, but draws its values from its format sheet (`./doc-task-files.md`). The folder's only other closed value sets are the reference sweep's tags (`./reconciliation-sweep.md` § *Tags*) and the goal verdicts an `## Acceptance` section carries (`./acceptance-criteria.md`, tagged at the gate per `./execution-acceptance.md` § *Acceptance discipline*).

### `CONTEXT.md` — no status field

The grounding file carries no `**Status:**` header and no lifecycle, so it registers no vocabulary here. Authorship and the write surface are in the Files bullet in `./task-authorship.md`.

**Reconciliation carve-out.** The one exception to "never mutated after creation": the three reconcilers — `reconcile-task`, `resume-task-reconcile`, `review-task-reconcile` (shared contract in the sibling `reconciliation.md`) — may append minimal annotations inside the `## References` and `## Open Questions` sections — marking a dead link broken (with date and error), updating a moved URL, noting an answered question with its answer and source, recording an engineer's ruling on a flagged contradiction (in `## Open Questions`) — and may rewrite a prose section, but only through a confirmed judgment item (`./reconciliation.md` § *Grounding docs change by confirmation, never silently*). None rewrites or deletes prose unconfirmed, or adds content outside those two sections and the confirmed rewrite.

### `goals.md` — no status field

The goals file is a static input authored before (or alongside) the plan. It carries no `**Status:**` header and no lifecycle, so it registers no vocabulary here. Authorship and the write surface are in the Files bullet in `./task-authorship.md`.

### `plan.md` — lifecycle: `to-do` → `executing` → `done` (or `skipped`); `executing` ⇄ `blocked`; `executing` → `in-review` → `done`; `in-review` → `executing`

- **`to-do`** — written by `plan-task`; not yet executed.
- **`executing`** — set by `implement-task` when it begins execution. Implies a companion `result.md` exists.
- **`blocked`** — execution can't proceed, for one of two reasons: the work is **waiting on something external** (another person, an institution, a vendor, a dependency, a pending decision), **or it's stuck on a failure that can't be resolved this session**. Reachable only from `executing`, and returns to `executing` when the blocker clears or the failure is fixed. Implies a companion result file carrying a `**Blocked:**` section that names the cause — what's awaited, or what failed, what was tried, and what's needed to unblock — and no closing `**Completed:**` line. A blocked plan is **paused, not abandoned** — use `skipped` to abandon. Set by `implement-task` or the user; cleared back to `executing` when work resumes.
- **`in-review`** — implementation is complete and every *agent-verifiable* goal is satisfied (`met`, an acknowledged caveat, or authorized out-of-scope), but one or more goals marked `(external)` in `goals.md` remain unverified because their verification happens outside the session — a human/client sign-off, or a live/production state the agent can't drive in-session. Reachable only from `executing`; advances to `done` when a later run — `implement-task`, or a reconciler through the shared engine — confirms the pending `(external)` goals under everything that advance owes (`./reconciliation.md` § *Strengthen only on verified evidence*, the one home for those preconditions), or returns to `executing` when review sends work back. Implies a companion result file carrying an `**In review:**` section that lists each pending `(external)` goal — what's awaited and who/what verifies it — an `## Acceptance` section tagging those goals `pending external`, and **no** closing `**Completed:**` line. Set by `implement-task` at the acceptance gate, and entered one further way registered in `./status-transitions.md`: a reconciler's verified advance through the shared engine. A task with no `(external)` goals never enters this state. That return to `executing` is an ordinary non-terminal edge, and the docs → reality repair also takes it, registered in `./status-transitions.md`.
- **`done`** — set by `implement-task` when the acceptance gate passes with every goal satisfied — reached from `executing` (no external goals) or from `in-review` (the external goals now confirmed, on the preconditions `./reconciliation.md` § *Strengthen only on verified evidence* fixes). Implies a companion result file carrying the gate's `## Acceptance` section and a closing `**Completed:** YYYY-MM-DD` line. Also entered by a reconciler's verified advance through the shared engine, in either direction, registered in `./status-transitions.md`.
- **`skipped`** — the plan was deliberately abandoned without being carried to completion: a triage or scoping decision, not a failure. Terminal — the forward lifecycle stops here, and `archive-task` treats it as finished. Reachable from `to-do` (never started) or `executing` (started, then dropped). Set by the user, or by `plan-task` / `implement-task` when the user decides not to proceed — `implement-task` never sets it on its own. A companion result file is **optional**: write one only to record why the work was dropped. The one exit is a **revive**: `implement-task` flips `skipped → executing` on explicit user confirmation, never on its own. The companion invariant holds either way — `implement-task` creates a result file when none exists and appends to one that does. Reconcilers never revive; a `skipped` plan is exempt from reconciliation entirely (`./reconciliation.md`).

### `result.md` — no status field

The result file carries no `**Status:**` header and no lifecycle of its own: the plan's status is the task's single lifecycle home, and everything a plan state implies about the result — that the file exists at all, the `**Blocked:**` / `**In review:**` / `## Acceptance` sections, the closing `**Completed:**` line — is registered against that state above and collected in § *Companion result file*. The file is created lazily by `implement-task` at the start of execution. Authorship and the write surface are in the Files bullet in `./task-authorship.md`.

A folder written before this rule may still carry a `**Status:**` line in its result header: it is **legacy**, readers ignore it, nothing repairs it, and its presence is never drift. A `CONTEXT.md` written before the grounding file lost its own field may likewise still carry a `**Status:**` line (`refined`, `drafted-by-plan-task`, `seeded-by-decompose-task`), legacy on the same terms.

The registered **non-forward** transitions — the reconcilers' downward repairs and upward advances, the terminal-state exit registry — and the procedure for changing this vocabulary live in the sibling `./status-transitions.md`; read it when taking or auditing one of those transitions, or when changing the vocabulary.

## Companion result file

The plan carries the only lifecycle status, so what it owes its companion result file is a **file-existence and section invariant**, never a second status to keep in step:

- Plan `to-do` → no result file yet.
- Plan `executing` → a result file exists.
- Plan `blocked` → the result carries a `**Blocked:**` section naming the cause (external wait or unresolved failure) and no closing `**Completed:**` line. A deliberately paused pair — **not** drift.
- Plan `in-review` → the result carries an `**In review:**` section listing the pending `(external)` goals, an `## Acceptance` section tagging each of them `pending external`, and no closing `**Completed:**` line. A deliberately parked pair — **not** drift.
- Plan `done` → the result carries the gate's `## Acceptance` section and a closing `**Completed:** YYYY-MM-DD` line.
- Plan `skipped` → a result file is optional; its absence is **not** drift. When one exists it documents why the plan was abandoned, with no closing `**Completed:**` line.

A plan in `executing` or past it with no companion result file, or one missing the section its state owes, signals an incomplete `implement-task` initialization. `resume-task` and `review-task` should flag this as drift; their reconcile composites repair what can be repaired — a skeleton result file when work is evidenced, the plan back to `to-do` when it is not — and flag the rest, a cause or a pending goal being content no reconciler may invent.

The goals file and the observations file owe no such invariant — neither is the plan's execution record. They differ on absence: `resume-task` should flag a plan with no sibling goals file, since `plan-task` is expected to produce one; a missing `observations.md` is never flagged, because the ledger exists only once a sweep has run.

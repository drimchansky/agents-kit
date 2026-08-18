# Task Lifecycle: Status Registry

A task folder holds four core artifacts that share a slug but track distinct lifecycles, plus three optional role files — an upstream `ticket.md`, a `diagram.md`, and a derived `observations.md`. Three of the artifacts carry a `**Status:**` header drawn from a closed vocabulary; the goals file, the ticket, the diagram, and the observations file deliberately have none. **This file is the single source of truth for lifecycle states.** When a status name or transition changes, update it here first and propagate to the skills that read or write these fields: `refine-idea`, `plan-task`, `decompose-task`, `implement-task`, `resume-task`, `review-task`, `resume-task-reconcile`, `review-task-reconcile`, `reconcile-task`, and `review-pr-triage-verify-reconcile`. (`archive-task`, `backlog-task`, and `maintain` also read this vocabulary, but at run time, so they need no update.) Directory layout (the flat task folder and its discovery) is documented separately in the sibling `task-layout.md`; the role-file contracts sit beside it in `./task-goals.md`, `./task-diagram.md`, and `./task-observations.md`, `Archive/` in `./task-archiving.md`, and `Backlog/` in `./task-backlog.md`.

Per-file authorship — who creates and mutates each of these files, the `## Current state` block contract, and the `## Decision log` rule — lives in the sibling `./task-authorship.md`; read it when writing any task-folder file.

## Status values

### `CONTEXT.md` — origin marker (never mutated after creation)

- **`refined`** — produced by `refine-idea` Phase 3. The recommended direction is chosen, MVP scope is sketched, and the file is ready for `plan-task` to consume.
- **`drafted-by-plan-task`** — produced by `plan-task` as a skeleton when no idea step ran. Placeholder sections are intentional; the user enriches them over time.
- **`seeded-by-decompose-task`** — produced by `decompose-task` when materializing a confirmed decomposition part beside its `ticket.md` (see `./decomposition.md` § *Materialization contract*): Problem Statement cites the part's `./ticket.md`, References carry the source pointer and duplicated shared facts, Open Questions the proposal's gate-nothing items that touch the part. The remaining placeholder sections are intentional; `plan-task` and the user enrich them downstream.

**Docs → reality annotation carve-out.** The one exception to "never mutated": the reconcile composites `resume-task-reconcile` / `review-task-reconcile` (shared contract in the sibling `reconciliation.md`) may append minimal annotations inside the `## References` and `## Open Questions` sections only — marking a dead link broken (with date and error), updating a moved URL, noting an answered question with its answer and source, recording an engineer's ruling on a flagged contradiction (in `## Open Questions`). It never touches the `**Status:**` marker, never rewrites or deletes existing prose, and never adds content outside those two sections. `reconcile-task` (session → docs) has a broader carve-out — it may also rewrite prose sections, but only through a confirmed judgment item, and it too never touches the `**Status:**` marker (see `./reconciliation.md`).

### `goals.md` — no status field

The goals file is a static input authored before (or alongside) the plan. It carries no `**Status:**` header and no lifecycle, so it registers no vocabulary here. Authorship and the write surface are in the Files bullet in `./task-authorship.md`.

### `diagram.md` — no status field

The diagram carries no `**Status:**` header and no lifecycle either, so it registers no vocabulary here and sits outside the pairing rule. Currency rides on the dated `**Reflects:**` line defined in `./task-diagram.md`, re-dated by `implement-task` at each gate that re-checks it. Authorship and the write surface are in the Files bullet in `./task-authorship.md`.

### `plan.md` — lifecycle: `to-do` → `executing` → `done` (or `skipped`); `executing` ⇄ `blocked`; `executing` → `in-review` → `done`; `in-review` → `executing`

- **`to-do`** — written by `plan-task`; not yet executed.
- **`executing`** — set by `implement-task` when it begins execution. Implies a companion `result.md` exists.
- **`blocked`** — execution can't proceed, for one of two reasons: the work is **waiting on something external** (another person, an institution, a vendor, a dependency, a pending decision), **or it's stuck on a failure that can't be resolved this session**. Reachable only from `executing`, and returns to `executing` when the blocker clears or the failure is fixed. Implies a companion result file in `blocked` carrying a `**Blocked:**` section that names the cause — what's awaited, or what failed and what's needed to unblock. A blocked plan is **paused, not abandoned** — use `skipped` to abandon. Set by `implement-task` or the user; cleared back to `executing` when work resumes.
- **`in-review`** — implementation is complete and every *agent-verifiable* goal is satisfied (`met`, an acknowledged caveat, or authorized out-of-scope), but one or more goals marked `(external)` in `goals.md` remain unverified because their verification happens outside the session — a human/client sign-off, or a live/production state the agent can't drive in-session. Reachable only from `executing`; advances to `done` when the external checks are confirmed (a re-run of `implement-task` / `reconcile-task` re-checks each pending goal against its best-available proxy) **and the later run's fresh integrated-health boundary passes**, or returns to `executing` when review sends work back. Earlier boundary evidence is not reusable across runs because current records carry no exact work-product identity. Implies a companion result file in `in-review` carrying an `**In review:**` section that lists each pending `(external)` goal — what's awaited and who/what verifies it — and **no** closing `**Completed:**` line. Set by `implement-task` at the acceptance gate. A task with no `(external)` goals never enters this state. That return to `executing` is an ordinary non-terminal edge, and two reconcilers also take it: the docs → reality repair, and `review-pr-triage-verify-reconcile`'s append-driven reopen — both registered in `./status-transitions.md`.
- **`done`** — set by `implement-task` when the acceptance gate passes with every goal satisfied — reached from `executing` (no external goals) or from `in-review` (the external goals are now confirmed and the later run's fresh integrated-health boundary passed).
- **`skipped`** — the plan was deliberately abandoned without being carried to completion: a triage or scoping decision, not a failure. Terminal — the forward lifecycle stops here, and `archive-task` treats it as finished. Reachable from `to-do` (never started) or `executing` (started, then dropped). Set by the user, or by `plan-task` / `implement-task` when the user decides not to proceed — `implement-task` never sets it on its own. A companion result file is **optional**: write one only to record why the work was dropped. The one exit is a **revive**: `implement-task` flips `skipped → executing` on explicit user confirmation, never on its own. The pair stays valid either way — `implement-task` creates a result file when none exists, and ensures an existing one is `executing` (the result has no `to-do` state). Reconcilers never revive; a `skipped` plan is exempt from reconciliation entirely (`./reconciliation.md`).

### `result.md` — lifecycle: `executing` → `done`; `executing` ⇄ `blocked`; `executing` → `in-review` → `done`; `in-review` → `executing`

The result file is created lazily by `implement-task` directly in `executing`; it has no `to-do` state.

- **`executing`** — created by `implement-task` at the start of execution.
- **`blocked`** — set alongside the plan's `blocked` status when work pauses — on an external dependency or on an unresolved failure; carries a `**Blocked:**` section naming the cause (what is awaited, or what failed, what was tried, and what's needed to unblock). Returns to `executing` when the blocker clears; no closing `**Completed:**` line while blocked.
- **`in-review`** — set alongside the plan's `in-review` status when implementation is complete but one or more `(external)` goals await verification outside the session. Carries an `**In review:**` section listing each pending `(external)` goal — what's awaited and who/what verifies it — and the `## Acceptance` section tags those goals `pending external`. No closing `**Completed:**` line while in-review. Advances to `done` when the external checks are confirmed and the later run's fresh integrated-health boundary passes, or returns to `executing` when review sends work back.
- **`done`** — set by `implement-task` at finalization, alongside a closing `**Completed:** YYYY-MM-DD` line.

The registered **non-forward** transitions — the reconcilers' downward repairs and upward advances, the append-driven reopen, the terminal-state exit registry — and the procedure for changing this vocabulary live in the sibling `./status-transitions.md`; read it when taking or auditing one of those transitions, or when changing the vocabulary.

## Pairing rule

The plan and its companion result file track in lockstep once execution begins:

- Plan `to-do` → no result file yet.
- Plan `executing` → result file `executing`.
- Plan `blocked` → result file `blocked`, carrying a `**Blocked:**` section that names the cause (external wait or unresolved failure). A deliberately paused pair — **not** drift.
- Plan `in-review` → result file `in-review`, carrying an `**In review:**` section that lists the pending `(external)` goals. A deliberately parked pair — **not** drift.
- Plan `done` → result file `done`.
- Plan `skipped` → result file optional; its absence is **not** drift. When one exists it documents why the plan was abandoned, and may stay `executing` (work started then stopped) with no closing `**Completed:**` line.

A plan in `executing` with no companion result file (or a mismatched pair) signals an incomplete `implement-task` initialization. `resume-task` and `review-task` should flag this as drift; their reconcile composites repair it — a skeleton result file when work is evidenced, the plan back to `to-do` when it is not.

The goals file, the diagram, and the observations file are not part of the pairing rule — none has a lifecycle state to compare. They differ on absence: `resume-task` should flag a plan with no sibling goals file, since `plan-task` is expected to produce one; a missing `diagram.md` or `observations.md` is never flagged, because `plan-task` is expected to produce a diagram only when the change warrants it, and the ledger exists only once a sweep has run.

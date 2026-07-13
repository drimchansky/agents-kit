# Task Lifecycle: Status Registry

A task folder holds four core artifacts that share a slug but track distinct lifecycles, plus an optional upstream `ticket.md`. Three of the artifacts carry a `**Status:**` header drawn from a closed vocabulary; the goals file and the ticket deliberately have none. **This file is the single source of truth for lifecycle states.** When a status name or transition changes, update it here first and propagate to the skills that read or write these fields: `refine-idea`, `plan-task`, `implement-task`, `resume-task`, `review-task`, and `reconcile-task`. (`migrate-task-format` and `archive-task` also read this vocabulary, but at run time, so they need no update.) Directory layout (the flat task folder, the optional `ticket.md`, and `Archive/`) is documented separately in the sibling `task-layout.md`.

## Files

- **`ticket.md`** (optional) — the product-facing ask, upstream of the four core artifacts (see `./ticket-format.md`).
  - No `**Status:**` field.
  - Authored by the user or `prepare-ticket`, and freely edited by the user. `refine-idea` and `plan-task` read it and derive `CONTEXT.md` / `goals.md` from it; the lifecycle never mutates it. `reconcile-task` treats it as read-only too — a changed ask is surfaced for the user, never written (see `./reconciliation.md`).
- **`CONTEXT.md`** — the task's static grounding context (capitalized).
  - `**Status:**` is a one-shot **origin marker**.
  - Created by `refine-idea` or `plan-task`; never mutated after creation, except the reconcile-mode carve-outs below: the `-r` annotation carve-out (minimal annotations in `## References` / `## Open Questions` only), and `reconcile-task`'s session → docs carve-out (prose sections rewritten only through a confirmed judgment item). Both leave the `**Status:**` marker immutable; see `./reconciliation.md`.
- **`goals.md`** — the task's goals: the acceptance criteria for what "done" looks like.
  - No `**Status:**` field.
  - Drafted by `plan-task` before the plan, or hand-authored; freely edited by user. `reconcile-task` (session → docs) may also add or reword a goal, but only through a confirmed judgment item and obeying the durable-`G<n>` scheme (see `./reconciliation.md`).
- **`plan.md`** — the contract: scope, steps, verify criteria.
  - `**Status:**` is a **lifecycle state**.
  - Created by `plan-task` (`to-do`); transitioned by `implement-task`; reconciled downward by the `-r` reconcile mode of `resume-task` / `review-task`, and reconciled by `reconcile-task` — which, in the session → docs direction, may also advance state *upward* on in-session verified evidence (shared contract in the sibling `reconciliation.md`).
- **`result.md`** — append-only execution record.
  - `**Status:**` is a **lifecycle state**.
  - Created and transitioned by `implement-task`. The `-r` reconcile mode appends `## Reconciliation` sections, may flip `done → executing`, and may create a skeleton result file to repair a broken pairing. `reconcile-task` also appends `## Reconciliation` sections and may advance state on in-session verified evidence.

The field name `Status:` is shared across the three status-bearing files even though it carries two different kinds of value (origin marker vs. lifecycle state). The values themselves are disjoint, so there's no collision in practice — but be aware of the dual meaning when scanning across files. The goals file sits outside this scheme entirely; it is a static input that evolves through user edits (and, only by a confirmed judgment item, `reconcile-task` — see the goals bullet above).

## Status values

### `CONTEXT.md` — origin marker (never mutated after creation)

- **`refined`** — produced by `refine-idea` Phase 3. The recommended direction is chosen, MVP scope is sketched, and the file is ready for `plan-task` to consume.
- **`drafted-by-plan-task`** — produced by `plan-task` as a skeleton when no idea step ran. Placeholder sections are intentional; the user enriches them over time.

**Reconcile-mode (`-r`) annotation carve-out.** The one exception to "never mutated": the `-r` reconcile mode of `resume-task` / `review-task` (shared contract in the sibling `reconciliation.md`) may append minimal annotations inside the `## References` and `## Open Questions` sections only — marking a dead link broken (with date and error), updating a moved URL, noting an answered question with its answer and source, recording an engineer's ruling on a flagged contradiction (in `## Open Questions`). It never touches the `**Status:**` marker, never rewrites or deletes existing prose, and never adds content outside those two sections. `reconcile-task` (session → docs) has a broader carve-out — it may also rewrite prose sections, but only through a confirmed judgment item, and it too never touches the `**Status:**` marker (see `./reconciliation.md`).

### `goals.md` — no status field

The goals file is a static input authored before (or alongside) the plan. It carries no `**Status:**` header and no lifecycle. It can be drafted by `plan-task` (which asks clarifying questions when requirements are unclear) or hand-authored by the user. Other skills read it; only the user mutates it.

### `plan.md` — lifecycle: `to-do` → `executing` → `done` (or `skipped`); `executing` ⇄ `blocked`; `executing` → `in-review` → `done`; `in-review` → `executing`

- **`to-do`** — written by `plan-task`; not yet executed.
- **`executing`** — set by `implement-task` when it begins execution. Implies a companion `result.md` exists.
- **`blocked`** — execution can't proceed, for one of two reasons: the work is **waiting on something external** (another person, an institution, a vendor, a dependency, a pending decision), **or it's stuck on a failure that can't be resolved this session**. Reachable only from `executing`, and returns to `executing` when the blocker clears or the failure is fixed. Implies a companion result file in `blocked` carrying a `**Blocked:**` section that names the cause — what's awaited, or what failed and what's needed to unblock. A blocked plan is **paused, not abandoned** — use `skipped` to abandon. Set by `implement-task` or the user; cleared back to `executing` when work resumes.
- **`in-review`** — implementation is complete and every *agent-verifiable* goal is satisfied (`met`, an acknowledged caveat, or authorized out-of-scope), but one or more goals marked `(external)` in `goals.md` remain unverified because their verification happens outside the session — a human/client sign-off, or a live/production state the agent can't drive in-session. A **voluntary hand-off**, not a failure: distinct from `blocked`, which is an *involuntary pause* on a prerequisite or failure. Reachable only from `executing`; advances to `done` when the external checks are confirmed (a re-run of `implement-task` / `reconcile-task` re-checks each pending goal against its best-available proxy), or returns to `executing` when review sends work back. Implies a companion result file in `in-review` carrying an `**In review:**` section that lists each pending `(external)` goal — what's awaited and who/what verifies it — and **no** closing `**Completed:**` line. Set by `implement-task` at the acceptance gate. A task with no `(external)` goals never enters this state.
- **`done`** — set by `implement-task` when the acceptance gate passes with every goal satisfied — reached from `executing` (no external goals) or from `in-review` (the external goals are now confirmed).
- **`skipped`** — the plan was deliberately abandoned without being carried to completion: a triage or scoping decision, not a failure. Terminal. Reachable from `to-do` (never started) or `executing` (started, then dropped). Set by the user, or by `plan-task` / `implement-task` when the user decides not to proceed — `implement-task` never sets it on its own and will not execute a plan already marked `skipped` without explicit confirmation. A companion result file is **optional**: write one only to record why the work was dropped.

**Downward reconciliation by the `-r` reconcile mode** (`resume-task` / `review-task`; shared contract in the sibling `reconciliation.md`). Three plan transitions repair docs that overstate reality: `done → executing` when a done plan's claims no longer hold (shipped work vanished, a `met` goal regressed, or the `## Acceptance` section is missing — the gate never ran), recorded in a matching `## Reconciliation` entry in the result file; `in-review → executing` when an in-review plan's implementation claims no longer hold (the shipped work behind a `met` agent-verifiable goal vanished); and `executing → to-do` when a plan sits in `executing` with no result file and no evidence work happened — here no result file exists or is created, so the printed change list is the record. Reconciliation never sets `done` or `skipped`, and introduces `blocked` or `in-review` only by copying an already-evidenced sibling value (see the pairing rule). `reconcile-task` reconciles in the opposite (session → docs) direction and *may* advance state upward — check a step, mark a goal `met`, flip `to-do → executing → done` (or `executing → in-review` when the only unsatisfied goals are `(external)` ones still awaiting their proxy), or flip `in-review → done` — but only after re-verifying the claim in-session the way the acceptance gate would, never on a bare chat claim. The one sanctioned exception is a goal marked `(external)`: its best-available proxy — the confirmation, receipt, or observed live state the user reports — *is* legitimate evidence (see `./acceptance-criteria.md`), so `in-review → done` may advance on that proxy (shared contract in `./reconciliation.md`).

**Terminal vs. live states.** `done` and `skipped` are the two **terminal** plan states — a plan in either is finished and advances no further (`done` = completed, `skipped` = abandoned). `to-do`, `executing`, `blocked`, and `in-review` are **non-terminal** (live) — an `in-review` task is awaiting external verification, not finished. A skill that acts only on finished tasks — e.g. `archive-task` — reads this terminal set from here at run time rather than baking the names into itself, which is why a change to this vocabulary needs no edit in those skills (a non-terminal `in-review` task is refused, as intended).

### `result.md` — lifecycle: `executing` → `done`; `executing` ⇄ `blocked`; `executing` → `in-review` → `done`; `in-review` → `executing`

The result file is created lazily by `implement-task` directly in `executing`; it has no `to-do` state.

- **`executing`** — created by `implement-task` at the start of execution.
- **`blocked`** — set alongside the plan's `blocked` status when work pauses — on an external dependency or on an unresolved failure; carries a `**Blocked:**` section naming the cause (what is awaited, or what failed, what was tried, and what's needed to unblock). Returns to `executing` when the blocker clears; no closing `**Completed:**` line while blocked.
- **`in-review`** — set alongside the plan's `in-review` status when implementation is complete but one or more `(external)` goals await verification outside the session. Carries an `**In review:**` section listing each pending `(external)` goal — what's awaited and who/what verifies it — and the `## Acceptance` section tags those goals `pending external`. No closing `**Completed:**` line while in-review. Advances to `done` when the external checks are confirmed, or returns to `executing` when review sends work back.
- **`done`** — set by `implement-task` at finalization, alongside a closing `**Completed:** YYYY-MM-DD` line.

The `-r` reconcile mode may flip a result `done → executing` alongside the matching plan flip, removing the closing `**Completed:**` line (header metadata, not narrative; `implement-task` re-adds it on re-finalize). It may also create the result file directly in `executing` (skeleton header only) to repair a broken pairing when execution is evidenced, and it appends `## Reconciliation — YYYY-MM-DD` sections — a recognized append-only section type written only by the reconcile mode, one per run.

## Pairing rule

The plan and its companion result file track in lockstep once execution begins:

- Plan `to-do` → no result file yet.
- Plan `executing` → result file `executing`.
- Plan `blocked` → result file `blocked`, carrying a `**Blocked:**` section that names the cause (external wait or unresolved failure). A deliberately paused pair — **not** drift.
- Plan `in-review` → result file `in-review`, carrying an `**In review:**` section that lists the pending `(external)` goals. A deliberately parked pair — **not** drift.
- Plan `done` → result file `done`.
- Plan `skipped` → result file optional; its absence is **not** drift. When one exists it documents why the plan was abandoned, and may stay `executing` (work started then stopped) with no closing `**Completed:**` line.

A plan in `executing` with no companion result file (or a mismatched pair) signals an incomplete `implement-task` initialization. `resume-task` and `review-task` should flag this as drift; their `-r` reconcile mode repairs it — a skeleton result file when work is evidenced, the plan back to `to-do` when it is not.

The goals file is not part of the pairing rule — it has no lifecycle state to compare. `resume-task` should still flag if a plan exists without a sibling goals file, since `plan-task` is expected to produce one.

## Adding or renaming statuses

When changing the vocabulary:

1. Update **this file** first (the registry).
2. Update the skills that read or write the field: `refine-idea`, `plan-task`, `implement-task`, `resume-task`, `review-task`, and `reconcile-task`.
3. `grep -rn "<old-status>" skills/ references/` to catch stragglers (template literals, prose mentions).

# Task Lifecycle: Status Registry

A task folder holds four artifacts that share a slug but track distinct lifecycles. Three carry a `**Status:**` header drawn from a closed vocabulary; the goals file deliberately has no status. **This file is the single source of truth for lifecycle states.** When a status name or transition changes, update it here first and propagate to the skills that read or write these fields: `refine-idea`, `plan-task`, `implement-task`, `resume-task`, and `review-task`. (`migrate-task-format` and `archive-task` also read this vocabulary, but at run time, so they need no update.) Directory layout (the flat task folder and `archive/`) is documented separately in the sibling `task-layout.md`.

## Files

- **`CONTEXT.md`** — the task's static grounding context (capitalized).
  - `**Status:**` is a one-shot **origin marker**.
  - Created by `refine-idea` or `plan-task`; never mutated after creation.
- **`goals.md`** — the task's goals: the acceptance criteria for what "done" looks like.
  - No `**Status:**` field.
  - Drafted by `plan-task` before the plan, or hand-authored; freely edited by user.
- **`plan.md`** — the contract: scope, steps, verify criteria.
  - `**Status:**` is a **lifecycle state**.
  - Created by `plan-task` (`to-do`); transitioned by `implement-task`.
- **`result.md`** — append-only execution record.
  - `**Status:**` is a **lifecycle state**.
  - Created and transitioned by `implement-task`.

The field name `Status:` is shared across the three status-bearing files even though it carries two different kinds of value (origin marker vs. lifecycle state). The values themselves are disjoint, so there's no collision in practice — but be aware of the dual meaning when scanning across files. The goals file sits outside this scheme entirely; it is a static input that evolves only through user edits.

## Status values

### `CONTEXT.md` — origin marker (never mutated after creation)

- **`refined`** — produced by `refine-idea` Phase 3. The recommended direction is chosen, MVP scope is sketched, and the file is ready for `plan-task` to consume.
- **`drafted-by-plan-task`** — produced by `plan-task` as a skeleton when no idea step ran. Placeholder sections are intentional; the user enriches them over time.

### `goals.md` — no status field

The goals file is a static input authored before (or alongside) the plan. It carries no `**Status:**` header and no lifecycle. It can be drafted by `plan-task` (which asks clarifying questions when requirements are unclear) or hand-authored by the user. Other skills read it; only the user mutates it.

### `plan.md` — lifecycle: `to-do` → `executing` → `done` (or `skipped`); `executing` ⇄ `blocked`

- **`to-do`** — written by `plan-task`; not yet executed.
- **`executing`** — set by `implement-task` when it begins execution. Implies a companion `result.md` exists.
- **`blocked`** — execution can't proceed, for one of two reasons: the work is **waiting on something external** (another person, an institution, a vendor, a dependency, a pending decision), **or it's stuck on a failure that can't be resolved this session**. Reachable only from `executing`, and returns to `executing` when the blocker clears or the failure is fixed. Implies a companion result file in `blocked` carrying a `**Blocked:**` section that names the cause — what's awaited, or what failed and what's needed to unblock. A blocked plan is **paused, not abandoned** — use `skipped` to abandon. Set by `implement-task` or the user; cleared back to `executing` when work resumes.
- **`done`** — set by `implement-task` when the last step completes.
- **`skipped`** — the plan was deliberately abandoned without being carried to completion: a triage or scoping decision, not a failure. Terminal. Reachable from `to-do` (never started) or `executing` (started, then dropped). Set by the user, or by `plan-task` / `implement-task` when the user decides not to proceed — `implement-task` never sets it on its own and will not execute a plan already marked `skipped` without explicit confirmation. A companion result file is **optional**: write one only to record why the work was dropped.

**Terminal vs. live states.** `done` and `skipped` are the two **terminal** plan states — a plan in either is finished and advances no further (`done` = completed, `skipped` = abandoned). `to-do`, `executing`, and `blocked` are **non-terminal** (live). A skill that acts only on finished tasks — e.g. `archive-task` — reads this terminal set from here at run time rather than baking the names into itself, which is why a change to this vocabulary needs no edit in those skills.

### `result.md` — lifecycle: `executing` → `done`; `executing` ⇄ `blocked`

The result file is created lazily by `implement-task` directly in `executing`; it has no `to-do` state.

- **`executing`** — created by `implement-task` at the start of execution.
- **`blocked`** — set alongside the plan's `blocked` status when work pauses — on an external dependency or on an unresolved failure; carries a `**Blocked:**` section naming the cause (what is awaited, or what failed, what was tried, and what's needed to unblock). Returns to `executing` when the blocker clears; no closing `**Completed:**` line while blocked.
- **`done`** — set by `implement-task` at finalization, alongside a closing `**Completed:** YYYY-MM-DD` line.

## Pairing rule

The plan and its companion result file track in lockstep once execution begins:

- Plan `to-do` → no result file yet.
- Plan `executing` → result file `executing`.
- Plan `blocked` → result file `blocked`, carrying a `**Blocked:**` section that names the cause (external wait or unresolved failure). A deliberately paused pair — **not** drift.
- Plan `done` → result file `done`.
- Plan `skipped` → result file optional; its absence is **not** drift. When one exists it documents why the plan was abandoned, and may stay `executing` (work started then stopped) with no closing `**Completed:**` line.

A plan in `executing` with no companion result file (or a mismatched pair) signals an incomplete `implement-task` initialization. `resume-task` and `review-task` should flag this as drift.

The goals file is not part of the pairing rule — it has no lifecycle state to compare. `resume-task` should still flag if a plan exists without a sibling goals file, since `plan-task` is expected to produce one.

## Adding or renaming statuses

When changing the vocabulary:

1. Update **this file** first (the registry).
2. Update the skills that read or write the field: `refine-idea`, `plan-task`, `implement-task`, `resume-task`, and `review-task`.
3. `grep -rn "<old-status>" skills/ references/` to catch stragglers (template literals, prose mentions).

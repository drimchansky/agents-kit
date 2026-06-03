# Task Lifecycle: Status Registry

Task directories consist of four artifacts that share a slug but track distinct lifecycles. Three carry a `**Status:**` header drawn from a closed vocabulary; the spec file deliberately has no status. **This file is the single source of truth for lifecycle states.** When a status name or transition changes, update it here first and propagate to the skills that read or write these fields: `refine-idea`, `plan-task`, `implement-plan`, `resume-task`, and `review-task`. Directory layout (standalone vs. project-grouped tasks, `PROJECT.md`, `archive/`) is documented separately in the sibling `task-layout.md`.

## Files

- **`CONTEXT.md`** — shared, static context for every plan in the directory.
  - `**Status:**` is a one-shot **origin marker**.
  - Created by `refine-idea` or `plan-task`; never mutated after creation.
- **`<task-slug>.spec.md`** — per-plan acceptance criteria; what "done" looks like.
  - No `**Status:**` field.
  - Drafted by `plan-task` before the plan, or hand-authored; freely edited by user.
- **`<task-slug>.plan.md`** — the contract: scope, steps, verify criteria.
  - `**Status:**` is a **lifecycle state**.
  - Created by `plan-task` (`to-do`); transitioned by `implement-plan`.
- **`<task-slug>.result.md`** — append-only execution record.
  - `**Status:**` is a **lifecycle state**.
  - Created and transitioned by `implement-plan`.

The field name `Status:` is shared across the three status-bearing files even though it carries two different kinds of value (origin marker vs. lifecycle state). The values themselves are disjoint, so there's no collision in practice — but be aware of the dual meaning when scanning across files. The spec file sits outside this scheme entirely; it is a static input that evolves only through user edits.

## Status values

### `CONTEXT.md` — origin marker (never mutated after creation)

- **`refined`** — produced by `refine-idea` Phase 3. The recommended direction is chosen, MVP scope is sketched, and the file is ready for `plan-task` to consume.
- **`drafted-by-plan-task`** — produced by `plan-task` as a skeleton when no idea step ran. Placeholder sections are intentional; the user enriches them over time.

### `<task-slug>.spec.md` — no status field

The spec is a static input authored before (or alongside) the plan. It carries no `**Status:**` header and no lifecycle. It can be drafted by `plan-task` (which asks clarifying questions when requirements are unclear) or hand-authored by the user. Other skills read it; only the user mutates it.

### `<task-slug>.plan.md` — lifecycle: `to-do` → `executing` → `done` (or `skipped`)

- **`to-do`** — written by `plan-task`; not yet executed.
- **`executing`** — set by `implement-plan` when it begins execution. Implies a companion `<task-slug>.result.md` exists.
- **`done`** — set by `implement-plan` when the last step completes.
- **`skipped`** — the plan was deliberately abandoned without being carried to completion: a triage or scoping decision, not a failure. Terminal. Reachable from `to-do` (never started) or `executing` (started, then dropped). Set by the user, or by `plan-task` / `implement-plan` when the user decides not to proceed — `implement-plan` never sets it on its own and will not execute a plan already marked `skipped` without explicit confirmation. A companion result file is **optional**: write one only to record why the work was dropped.

### `<task-slug>.result.md` — lifecycle: `executing` → `done`

The result file is created lazily by `implement-plan` directly in `executing`; it has no `to-do` state.

- **`executing`** — created by `implement-plan` at the start of execution.
- **`done`** — set by `implement-plan` at finalization, alongside a closing `**Completed:** YYYY-MM-DD` line.

## Pairing rule

The plan and its companion result file track in lockstep once execution begins:

- Plan `to-do` → no result file yet.
- Plan `executing` → result file `executing`.
- Plan `done` → result file `done`.
- Plan `skipped` → result file optional; its absence is **not** drift. When one exists it documents why the plan was abandoned, and may stay `executing` (work started then stopped) with no closing `**Completed:**` line.

A plan in `executing` with no companion result file (or a mismatched pair) signals an incomplete `implement-plan` initialization. `resume-task` and `review-task` should flag this as drift.

The spec file is not part of the pairing rule — it has no lifecycle state to compare. `resume-task` should still flag if a plan exists without a sibling spec, since `plan-task` is expected to produce one.

## Adding or renaming statuses

When changing the vocabulary:

1. Update **this file** first (the registry).
2. Update the skills that read or write the field: `refine-idea`, `plan-task`, `implement-plan`, `resume-task`, and `review-task`.
3. `grep -rn "<old-status>" skills/ references/` to catch stragglers (template literals, prose mentions).

# Task Lifecycle: Status Registry

Tasks live in `.agents/tasks/<slug>/` and consist of three artifacts that share a slug but track distinct lifecycles. Each file carries a `**Status:**` header drawn from a closed vocabulary. **This file is the single source of truth.** When a status name or transition changes, update it here first and propagate to the four skills that read or write these fields: `refine-idea`, `design-plan`, `implement-plan`, `resume-task`.

## Files

| File                    | Purpose                                                | `**Status:**` is...        | Set / mutated by                                                                  |
| ----------------------- | ------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------- |
| `CONTEXT.md`            | Shared, static context for every plan in the directory | A one-shot **origin marker** | Created by `refine-idea` or `design-plan`; never mutated after creation         |
| `<task-slug>.plan.md`   | The contract: scope, steps, verify criteria            | A **lifecycle state**        | Created by `design-plan` (`to-do`); transitioned by `implement-plan`            |
| `<task-slug>.result.md` | Append-only execution record                           | A **lifecycle state**        | Created and transitioned by `implement-plan`                                    |

The field name `Status:` is shared across all three files even though it carries two different kinds of value (origin marker vs. lifecycle state). The values themselves are disjoint, so there's no collision in practice — but be aware of the dual meaning when scanning across files.

## Status values

### `CONTEXT.md` — origin marker (never mutated after creation)

- **`refined`** — produced by `refine-idea` Phase 3. The recommended direction is chosen, MVP scope is sketched, and the file is ready for `design-plan` to consume.
- **`drafted-by-design-plan`** — produced by `design-plan` as a skeleton when no idea step ran. Placeholder sections are intentional; the user enriches them over time.

### `<task-slug>.plan.md` — lifecycle: `to-do` → `executing` → `done`

- **`to-do`** — written by `design-plan`; not yet executed.
- **`executing`** — set by `implement-plan` when it begins execution. Implies a companion `<task-slug>.result.md` exists.
- **`done`** — set by `implement-plan` when the last step completes.

### `<task-slug>.result.md` — lifecycle: `executing` → `done`

The result file is created lazily by `implement-plan` directly in `executing`; it has no `to-do` state.

- **`executing`** — created by `implement-plan` at the start of execution.
- **`done`** — set by `implement-plan` at finalization, alongside a closing `**Completed:** YYYY-MM-DD` line.

## Pairing rule

The plan and its companion result file track in lockstep once execution begins:

- Plan `to-do` → no result file yet.
- Plan `executing` → result file `executing`.
- Plan `done` → result file `done`.

A plan in `executing` with no companion result file (or a mismatched pair) signals an incomplete `implement-plan` initialization. `resume-task` and `review-plan` should flag this as drift.

## Adding or renaming statuses

When changing the vocabulary:

1. Update **this file** first (the registry).
2. Update the four skills that read or write the field: `refine-idea`, `design-plan`, `implement-plan`, `resume-task`.
3. `grep -rn "<old-status>" skills/ references/` to catch stragglers (template literals, prose mentions).

# Task Layout: Directories and Discovery

How task artifacts are arranged on disk, and how skills discover them. **This file is the single source of truth for layout.** Status values and transitions live in the sibling `task-lifecycle.md`; this file covers where files sit and how they're found. Cited by `plan-task`, `implement-task`, `resume-task`, and `review-task`.

## One task, one flat folder

A task lives in a single flat folder under `.agents/tasks/`, named for its slug. The folder name *is* the slug — the single handoff token passed between `refine-idea` → `plan-task` → `implement-task`. Inside sit four role-named files, found by their fixed names (never by a path someone typed):

```
.agents/tasks/<slug>/
├── CONTEXT.md     # static grounding context (origin marker + inputs)
├── spec.md        # acceptance criteria — what "done" means
├── plan.md        # the contract: scope, steps, verify criteria
└── result.md      # append-only execution record
```

One plan per folder. `CONTEXT.md` is capitalized; `spec.md`, `plan.md`, and `result.md` are lowercase. A skill finds each file by its fixed role name (convention/glob), so moving or archiving a folder never breaks a path. The in-folder `**Context:**` / `**Spec:**` / `**Plan:**` / `**Result:**` link-headers point at `./CONTEXT.md`, `./spec.md`, `./plan.md`, and `./result.md` — stable `./` links that survive folder moves.

## Multi-part efforts: sibling folders

A larger effort that won't fit one plan becomes several independent sibling task folders, not one folder holding many plans. Each sibling is a complete task folder (its own `CONTEXT.md` + `spec.md`/`plan.md`/`result.md`). When the parts have a blocking order, express it with an `NN-` prefix on the folder names — the only place ordering can live, since the folders are otherwise independent:

```
.agents/tasks/01-schema/
.agents/tasks/02-api/
.agents/tasks/03-ui/
```

There is no shared layer above these folders — no shared context file, no cross-folder links. Anything a sibling needs is duplicated into its own `CONTEXT.md`. This keeps every folder self-sufficient: discoverable, movable, and archivable on its own.

## Archiving finished tasks (optional)

A completed (`done`) or `skipped` task folder can be moved into an `archive/` subdirectory of `.agents/tasks/` to keep the active list short:

```
.agents/tasks/archive/<slug>/
```

Moving a whole task folder preserves its internal `./` links, since every cross-reference inside the folder is relative to the folder itself. Nothing else needs rewriting.

## Discovery rules for skills

When resolving which task to act on:

- **Explicit path or slug given** → resolve it to `.agents/tasks/<slug>/` and use it.
- **No slug given** → list candidate task folders directly under `.agents/tasks/`, but **exclude `archive/`** — it is a container, not a task.
- **A requested slug isn't among the active folders** → look inside `.agents/tasks/archive/<slug>/` before giving up; a finished task may have been archived there.

Once the folder is resolved, the four files are found by their fixed role names — no stem-globbing, no path a user typed.

Archived tasks are intentionally absent from the default active listing — that is the point of archiving, not a discovery bug.

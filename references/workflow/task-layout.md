# Task Layout: Directories and Discovery

How task artifacts are arranged on disk, and how skills discover them. **This file is the single source of truth for layout.** Status values and transitions live in the sibling `task-lifecycle.md`; this file covers where files sit and how they're found. Cited by `refine-idea`, `plan-task`, `implement-task`, `resume-task`, `review-task`, `migrate-task-format`, and `archive-task`.

## One task, one flat folder

A task lives in a single flat folder, named for its slug. A task folder is defined by its **contents** — the role-named files below — not by its address: any folder holding them is a task folder, wherever it sits on disk. The **canonical root**, `<project-root>/.agents/tasks/`, is the default location: where skills create task folders when no path is given, the only place a bare slug resolves, and the only place discovery listing scans. The folder name *is* the slug — the handoff token passed between `refine-idea` → `plan-task` → `implement-task`; for a folder in the canonical root the bare slug suffices, for one anywhere else the handoff token is the folder's path. Inside sit four role-named files, found by their fixed names (never by a path someone typed):

```
.agents/tasks/<slug>/        # the canonical default — but any parent directory works
├── CONTEXT.md     # static grounding context (origin marker + inputs)
├── goals.md       # acceptance criteria — what "done" means
├── plan.md        # the contract: scope, steps, verify criteria
└── result.md      # append-only execution record
```

One plan per folder. `CONTEXT.md` is capitalized; `goals.md`, `plan.md`, and `result.md` are lowercase. A skill finds each file by its fixed role name (convention/glob), so moving, relocating, or archiving a folder never breaks a path. The in-folder `**Context:**` / `**Goals:**` / `**Plan:**` / `**Result:**` link-headers point at `./CONTEXT.md`, `./goals.md`, `./plan.md`, and `./result.md` — stable `./` links that survive folder moves.

## The goals file: durable IDs, cited by step

`goals.md` is the single source of task intent — the testable acceptance criteria for what "done" means (the quality bar lives in the sibling `acceptance-criteria.md`). Every other artifact *references* it by ID rather than restating intent. Its shape:

```markdown
# Goals: <task title>
**Plan:** [./plan.md](./plan.md)

## Goals
- G1 — <testable, observable outcome>
- G2 — <testable, observable outcome>
```

Like the spec it replaces, `goals.md` is a static input — it carries no `**Status:**` field and no `## Description`; the title and the goals themselves carry the intent.

- **Durable, never-renumbered IDs.** Each goal carries a `G<n>` ID assigned once. Removing a goal **retires** its number (a gap is fine — deleting `G2` leaves `G1, G3`); a new goal takes the next free number, never a retired one. This is what lets a plan step cite `G2` and keep pointing at the same goal across user edits between sessions.
- **Steps cite the goals they deliver.** Every plan step carries a `**Goal:**` line naming the goal ID(s) it delivers (`**Goal:** G1, G3`) — or the explicit escape `**Goal:** none (infra/refactor)` for a step that delivers no user-visible goal. Coverage is then mechanical: every goal ID maps to at least one delivering step, and every non-escaped step to at least one goal.
- **Scope is a partition of goal IDs.** A plan's `## Scope` says which goals it delivers and which it defers, by explicit ID list (e.g. `delivered: G1, G3 · deferred: G4`), instead of re-prosing intent. Do not use ranges: retired goal IDs can leave gaps, so `G1-G3` is ambiguous once `G2` has been removed. Each goal is either in this plan or deferred to another — the partition is what makes goals↔scope drift unwritable.

## Multi-part efforts: sibling folders

A larger effort that won't fit one plan becomes several independent sibling task folders, not one folder holding many plans. Each sibling is a complete task folder (its own `CONTEXT.md` + `goals.md`/`plan.md`/`result.md`). When the parts have a blocking order, express it with an `NN-` prefix on the folder names — the only place ordering can live, since the folders are otherwise independent:

```
.agents/tasks/01-schema/
.agents/tasks/02-api/
.agents/tasks/03-ui/
```

There is no shared layer above these folders — no shared context file, no cross-folder links. Anything a sibling needs is duplicated into its own `CONTEXT.md`. This keeps every folder self-sufficient: discoverable, movable, and archivable on its own.

A multi-part effort's siblings belong in **one parent directory** — the `NN-` ordering is only visible where the folders sort together, and location-relative archiving keeps finished parts (`<parent>/archive/01-schema/`) beside the live ones.

## Archiving finished tasks (optional)

Archiving is **location-relative**: a finished task folder moves into an `archive/` subdirectory of whatever directory contains it — the same rule at every location:

```
<parent>/<slug>/  →  <parent>/archive/<slug>/      # canonically: .agents/tasks/archive/<slug>/
```

A completed (`done`) or `skipped` task is moved there to keep its parent's active list short. At a non-canonical location `<parent>/archive/` may already exist with the user's own unrelated content; that's fine — archiving adds `<slug>/` beside it, and the only collision that matters is `<parent>/archive/<slug>/` itself.

The `archive-task` skill performs this move — it confirms the plan is `done` or `skipped`, then relocates the whole folder — or you can `mv` it by hand; the result is identical.

Moving a whole task folder preserves its internal `./` links, since every cross-reference inside the folder is relative to the folder itself. Nothing else needs rewriting.

## Discovery rules for skills

When resolving which task to act on, the **base resolution** is shared; skills differ only in what they do when the user named nothing.

**Base resolution (every skill):**

- **Bare slug given** → resolve in the canonical root only: `.agents/tasks/<slug>/` among the active folders (excluding `archive/`); if none matches, look inside `.agents/tasks/archive/<slug>/` before giving up — a finished task may have been archived there. A bare slug never searches beyond the canonical root; a task living elsewhere must be named by path. (Anything containing a path separator is a path; a bare kebab-case token is a slug.)
- **Explicit task folder path given** → use it verbatim, anywhere on disk; the folder's own name is the slug. Confirm it's a task folder by contents — a top-level `CONTEXT.md` or `plan.md` (a young task may have only `CONTEXT.md`). A path to a folder with neither is not a task folder; say so rather than guessing. There is no archive fallback for a path — verbatim is verbatim.
- **A full plan path given** (`.../plan.md`) → use it directly and derive the task folder from its parent — the parent folder is the task folder, wherever it sits.

Once the folder is resolved, the four files are found by their fixed role names — no stem-globbing, no path a user typed. Don't guess between ambiguous candidates — ask.

**Destination paths (creating skills).** `refine-idea` and `plan-task` accept an optional destination path naming where the task folder should live. Interpret it by what's on disk:

- **Exists, and is a task folder** (top-level `CONTEXT.md` or `plan.md`) → that *is* the task folder; use it verbatim. Its name is the slug — don't derive one.
- **Exists, and is a directory** without those files → it's the **parent**: create `<path>/<slug>/` inside it. Exception: if its basename already equals the derived slug, ask — silently creating `<slug>/<slug>/` is almost never intended.
- **Doesn't exist** → if its basename equals the derived slug, the user named the folder itself: create it verbatim. Otherwise ask whether to create `<path>/<slug>/` inside it (the usual intent) or use `<path>` as the folder itself.
- **Exists, but is a file** → refuse; a destination must be a directory.

No destination path → the canonical root, `.agents/tasks/<slug>/`. Resolve the destination to an absolute path before using it. Avoid creating a live task directly under a directory named `archive/` — location-relative archiving reads that as already archived; warn and confirm first.

**Fallback when the user named nothing** — this is the only branch that varies, by what the skill does:

- **resolve-or-create** (`refine-idea`, `plan-task`) → derive a slug from the task description and create the task folder when no active or archived folder matches — in the canonical root (`.agents/tasks/<slug>/`) by default, or per a user-supplied destination path (see *Destination paths* above). If a slug matches only an archived task, ask whether to revive it or start fresh.
- **resolve-current-or-ask** (`implement-task`, `resume-task`) → first check whether a task is already established **in this session** — a folder / `CONTEXT.md` resolved earlier this session (e.g. from a preceding `refine-idea`, `plan-task`, or `review-task`, or one the user named). If so, use it. Otherwise list the canonical root's active folders (excluding `archive/`) and ask which.
- **resolve-or-ask** (`review-task`, `archive-task`) → list the canonical root's active folders (excluding `archive/`) and ask which.

Archived tasks are intentionally absent from the default active listing — that is the point of archiving, not a discovery bug. Likewise, tasks outside the canonical root are absent from *every* listing — unlistable by design; reach them by path.

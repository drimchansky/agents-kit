# Task Layout: Directories and Project Context

How task artifacts are arranged on disk, and how skills discover them. **This file is the single source of truth for layout.** Status values and transitions live in the sibling `task-lifecycle.md`; this file covers where files sit and how they're found. Cited by `plan-task`, `implement-task`, `resume-task`, and `review-task`.

## Standalone task (the default)

A single effort lives in one directory under `.agents/tasks/`:

```
.agents/tasks/<slug>/
├── CONTEXT.md              # shared static context for every plan here
├── <task-slug>.spec.md     # acceptance criteria
├── <task-slug>.plan.md     # the contract
└── <task-slug>.result.md   # append-only execution record
```

This is the common case. Nothing below is required — a lone task directly under `.agents/tasks/` needs none of it.

## Project grouping (optional)

Related tasks that share a charter, a decision log, or cross-cutting references can be grouped under a project directory that holds a `PROJECT.md` plus one task subdirectory per effort:

```
.agents/tasks/<project>/
├── PROJECT.md              # shared context ACROSS the project's tasks
├── <task-a>/               # a task directory (CONTEXT.md + spec/plan/result)
├── <task-b>/
└── archive/                # optional — see below
```

- **`PROJECT.md`** is project-scoped context that sits *above* each task's `CONTEXT.md`: the problem framing for the whole effort, a decision log, a plan/status registry, cross-task references. It is **not** one of the four per-task lifecycle artifacts — it is one-per-project and carries no working lifecycle (a one-shot origin marker like `CONTEXT.md`'s is fine).
- A task's `CONTEXT.md` points at it with a **`**Project:**`** header — the same link-header pattern as `**Context:**` / `**Spec:**` / `**Result:**`:

  ```markdown
  # <task name>

  **Status:** drafted-by-plan-task
  **Domain:** engineering
  **Project:** [../PROJECT.md](../PROJECT.md)
  ```

  (The `**Domain:**` line shown selects which domain pack the task's skills load — default `engineering`; see `domain-packs.md`.)

  When a skill loads `CONTEXT.md` and finds a `**Project:**` header, it reads the linked file too, as higher-level context — `PROJECT.md` is authoritative for anything spanning more than one task. The grouping is detected by the presence of that header, **not** by directory shape: skills never need to reason about how deep a task sits or walk the filesystem to find the project doc.

## Archiving finished tasks (optional)

Completed (`done`) or `skipped` task directories can be moved into an `archive/` subdirectory of the project (or of `.agents/tasks/` itself) to keep the active list short:

```
.agents/tasks/<project>/archive/<task-slug>/
```

Moving a whole task folder preserves its internal `./` links. A `**Project:**` (or other cross-task) link just gains a `../` level — write it relative so it keeps resolving from one directory deeper (`../../PROJECT.md`).

## Discovery rules for skills

When resolving which task to act on:

- **Explicit path or slug given** → use it. A slug may resolve to `.agents/tasks/<slug>/` (standalone) or to a task subdirectory inside a project; accept a path that points one level deeper.
- **No slug given** → list candidate task directories, but **exclude `archive/`** — it is a container, not a task. If a directory is a project group (it holds a `PROJECT.md` and task subdirectories rather than `*.plan.md` files directly), list its task subdirectories.
- **A requested slug isn't among the active directories** → look inside `archive/` before giving up; a finished task may have been archived there.

Archived tasks are intentionally absent from the default active listing — that is the point of archiving, not a discovery bug.

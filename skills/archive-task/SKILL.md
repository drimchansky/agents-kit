---
name: archive-task
description: Use when asked to archive a finished task — move a completed (`done`) or abandoned (`skipped`) task folder into its parent's `Archive/` (canonically `.agents/tasks/Archive/`) to keep the active list short.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill operates on the **task-folder envelope** — it relocates a whole task folder on disk — not on a task's domain content. Like `maintain`, it deliberately does **not** resolve a `**Domain:**` pack: archiving is identical for every task regardless of its domain, so there is no domain-specific overlay to load. Its source of truth is `./references/workflow/task-archiving.md` (the archive location, its guards, and the backlog exception), `./references/workflow/task-relocation.md` (the move procedure both parking skills share), `./references/workflow/task-layout.md` (the discovery rules), and `./references/workflow/status-transitions.md` (the **terminal-state set** that says which tasks are finished), read **at run time** — never a hardcoded status list.

Archiving moves a finished task folder into its own parent's `Archive/` — canonically from `.agents/tasks/` into `.agents/tasks/Archive/`, though a task folder anywhere on disk archives the same way — so the active list shows only live work. It is the **write** side of the archive boundary whose read side already exists: discovery rules exclude `Archive/` from active scans and fall back into it for an explicit slug (`task-layout.md`).

**The move itself is `scripts/task-move.ts`**, which implements that contract in code: it reads the terminal set, derives the destination from the resolved folder's own location, guards it, and relocates the whole folder in one operation. This skill decides *which* task — asking when that is a real question — then runs the script and reports what it did. It never edits task content, never changes a `**Status:**`, and never touches git.

**CRITICAL**:

- **Terminal tasks only.** A task archives only when its `plan.md` `**Status:**` is one of the **terminal states** `status-transitions.md` defines. The script enforces this and refuses everything else — a live task, an unknown status, a folder with no `plan.md`. Never change a status to make a task archivable, and never work around the refusal.
- **Operate only on the resolved folder.** Hand the script the *exact absolute path resolved in Step 1* — never a bare slug, never a path rebuilt from the slug plus the current directory. A slug can name a folder in another project or anywhere else on disk, and a cwd-relative `.agents/tasks/<slug>` would then validate one task and move another. The script derives the archive from the path it is given.
- **Read-only on status and content.** The move relocates the folder; it does not edit `**Status:**`, goals, plan steps, or the result record. If a task should be abandoned, the user does that through the normal lifecycle (`task-lifecycle.md`) first, then re-runs.
- **Never touch git.** No add, commit, checkout, stash, or `git mv`. The move is working-tree only; the user reviews with `git status` / `git diff` and commits.
- **A refusal is the answer.** When the script exits non-zero, report its line as the outcome and stop. Nothing moved, and nothing about the folder changed.

## When to Use

**Use when:**

- A task has reached a terminal state (finished or abandoned, per `status-transitions.md`) and you want it out of its parent's active listing (canonically `.agents/tasks/`).
- The active task list has grown cluttered with completed work.

**Skip when:**

- The task is still live (any non-terminal state) — finish or abandon it first; this skill won't archive in-flight work.
- You want to *un-archive* a task — the way back out is the user's own move; this skill is one-way (see `task-archiving.md`).
- There's no `.agents/tasks/` folder yet and no task was named by path — nothing to archive.

## Process

### 1. Resolve the target task folder

`./references/workflow/task-relocation.md` § *1. Resolve the target task folder* owns this step — the base resolution read at run time, the `SRC` naming and absolute-path rule, and the refusal of a tasks-parent. Here a folder qualifies as a task by holding a top-level `plan.md`. Two additions are this skill's own:

- **Already archived** → when the slug matches only a folder inside an `Archive/`, report that it's already archived and stop. Nothing to do, and re-archiving would nest it.
- **The nothing-named listing carries status** → show each active folder's `plan.md` `**Status:**` beside it, so the choice is made against what is actually terminal. Don't guess.

### 2. Run the move

```bash
node <kit-root>/scripts/task-move.ts <SRC> --to archive
```

`--to archive` is the direction; everything else in this step is `./references/workflow/task-relocation.md` § *2. Run the move* — the kit-root resolution and its missing-root outcome (with `task-archiving.md` as the by-hand reference), the `<kit-root>/SCRIPTS.md` section that owns the script's CLI and stdout contract, and reading the outcome from the exit status. For this direction the script's gate is the **terminal check** — the plan's status against the terminal set `status-transitions.md` defines, refusing a live, unknown, or plan-less folder — and its destination takes the **backlog exception** `task-archiving.md` defines: a finished task parked in a `Backlog/` archives *out* of it, into the backlog's own parent, never into a nested `Backlog/Archive/`.

### 3. Report

`./references/workflow/task-relocation.md` § *3. Report* owns the shape. Two things are this direction's: when the destination shows the task left a `Backlog/`, say so; and the way back is to move the folder out of `Archive/` — naming its slug only lets discovery find it there.

## Output Template

On success:

```markdown
# archive-task — <slug>

Archived `<slug>` → `<dest>` (plan was `done`; canonically `.agents/tasks/Archive/<slug>/`).
Internal `./` links preserved; folder excluded from active listings.
Working-tree only — review with `git status` and commit (if the folder is inside a git repo).
```

On refusal:

```markdown
# archive-task — <slug>

Not archived: <the script's line, verbatim>
Carry it to `done`, or mark the plan `skipped`, then re-run.
```

## Don't Rationalize

The four entries in `./references/workflow/task-relocation.md` § *Don't Rationalize* are this skill's, reading *archived* for *moved*: the tasks-parent one, the slug-shortcut one, the refusal-override one, and the merge-the-collision one.

## Verification

Confirm the protocol invariants before finishing:

- [ ] `SRC` resolved per `task-layout.md` at run time and validated by contents (a task folder, not a tasks-parent); an already-archived folder reported, not re-archived
- [ ] The script run once on that exact absolute path, with `--to archive` — no bare slug, no path rebuilt from slug + cwd
- [ ] Exit 0 reported with the destination the script printed; a non-zero exit surfaced verbatim, with nothing moved by hand afterwards
- [ ] No status or content edited, no git state mutated

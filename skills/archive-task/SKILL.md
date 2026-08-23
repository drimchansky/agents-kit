---
name: archive-task
description: Use when asked to archive a finished task — move a completed (`done`) or abandoned (`skipped`) task folder into its parent's `Archive/` (canonically `.agents/tasks/Archive/`) to keep the active list short.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill operates on the **task-folder envelope** — it relocates a whole task folder on disk — not on a task's domain content. Like `maintain`, it deliberately does **not** resolve a `**Domain:**` pack: archiving is identical for every task regardless of its domain, so there is no domain-specific overlay to load. Its source of truth is `./references/workflow/task-archiving.md` (the archive location, its guards, and the backlog exception), `./references/workflow/task-layout.md` (the discovery rules), and `./references/workflow/status-transitions.md` (the **terminal-state set** that says which tasks are finished), read **at run time** — never a hardcoded status list.

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

Resolve per the **resolve-or-ask** base resolution in `./references/workflow/task-layout.md` § *Discovery rules for skills*, read at run time — that section owns every branch (a bare slug across the canonical root and every registered one, each with its `Archive/` fallback; an explicit folder path; a `plan.md` path; and the nothing-named listing). Don't work from a copy: this skill carried one, and it went stale the moment the registry widened where a slug resolves.

Two additions are this skill's own:

- **Already archived** → when the slug matches only a folder inside an `Archive/`, report that it's already archived and stop. Nothing to do, and re-archiving would nest it.
- **The nothing-named listing carries status** → show each active folder's `plan.md` `**Status:**` beside it, so the choice is made against what is actually terminal. Don't guess.

Call the folder you resolve here `SRC` — canonically inside a `.agents/tasks/` directory, but any location on disk works the same, and it may lie outside the current working directory entirely. Resolve it to an **absolute path**; that path is the whole of what Step 2 acts on.

**Validate what `SRC` is before going further.** However it was produced — slug, folder path, or `plan.md` path — it must be a real, live task folder by **contents**, not by address shape: a directory holding a top-level `plan.md`. A folder that itself *contains* an `Archive/` or a `Backlog/` subdirectory (both matched case-insensitively, per `task-archiving.md` and `task-backlog.md`) is a task **parent**, not a task folder — **refuse**; moving it would drag its whole archive and backlog along.

### 2. Run the move

```bash
node <kit-root>/scripts/task-move.ts <SRC> --to archive
```

`<kit-root>` resolves per `./references/workflow/task-store.md` § *Resolving `<kit-root>`* <!-- cold -->, which owns that rule. With no kit root available, say the move can't be performed here and stop — a guarded move has no by-hand equivalent worth offering; `task-archiving.md` states what the move is for anyone doing it themselves.

The script's file header owns its CLI and its stdout contract. What it decides, so this skill doesn't:

- **The terminal check** — it reads the plan's status against the same terminal set, and refuses a live, unknown, or plan-less folder.
- **The destination** — location-relative, derived from `SRC`'s own parent, including the **backlog exception** (a finished task parked in a `Backlog/` archives *out* of it, into the backlog's own parent, never into a nested `Backlog/Archive/`) and the **case-insensitive recognition** of an existing container (an `archive/` is moved into as it is spelled; normalizing a stray spelling is `maintain`'s format sweep, not this move).
- **The guards** — a symlinked source, a symlinked or non-directory container, and an occupied `Archive/<slug>` are each refused rather than overwritten or followed.

Read the outcome from the exit status:

- **0** → moved. Stdout is one line, `moved <src> -> <dest>`; the destination it names is what Step 3 reports.
- **1** → refused. Stderr is one line giving the reason. Surface it **verbatim** and stop; nothing moved.
- **2** → the run couldn't be carried out — a usage error, a bare slug that matched nothing or several things, or an unexpected failure. Where the line names one of the first two, fix the invocation (pass `SRC` as the absolute path Step 1 resolved) and re-run; where it reports a failure instead, report that and stop rather than re-running against it.

### 3. Report

Confirm what moved (`<slug>` → the `<dest>` the script printed), note that the folder's internal `./` links are intact, and remind the user that the task is now excluded from active listings; when the destination shows the task left a `Backlog/`, say so. To un-archive it, move it back out of `Archive/` — naming its slug only lets discovery find it there. When the folder is inside a git repo, the change is working-tree-only — review with `git status` and commit; a task outside any repo has nothing to commit.

The move is the whole of this section's write surface: nothing is regenerated, refreshed, or recorded afterwards.

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

- "This `plan.md` path has a `done` plan, good enough to move" — Check *what* it is first: a task folder by contents, holding no `Archive/` or `Backlog/` of its own. A tasks-parent would drag its whole archive and backlog along; refuse it rather than handing it to the script.
- "I'll pass the slug and let the script find it" — Its slug resolution is a minimum, deliberately: ambiguity is *this* skill's question to ask, with the listing and the statuses in front of the user. Resolve first, then pass the absolute path.
- "The script refused, but the task really is finished — I'll move it myself" — No. The refusal is the contract answering, and a hand-finished move would archive a folder whose state nothing verified. Report the line and let the user act on it.
- "It refused because the destination is occupied, so I'll merge the two folders" — Never. Two folders holding one slug is a collision for the user to resolve; merging silently destroys one of them.

## Verification

Confirm the protocol invariants before finishing:

- [ ] `SRC` resolved per `task-layout.md` at run time and validated by contents (a task folder, not a tasks-parent); an already-archived folder reported, not re-archived
- [ ] The script run once on that exact absolute path, with `--to archive` — no bare slug, no path rebuilt from slug + cwd
- [ ] Exit 0 reported with the destination the script printed; a non-zero exit surfaced verbatim, with nothing moved by hand afterwards
- [ ] No status or content edited, no git state mutated

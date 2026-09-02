---
name: backlog-task
description: Use when asked to backlog or park an unstarted task — move a task with no plan yet (or a plan still at `to-do`) into its parent's `Backlog/` (canonically `.agents/tasks/Backlog/`) to keep the active list to work in flight.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill operates on the **task-folder envelope** — it relocates a whole task folder on disk — not on a task's domain content. Like `archive-task`, it deliberately does **not** resolve a `**Domain:**` pack: backlogging is identical for every task regardless of its domain, so there is no domain-specific overlay to load. Its source of truth is `./references/workflow/task-backlog.md` (the backlog location), `./references/workflow/task-relocation.md` (the move procedure both parking skills share), `<kit-root>/SCRIPTS.md` § *`scripts/task-move.ts`* (the unstarted entry gate, the script's own contract), `./references/workflow/task-layout.md` (the discovery rules and the recognition set that says what a task folder is), and `./references/workflow/task-lifecycle.md` (the status vocabulary that gate reads against), read **at run time** — never a hardcoded status list.

Parking moves an unstarted task folder into its own parent's `Backlog/` — canonically from `.agents/tasks/` into `.agents/tasks/Backlog/`, though a task folder anywhere on disk parks the same way — so the active list shows only work in flight. It is the **inbound** side of the backlog boundary whose read side already exists: discovery rules exclude `Backlog/` from active scans and fall back into it for an explicit slug (`task-layout.md`). Parking is carried by **location alone** — there is no `**Status:**` value for it — and its one exit is activation, the user's own move back out.

**The move itself is `scripts/task-move.ts`**, which implements that contract in code: it applies the entry gate, derives the destination from the resolved folder's own location, guards it, and relocates the whole folder in one operation. This skill decides *which* task — asking when that is a real question — then runs the script and reports what it did. It never edits task content, never changes a `**Status:**`, and never touches git.

**CRITICAL**:

- **Unstarted tasks only.** A task parks only when it passes the **entry gate**, which the script applies and `<kit-root>/SCRIPTS.md` § *`scripts/task-move.ts`* states. It is archiving's gate inverted, so don't carry `archive-task`'s reflexes into it — hand the folder over and let the gate answer. Never edit a `**Status:**` to make a task eligible, and never work around the refusal.
- **Eligible still means a *task folder*.** The gate says nothing about whether the thing being moved is a task; Step 1 does, via the **recognition set** in `task-layout.md` § *One task, one flat folder*. A stray directory holding no role file is never parked.
- **Operate only on the resolved folder.** Hand the script the *exact absolute path resolved in Step 1* — never a bare slug, never a path rebuilt from the slug plus the current directory. A slug can name a folder in another project or anywhere else on disk, and a cwd-relative `.agents/tasks/<slug>` would then validate one task and move another. The script derives the backlog from the path it is given.
- **Read-only on status and content.** The move relocates the folder; it does not edit `**Status:**`, goals, plan steps, or a result record. Parking is location, not a status: a live task that needs to pause does so through the `blocked` status (`task-lifecycle.md`), never by being moved.
- **Never touch git.** No add, commit, checkout, stash, or `git mv`. The move is working-tree only; the user reviews with `git status` / `git diff` and commits.
- **A refusal is the answer.** When the script exits non-zero, report its line as the outcome and stop. Nothing moved, and nothing about the folder changed.

## When to Use

**Use when:**

- A task is deliberately not started yet — no plan written, or a plan still at the not-yet-started state — and you want it out of its parent's active listing (canonically `.agents/tasks/`).
- The active task list has grown cluttered with work that isn't in flight.

**Skip when:**

- The task has already started (any live state) — a live task pauses through the `blocked` status (`task-lifecycle.md`), never by being moved; park it only if it is later abandoned or restarted from scratch.
- The task is finished or abandoned — that's `archive-task`, not this skill.
- You want to *un-park* a task — that's the user's own move back out, or the activation `implement-task` / `resume-task` offer; this skill is inbound only (see `task-backlog.md`).
- There's no `.agents/tasks/` folder yet and no task was named by path — nothing to park.

## Process

### 1. Resolve the target task folder

`./references/workflow/task-relocation.md` § *1. Resolve the target task folder* owns this step — the base resolution in `./references/workflow/task-layout.md` § *Discovery rules for skills* read at run time, the `SRC` naming and absolute-path rule, and the refusal of a tasks-parent. Four things are this direction's own:

- **Already parked** → when the resolved folder's immediate parent is named `Backlog` (matched **case-insensitively**, per `task-backlog.md`), report that it's already parked and stop. A no-op — re-parking would nest it.
- **Already archived** → when the resolved folder's immediate parent is named `Archive` (matched **case-insensitively**, per `task-archiving.md`), **refuse**. An archived task is finished, not parked; if it should be revived, the user un-archives it first, then re-runs. Never move a folder straight from `Archive/` into a backlog. (The opposite direction is different: a terminal task found parked archives *out* of the backlog, the sanctioned move `task-archiving.md`'s backlog exception defines.)
- **The nothing-named listing carries state** → show each active folder's `plan.md` `**Status:**` beside it, or *no plan yet* when the folder has none, so the choice is made against what is actually unstarted. Don't guess.
- **What qualifies as a task folder is wider** → validate `SRC` against the **recognition set** in `task-layout.md` § *One task, one flat folder*, which owns the file list including the legacy suffix forms, rather than against a top-level `plan.md`. A young folder holding only a `ticket.md`, a `CONTEXT.md`, or a hand-authored `goals.md` qualifies, which is the whole point here; a directory holding none of them is not a task and is refused.

### 2. Run the move

```bash
node <kit-root>/scripts/task-move.ts <SRC> --to backlog
```

`--to backlog` is the direction; everything else in this step is `./references/workflow/task-relocation.md` § *2. Run the move* — the kit-root resolution and its missing-root outcome (with `task-backlog.md` as the by-hand reference), the `<kit-root>/SCRIPTS.md` section that owns the script's CLI and stdout contract, and reading the outcome from the exit status. For this direction the script's gate is the **entry gate** — which folder states park, which are refused, and where each refusal points instead: archiving's gate inverted — and its container is `Backlog/`, without the backlog exception, which is archiving's own.

### 3. Report

`./references/workflow/task-relocation.md` § *3. Report* owns the shape — what to confirm, the intact-`./`-links note, the working-tree-only reminder, and that the move is the whole write surface. Two things read differently here: the folder drops out of active listings for *execution* only, since planning still acts on it in place; and the way back is **activation** — move it out of `Backlog/`, or let `implement-task` / `resume-task` offer activation when the slug is named (`task-backlog.md`), naming the slug alone only letting discovery find it there.

## Output Template

On success:

```markdown
# backlog-task — <slug>

Parked `<slug>` → `<dest>` (no plan yet; canonically `.agents/tasks/Backlog/<slug>/`).
Internal `./` links preserved; folder excluded from active listings.
Activate it by moving it back out of `Backlog/`, or let `implement-task` offer activation.
Working-tree only — review with `git status` and commit (if the folder is inside a git repo).
```

On refusal:

```markdown
# backlog-task — <slug>

Not parked: <the script's line, verbatim>
Pause it with `blocked` if it's waiting on something, or carry it to completion — a finished task goes to `archive-task`.
```

## Don't Rationalize

Every entry in `./references/workflow/task-relocation.md` § *Don't Rationalize* holds here, reading *parked* for *moved*: the tasks-parent one, the slug-shortcut one, the refusal-override one, and the merge-the-collision one. Three more are this skill's own:

- "This folder has no `plan.md`, so I can't judge it" — you don't judge it: the young unplanned task is what the backlog exists for, so hand the folder to the script and let the gate answer. What still has to hold is that the folder qualifies by the **recognition set** (`task-layout.md`) — a directory holding no role file is not a task and doesn't park.
- "It's `executing`, but the user wants it parked" — parking live work is what the `blocked` status is for (`task-lifecycle.md`). The script will refuse it; report the status it names and point there. A move is not a pause, and location carries no lifecycle state.
- "It's sitting in `Archive/` and was never really finished — I'll move it across" — Un-archiving is the user's own move back out (`task-archiving.md`), taken first. Refuse the archived folder; never shuttle one from the archive into the backlog. (Backlog-to-archive is not this move's mirror: that is archiving's own sanctioned exit for a misfiled terminal task.)

## Verification

Confirm the protocol invariants before finishing:

- [ ] `SRC` resolved per `task-layout.md` at run time and validated by the recognition set (a task folder, not a tasks-parent); an already-parked folder reported, an archived one refused
- [ ] The script run once on that exact absolute path, with `--to backlog` — no bare slug, no path rebuilt from slug + cwd
- [ ] Exit 0 reported with the destination the script printed; a non-zero exit surfaced verbatim, with nothing moved by hand afterwards
- [ ] No status or content edited, no git state mutated

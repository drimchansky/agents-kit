---
name: backlog-task
description: Use when asked to backlog or park an unstarted task — move a task with no plan yet (or a plan still at `to-do`) into its parent's `Backlog/` (canonically `.agents/tasks/Backlog/`) to keep the active list to work in flight.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

Park a whole unstarted task folder through `scripts/task-move.ts`. Edit no task content or status and perform no Git mutation, including staging, commit, checkout, stash, or `git mv`. Location alone records parking.

Resolve no domain pack; parking has the same protocol for every domain. Read `./references/workflow/task-backlog.md`, `./references/workflow/task-relocation.md`, `./references/scripts/task-move.md`, `./references/workflow/task-layout.md`, and `./references/workflow/task-lifecycle.md` at run time. The script contract supplies the unstarted gate; keep no copied status list.

## When to Use

**Use when** a task has deliberately not started and should leave the active list.

**Skip when** work is live: pause through blocked; parking does not pause execution. Finished or abandoned work goes to `archive-task`. Un-parking is a manual move or the activation offered by implement-task/resume-task; this skill is inbound only. With no canonical root and no named path, report nothing to park.

## Process

### 1. Resolve the target task folder

Apply `./references/workflow/task-relocation.md` § *1. Resolve the target task folder*, using discovery in `./references/workflow/task-layout.md` § *Discovery rules for skills*. Resolve the exact absolute SRC; refuse task parents.

- **Already parked**: an immediate parent named Backlog, case-insensitively, means report and stop (`./references/workflow/task-backlog.md`).
- **Already archived**: refuse under `./references/workflow/task-archiving.md`'s whole-path-to-store rule. The user must un-archive before retrying. Never transfer Archive directly into Backlog. The opposite terminal-task exit is archive-task's own operation.
- **Nothing named**: list active folders with plan Status or `no plan yet`, then ask.
- **Recognition**: use `./references/workflow/task-layout.md` § *One task, one flat folder*'s full set, including legacy forms. A ticket/context/goals-only task qualifies; a directory without a recognized file does not. No plan is required merely to hand a recognized task to the entry gate.

### 2. Run the move

```bash
node <kit-root>/scripts/task-move.ts <SRC> --to backlog
```

Pass Step 1's exact absolute path, never an unresolved slug or cwd reconstruction. Apply `./references/workflow/task-relocation.md` § *2. Run the move* and `./references/scripts/task-move.md` for the gate, destination guards, kit-root resolution, and output.

The destination is SRC's parent's Backlog; archiving's Backlog exit exception does not apply. Never edit status to make work eligible, bypass refusal manually, or merge colliding folders. Surface non-zero output verbatim and stop. Live-task refusals point to blocked; terminal-task refusals point to archive-task.

### 3. Report

Follow `./references/workflow/task-relocation.md` § *3. Report*: use the printed destination and preserve contents and records. Planning can continue in place. Execution requires activation by a move out of Backlog or the implement-task/resume-task offer (`./references/workflow/task-backlog.md`); slug discovery alone does not activate.

## Output Template

On success:

```markdown
# backlog-task — <slug>

Parked `<slug>` → `<dest>` (<observed plan state or no plan yet>).
Internal `./` links preserved; folder excluded from active listings.
Move it out of Backlog to activate, or accept implement-task's activation offer.
Working-tree only; inspect with `git status` and commit when inside a Git repository.
```

On refusal:

```markdown
# backlog-task — <slug>

Not parked: <script's line verbatim>
<Applicable next action: blocked for a live pause; archive-task for terminal work.>
```

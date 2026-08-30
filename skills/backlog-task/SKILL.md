---
name: backlog-task
description: Use when asked to backlog or park an unstarted task — move a task with no plan yet (or a plan still at `to-do`) into its parent's `Backlog/` (canonically `.agents/tasks/Backlog/`) to keep the active list to work in flight.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill operates on the **task-folder envelope** — it relocates a whole task folder on disk — not on a task's domain content. Like `archive-task`, it deliberately does **not** resolve a `**Domain:**` pack: backlogging is identical for every task regardless of its domain, so there is no domain-specific overlay to load. Its source of truth is `./references/workflow/task-backlog.md` (the backlog location **and** the unstarted entry gate), `./references/workflow/task-layout.md` (the discovery rules and the recognition set that says what a task folder is), and `./references/workflow/task-lifecycle.md` (the status vocabulary that gate reads against), read **at run time** — never a hardcoded status list.

Parking moves an unstarted task folder into its own parent's `Backlog/` — canonically from `.agents/tasks/` into `.agents/tasks/Backlog/`, though a task folder anywhere on disk parks the same way — so the active list shows only work in flight. It is the **inbound** side of the backlog boundary whose read side already exists: discovery rules exclude `Backlog/` from active scans and fall back into it for an explicit slug (`task-layout.md`). Parking is carried by **location alone** — there is no `**Status:**` value for it — and its one exit is activation, the user's own move back out.

**The move itself is `scripts/task-move.ts`**, which implements that contract in code: it applies the entry gate, derives the destination from the resolved folder's own location, guards it, and relocates the whole folder in one operation. This skill decides *which* task — asking when that is a real question — then runs the script and reports what it did. It never edits task content, never changes a `**Status:**`, and never touches git.

**CRITICAL**:

- **Unstarted tasks only.** A task parks only when it passes the **entry gate** `task-backlog.md` defines. It is archiving's gate inverted: a folder with **no `plan.md` at all is eligible**, the normal state of a task before planning, exactly where `archive-task` refuses. The script enforces the gate and refuses everything past it — a live plan, a finished one, an unknown status, a plan-less folder that already holds a `result.md`. Never edit a `**Status:**` to make a task eligible, and never work around the refusal.
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

Resolve per the **resolve-or-ask** base resolution in `./references/workflow/task-layout.md` § *Discovery rules for skills*, read at run time — that section owns every branch (a bare slug across the canonical root and every registered one, each with its container fallback; an explicit folder path; a `plan.md` path; and the nothing-named listing). Don't work from a copy: a copy goes stale the moment the registry widens where a slug resolves.

Three additions are this skill's own:

- **Already parked** → when the resolved folder's immediate parent is named `Backlog` (matched **case-insensitively**, per `task-backlog.md`), report that it's already parked and stop. A no-op — re-parking would nest it.
- **Already archived** → when the resolved folder's immediate parent is named `Archive` (matched **case-insensitively**, per `task-archiving.md`), **refuse**. An archived task is finished, not parked; if it should be revived, the user un-archives it first, then re-runs. Never move a folder straight from `Archive/` into a backlog. (The opposite direction is different: a terminal task found parked archives *out* of the backlog, the sanctioned move `task-archiving.md`'s backlog exception defines.)
- **The nothing-named listing carries state** → show each active folder's `plan.md` `**Status:**` beside it, or *no plan yet* when the folder has none, so the choice is made against what is actually unstarted. Don't guess.

Call the folder you resolve here `SRC` — canonically inside a `.agents/tasks/` directory, but any location on disk works the same, and it may lie outside the current working directory entirely. Resolve it to an **absolute path**; that path is the whole of what Step 2 acts on.

**Validate what `SRC` is before going further.** However it was produced — slug, folder path, or `plan.md` path — it must be a task folder by **contents**, not by address shape: a directory qualifying under the **recognition set** in `task-layout.md` § *One task, one flat folder*, which owns the file list including the legacy suffix forms. A young folder holding only a `ticket.md`, a `CONTEXT.md`, or a hand-authored `goals.md` qualifies, which is the whole point here; a directory holding none of them is not a task and is refused. A folder that itself *contains* an `Archive/` or a `Backlog/` subdirectory (both matched case-insensitively) is a tasks-**parent**, not a task folder — **refuse**; moving it would drag its whole archive and backlog along.

### 2. Run the move

```bash
node <kit-root>/scripts/task-move.ts <SRC> --to backlog
```

`<kit-root>` resolves per `./references/workflow/task-store.md` § *Resolving `<kit-root>`* <!-- cold -->, which owns that rule. With no kit root available, say the move can't be performed here and stop — a guarded move has no by-hand equivalent worth offering; `task-backlog.md` states what the move is for anyone doing it themselves.

`<kit-root>/SCRIPTS.md` § *`scripts/task-move.ts`* owns its CLI and its stdout contract — read that section, not the whole file. What it decides, so this skill doesn't:

- **The entry gate** — a plan-less folder is admitted unless it holds a `result.md` at all (a result file exists only once execution starts, and carries no status of its own to read); a plan is admitted only in the not-yet-started state, and a live, finished, or unplaceable status is refused, the finished one pointing at archiving.
- **The destination** — location-relative, derived from `SRC`'s own parent, with **case-insensitive recognition** of an existing container (a `backlog/` is moved into as it is spelled; normalizing a stray spelling is `maintain`'s format sweep, not this move).
- **The guards** — a symlinked source, a symlinked or non-directory container, and an occupied `Backlog/<slug>` are each refused rather than overwritten or followed.

Read the outcome from the exit status:

- **0** → moved. Stdout is one line, `moved <src> -> <dest>`; the destination it names is what Step 3 reports.
- **1** → refused. Stderr is one line giving the reason. Surface it **verbatim** and stop; nothing moved.
- **2** → the run couldn't be carried out — a usage error, a bare slug that matched nothing or several things, or an unexpected failure. Where the line names one of the first two, fix the invocation (pass `SRC` as the absolute path Step 1 resolved) and re-run; where it reports a failure instead, report that and stop rather than re-running against it.

### 3. Report

Confirm what moved (`<slug>` → the `<dest>` the script printed), note that the folder's internal `./` links are intact, and remind the user that the task is now excluded from active listings — planning still acts on it in place, execution won't start it until it's activated. To activate it, move it back out of `Backlog/`, or let `implement-task` / `resume-task` offer activation when the slug is named (`task-backlog.md`); naming the slug alone only lets discovery find it there. When the folder is inside a git repo, the change is working-tree-only — review with `git status` and commit; a task outside any repo has nothing to commit.

The move is the whole of this section's write surface: nothing is regenerated, refreshed, or recorded afterwards.

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

- "This folder has no `plan.md`, so I can't judge it" — no plan is the *eligible* state here, not an unknown one: it's the young task the backlog exists for, and the one place this gate is the inverse of archiving's. What still has to hold is that the folder qualifies by the **recognition set** (`task-layout.md`) — a directory holding no role file is not a task and doesn't park.
- "It's `executing`, but the user wants it parked" — parking live work is what the `blocked` status is for (`task-lifecycle.md`). The script will refuse it; report the status it names and point there. A move is not a pause, and location carries no lifecycle state.
- "It's sitting in `Archive/` and was never really finished — I'll move it across" — Un-archiving is the user's own move back out (`task-archiving.md`), taken first. Refuse the archived folder; never shuttle one from the archive into the backlog. (Backlog-to-archive is not this move's mirror: that is archiving's own sanctioned exit for a misfiled terminal task.)
- "I'll pass the slug and let the script find it" — Its slug resolution is a minimum, deliberately: ambiguity is *this* skill's question to ask, with the listing and the statuses in front of the user. Resolve first, then pass the absolute path.
- "The script refused, but the task clearly hasn't started — I'll move it myself" — No. The refusal is the gate answering, and a hand-finished move would park a folder whose state nothing verified. Report the line and let the user act on it.

## Verification

Confirm the protocol invariants before finishing:

- [ ] `SRC` resolved per `task-layout.md` at run time and validated by the recognition set (a task folder, not a tasks-parent); an already-parked folder reported, an archived one refused
- [ ] The script run once on that exact absolute path, with `--to backlog` — no bare slug, no path rebuilt from slug + cwd
- [ ] Exit 0 reported with the destination the script printed; a non-zero exit surfaced verbatim, with nothing moved by hand afterwards
- [ ] No status or content edited, no git state mutated

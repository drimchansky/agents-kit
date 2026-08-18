---
name: backlog-task
description: Use when asked to backlog or park an unstarted task — move a task with no plan yet (or a plan still at `to-do`) into its parent's `Backlog/` (canonically `.agents/tasks/Backlog/`) to keep the active list to work in flight.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill operates on the **task-folder envelope** — it relocates a whole task folder on disk — not on a task's domain content. Like `archive-task`, it deliberately does **not** resolve a `**Domain:**` pack: backlogging is identical for every task regardless of its domain, so there is no domain-specific overlay to load. Its source of truth is `./references/workflow/task-backlog.md` (the backlog location **and** the unstarted entry gate), `./references/workflow/task-layout.md` (the discovery rules and the recognition set that says what a task folder is), and `./references/workflow/task-lifecycle.md` (the status vocabulary that gate reads against), read **at run time** — never a hardcoded status list.

This skill moves an unstarted task folder into its own parent's `Backlog/` — canonically from `.agents/tasks/` into `.agents/tasks/Backlog/`, though a task folder anywhere on disk parks the same way — so the active list shows only work in flight. It is the **inbound** side of the backlog boundary whose read side already exists: discovery rules already exclude `Backlog/` from active scans and fall back into it for an explicit slug (`task-layout.md`); the location-relative move itself is the contract in `./references/workflow/task-backlog.md`, read at run time. Parking is carried by **location alone** — there is no `**Status:**` value for it — and its one exit is activation, a plain `mv` back out. The move never edits task content, never changes a `**Status:**`, and never touches git.

**CRITICAL**:

- **Unstarted tasks only.** Park a task only when it passes the **entry gate** that `task-backlog.md` defines — read the gate there at run time; don't bake the status names in here. It is archiving's gate inverted: a folder with **no `plan.md` at all is eligible**, the normal state of a task before planning, exactly where `archive-task` refuses. Eligible still means a *task folder* — it has to qualify by the **recognition set** in `task-layout.md` § *One task, one flat folder*, so a stray directory holding no role file is never parked. A task past the gate is refused and reported; never park it anyway, and never edit a `**Status:**` to make it eligible.
- **Operate only on the resolved folder.** Everything after Step 1 — the gate check, the destination guard, and the move — acts on the *exact path resolved in Step 1*, never on a path rebuilt from the slug plus the current directory. A path can resolve to a folder in another project or anywhere else on disk; a cwd-relative `.agents/tasks/<slug>` would then validate one task but move a same-slug task somewhere else. Derive the backlog destination from the resolved folder's own parent directory, not from cwd.
- **Read-only on status and content.** This skill moves the folder; it does not edit `**Status:**`, goals, plan steps, or a result record. Parking is location, not a status. If a live task needs to pause, the user does that through the normal lifecycle (`task-lifecycle.md`) — the `blocked` status, not a move.
- **Never clobber.** If the destination `Backlog/<slug>/` under the resolved task's own parent already exists, refuse — don't overwrite or merge into it.
- **Never touch git.** No add, commit, checkout, stash, or `git mv`. The move is a plain working-tree `mv`; the user reviews with `git status` / `git diff` and commits.
- **Whole folder, one move.** Move the entire folder in a single operation so its `./`-relative cross-links survive. Never copy or relocate files individually.

## When to Use

**Use when:**

- A task is deliberately not started yet — no plan written, or a plan still at the not-yet-started state — and you want it out of its parent's active listing (canonically `.agents/tasks/`).
- The active task list has grown cluttered with work that isn't in flight.

**Skip when:**

- The task has already started (any live state) — a live task pauses through the `blocked` status (`task-lifecycle.md`), never by being moved; park it only if it is later abandoned or restarted from scratch.
- The task is finished or abandoned — that's `archive-task`, not this skill.
- You want to *un-park* a task — that's a manual `mv` back out of `Backlog/`, or the activation `implement-task` / `resume-task` offer; this skill is inbound only (see `task-backlog.md`).
- There's no `.agents/tasks/` folder yet and no task was named by path — nothing to park.

## Process

### 1. Resolve the target task folder

Resolve per the **resolve-or-ask** base resolution in `./references/workflow/task-layout.md` § *Discovery rules for skills*, read at run time — that section owns every branch (a bare slug across the canonical root and every registered one, each with its container fallback; an explicit folder path; a `plan.md` path; and the nothing-named listing). Don't work from a copy: a copy goes stale the moment the registry widens where a slug resolves.

Three additions are this skill's own:

- **Already parked** → when the resolved folder's immediate parent is named `Backlog` (matched **case-insensitively**, per `task-backlog.md`), report that it's already parked and stop. A no-op — re-parking would nest it as `Backlog/Backlog/<slug>`.
- **Already archived** → when the resolved folder's immediate parent is named `Archive` (matched **case-insensitively**, per `task-archiving.md`), **refuse**. An archived task is finished, not parked; if it should be revived, un-archive it first — a manual `mv` back out of `Archive/` — and re-run. Never move a folder straight from `Archive/` into a backlog. (The opposite direction is different: a terminal task found parked archives *out* of the backlog, the sanctioned move the backlog exception in `task-archiving.md` defines.)
- **The nothing-named listing carries state** → show each active folder's `plan.md` `**Status:**` beside it, or *no plan yet* when the folder has none, so the choice is made against what is actually unstarted. Don't guess.

Call the folder you resolve here `SRC`, and the directory that *contains* it `PARENT` — canonically a `.agents/tasks/` directory, but any parent on disk works the same, and it may live outside the current working directory entirely. Every step below operates on `SRC` and `PARENT`; never rebuild a path from the slug and the current directory.

**Validate the resolved folder (every branch, before going further).** However `SRC` was produced — slug, folder path, or `plan.md` path — confirm it is a real task folder by **contents and position**, not by address shape:

- `SRC` must be a task folder by contents: a real directory (not a symlink) qualifying under the **recognition set** in `task-layout.md` § *One task, one flat folder* — that section owns the file list, including the legacy suffix forms. A young folder holding only a `ticket.md`, a `CONTEXT.md`, or a hand-authored `goals.md` qualifies, which is the whole point here; a directory holding none of them is not a task and is refused. A folder that itself *contains* an `Archive/` or a `Backlog/` subdirectory (both matched case-insensitively) is a tasks-**parent**, not a task folder — **refuse**; moving it would drag its whole archive and backlog along.
- Check `SRC`'s **immediate parent directory name** against both containers, case-insensitively — `Backlog` → the no-op above, `Archive` → the refusal above. This is the case a bare `plan.md` path can otherwise slip past: never let `PARENT` resolve to a container directory and park into `Backlog/Backlog/<slug>`. A directory named `Backlog` or `Archive` *higher* up the path (the user's own tree naming) does not count — only the immediate parent.

### 2. Confirm the task is unstarted

Apply the **entry gate** in `./references/workflow/task-backlog.md`, resolving each status name it uses in `task-lifecycle.md` § *Status values* — don't compare against a list of names baked into this skill. Read the resolved folder's `plan.md` `**Status:**` when a `plan.md` exists, then:

- **No `plan.md` at all**, with the folder already qualifying by the recognition set (Step 1) and no `result.md` carrying a status of its own → eligible; proceed to step 3. This is the branch `archive-task` refuses and this skill admits: a task the gate calls unstarted because planning hasn't happened yet. A status-bearing `result.md` means work already began where the folder lies — a result file exists only once execution starts — so it refuses like the live-plan branch below, or points at `archive-task` when its status is terminal.
- **A plan in the state the gate admits as not yet started** → proceed to step 3.
- **A plan in a live state** → **Refuse**: report the current status and say that a live task pauses through the `blocked` status, or is simply carried to completion — it does not park (`task-backlog.md`). Change nothing on disk.
- **A plan in a terminal state** → **Refuse**: a finished or abandoned task belongs in `Archive/`, not the backlog; point the user at `archive-task`. Change nothing on disk.
- **A `**Status:**` not in that vocabulary** → can't judge the task against the gate. Refuse and report; don't park a folder of unknown state.

### 3. Guard the destination

Let `slug` be `SRC`'s own folder name and `DEST = PARENT/Backlog/<slug>` — both anchored on the parent resolved in Step 1, **never** on the current directory. Then:

- If `DEST` already exists → **refuse**: something already holds that slug in this backlog; report it rather than overwriting or merging.
- If `PARENT/Backlog` exists but is a **symlink** or **not a directory** → **refuse**: a symlinked `Backlog/` sends the move through the link to an unexpected location, and a file named `Backlog` can't hold the task. Require a real directory — or nothing — at `PARENT/Backlog`. (Only `PARENT/Backlog` itself matters; a symlinked *ancestor* — macOS's `/tmp` → `/private/tmp`, say — affects `SRC` and `DEST` identically and is fine.)
- If `PARENT/Backlog` already exists as a real directory holding other parked tasks, or unrelated content at a non-canonical location → **use it**: parking adds `<slug>/` beside whatever is there; the only collision that matters is `DEST` itself.

If the checks pass, create `PARENT/Backlog/` as a real directory if it doesn't exist yet (`mkdir -p -- "$PARENT/Backlog"`). New containers are always created as `Backlog/`, whatever case an existing one was recognized in.

### 4. Move the folder

Move the resolved `SRC` — not a path rebuilt from the slug and cwd — into `DEST` in one operation:

```bash
# SRC, PARENT, and DEST were all fixed in Steps 1 and 3.
mv -- "$SRC" "$DEST"
```

A plain filesystem move — no git. The source is the exact folder resolved and validated above, and the destination sits in that folder's own `PARENT/Backlog/`, so a `plan.md` path from another project can never validate one task and move another. Because every cross-reference inside the folder is `./`-relative, the move rewrites nothing inside it, and no `**Status:**` changes — location alone carries "parked".

### 5. Report

Confirm what moved (`<slug>` → the actual `DEST`), note that the folder's internal links are intact, and remind the user that the task is now excluded from active listings — planning still acts on it in place, execution won't start it until it's activated. To activate it, move it back out of `Backlog/` — by hand, or by letting `implement-task` / `resume-task` offer activation when the slug is named (`task-backlog.md`); naming the slug alone only lets discovery find it there. When the folder is inside a git repo, the change is working-tree-only — review with `git status` and commit; a task outside any repo has nothing to commit.

The move is the whole of this section's write surface: nothing is regenerated, refreshed, or recorded outside `PARENT` afterwards.

## Output Template

On success:

```markdown
# backlog-task — <slug>

Parked `<slug>` → `<DEST>` (no plan yet; canonically `.agents/tasks/Backlog/<slug>/`).
Internal `./` links preserved; folder excluded from active listings.
Activate it by moving it back out of `Backlog/`, or let `implement-task` offer activation.
Working-tree only — review with `git status` and commit (if the folder is inside a git repo).
```

On refusal:

```markdown
# backlog-task — <slug>

Not parked: plan `**Status:**` is `executing` (only unstarted tasks park).
Pause it with `blocked` if it's waiting on something, or carry it to completion — a finished task goes to `archive-task`.
```

## Don't Rationalize

- "This folder has no `plan.md`, so I can't judge it" — no plan is the *eligible* state here, not an unknown one: it's the young task the backlog exists for, and the one place this gate is the inverse of archiving's. What still has to hold is that the folder qualifies by the **recognition set** (`task-layout.md`) — a directory holding no role file is not a task and doesn't park — and that no `result.md` carries a status, which would mean the work already began.
- "It's `executing`, but the user wants it parked" — parking live work is what the `blocked` status is for (`task-lifecycle.md`). Refuse, name the current status, and point there; a move is not a pause, and location carries no lifecycle state.
- "It's sitting in `Archive/` and was never really finished — I'll move it across" — Un-archiving is a manual `mv` back out (`task-archiving.md`), taken by the user first. Refuse the archived folder; never shuttle one from the archive into the backlog. (Backlog-to-archive is not this move's mirror: that is archiving's own sanctioned exit for a misfiled terminal task.)
- "I'll just `mv .agents/tasks/<slug> …` from here" — That rebuilds the path from the current directory plus the slug, which can differ from the folder you resolved and validated. Move the exact resolved `SRC` into its own `PARENT/Backlog/`; never assume the current directory is the resolved folder's project.
- "`Backlog/` is probably a normal directory" — Check. If `PARENT/Backlog` is a symlink, `mv` follows it and relocates the task somewhere else entirely. Refuse a symlinked (or file) `PARENT/Backlog`.
- "`<parent>/Backlog/` already holds other folders — I'll refuse or pick another spot" — No: an existing `Backlog/` directory is fine at any location; parking adds `<slug>/` beside whatever is there. The only refusals are a `DEST` collision or a symlink/non-directory at `PARENT/Backlog`.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Unstarted vs. started decided by reading `task-backlog.md`'s entry gate at run time, its status names resolved in `task-lifecycle.md`; backlog location from `task-backlog.md`, discovery and the recognition set from `task-layout.md` — nothing baked in
- [ ] `SRC` validated by contents and position (real non-symlink directory qualifying by the recognition set; not a tasks-parent); already-parked folders no-op'd, never nested into `Backlog/Backlog/`; archived folders refused rather than moved across
- [ ] Live, terminal, and unknown-status tasks refused with the current status and the path to proceed; status and content never edited
- [ ] Destination guarded — `DEST` collision refused, symlink or non-directory at `PARENT/Backlog` refused
- [ ] The exact resolved `SRC` moved into its own `PARENT/Backlog/` in one operation (never a path rebuilt from slug + cwd); internal `./` links intact
- [ ] No git state mutated; nothing outside `PARENT` touched

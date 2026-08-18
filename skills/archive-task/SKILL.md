---
name: archive-task
description: Use when asked to archive a finished task — move a completed (`done`) or abandoned (`skipped`) task folder into its parent's `Archive/` (canonically `.agents/tasks/Archive/`) to keep the active list short.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill operates on the **task-folder envelope** — it relocates a whole task folder on disk — not on a task's domain content. Like `maintain`, it deliberately does **not** resolve a `**Domain:**` pack: archiving is identical for every task regardless of its domain, so there is no domain-specific overlay to load. Its source of truth is `./references/workflow/task-archiving.md` (the archive location), `./references/workflow/task-layout.md` (the discovery rules), and `./references/workflow/status-transitions.md` (the **terminal-state set** that says which tasks are finished), read **at run time** — never a hardcoded status list.

This skill moves a finished task folder into its own parent's `Archive/` — canonically from `.agents/tasks/` into `.agents/tasks/Archive/`, though a task folder anywhere on disk archives the same way — so the active list shows only live work. It is the **write** side of the archive boundary whose read side already exists: discovery rules already exclude `Archive/` from active scans and fall back into it for an explicit slug (`task-layout.md`); the location-relative move itself is the contract in `./references/workflow/task-archiving.md`, read at run time. Archiving is a one-way move — a plain `mv` of the whole folder, which preserves every internal `./` link. It never edits task content, never changes a `**Status:**`, and never touches git.

**CRITICAL**:

- **Terminal tasks only.** Archive a task only when its `plan.md` `**Status:**` is one of the **terminal states** that `status-transitions.md` defines — read them from there at run time; don't bake the names in here. A task in any non-terminal (live) state is refused and reported; never archive it, and never change its status to make it archivable.
- **Operate only on the resolved folder.** Everything after Step 1 — the terminal check, the destination guard, and the move — acts on the *exact path resolved in Step 1*, never on a path rebuilt from the slug plus the current directory. A path can resolve to a folder in another project or anywhere else on disk; a cwd-relative `.agents/tasks/<slug>` would then validate one task but move a same-slug task somewhere else. Derive the archive destination from the resolved folder's own parent directory, not from cwd.
- **Read-only on status and content.** This skill moves the folder; it does not edit `**Status:**`, goals, plan steps, or the result record. If a task should be abandoned, the user does that through the normal lifecycle (`task-lifecycle.md`) first, then re-runs.
- **Never clobber.** If the destination `Archive/<slug>/` under the resolved task's own parent already exists, refuse — don't overwrite or merge into it.
- **Never touch git.** No add, commit, checkout, stash, or `git mv`. The move is a plain working-tree `mv`; the user reviews with `git status` / `git diff` and commits.
- **Whole folder, one move.** Move the entire folder in a single operation so its `./`-relative cross-links survive. Never copy or relocate files individually.

## When to Use

**Use when:**

- A task has reached a terminal state (finished or abandoned, per `status-transitions.md`) and you want it out of its parent's active listing (canonically `.agents/tasks/`).
- The active task list has grown cluttered with completed work.

**Skip when:**

- The task is still live (any non-terminal state) — finish or abandon it first; this skill won't archive in-flight work.
- You want to *un-archive* a task — that's a manual `mv` back out of `Archive/`; this skill is one-way (see `task-archiving.md`).
- There's no `.agents/tasks/` folder yet and no task was named by path — nothing to archive.

## Process

### 1. Resolve the target task folder

Resolve per the **resolve-or-ask** base resolution in `./references/workflow/task-layout.md` § *Discovery rules for skills*, read at run time — that section owns every branch (a bare slug across the canonical root and every registered one, each with its `Archive/` fallback; an explicit folder path; a `plan.md` path; and the nothing-named listing). Don't work from a copy: this skill carried one, and it went stale the moment the registry widened where a slug resolves.

Two additions are this skill's own:

- **Already archived** → when the slug matches only a folder inside an `Archive/`, report that it's already archived and stop. Nothing to do, and re-archiving would nest it.
- **The nothing-named listing carries status** → show each active folder's `plan.md` `**Status:**` beside it, so the choice is made against what is actually terminal. Don't guess.

If nothing matches, report the task wasn't found and list the active folders.

Call the folder you resolve here `SRC`, and the directory that *contains* it `PARENT` — canonically a `.agents/tasks/` directory, but any parent on disk works the same, and it may live outside the current working directory entirely. Every step below operates on `SRC` and `PARENT`; never rebuild a path from the slug and the current directory.

**Validate the resolved folder (every branch, before going further).** However `SRC` was produced — slug, folder path, or `plan.md` path — confirm it is a real, live task folder by **contents and position**, not by address shape:

- `SRC` must be a task folder by contents: a real directory (not a symlink) holding a top-level `plan.md` — Step 2 reads its `**Status:**` and refuses when the file is missing or the status isn't in the lifecycle vocabulary, so a folder that merely "looks done" never passes. A folder that itself *contains* an `Archive/` or a `Backlog/` subdirectory (both matched case-insensitively, per `task-archiving.md` and `task-backlog.md`) is a task **parent**, not a task folder — **refuse**; moving it would drag its whole archive and backlog along.
- If `SRC`'s **immediate parent directory is named `Archive`** (matched **case-insensitively**, per `task-archiving.md` — a lowercase `archive/` from an older layout, or the same folder on a case-insensitive filesystem such as macOS's APFS, still counts), the task is already archived — that is exactly where location-relative archiving puts one → report it and stop (a no-op). This is the case a bare `plan.md` path can otherwise slip past: never let `PARENT` resolve to an `Archive/` directory and re-archive into `Archive/Archive/<slug>`. A directory named `Archive` *higher* up the path (the user's own tree naming) does not count — only the immediate parent.
- If `SRC`'s **immediate parent directory is named `Backlog`** (matched **case-insensitively**, per `task-backlog.md`), the task is parked — and a terminal task inside a backlog is misfiled there (`task-backlog.md`). It still archives, but **out of the backlog**, per the backlog exception in `task-archiving.md`: **rebind `PARENT` to the backlog container's own parent** before Step 3, so `DEST` derives as `<backlog's parent>/Archive/<slug>` and the one move both leaves the backlog and archives — never a nested `Backlog/Archive/<slug>`. As with the `Archive` check above, only the immediate parent counts.

### 2. Confirm the task is terminal

Read the resolved folder's `plan.md` `**Status:**`, then look it up in the plan-state vocabulary in `task-lifecycle.md` — don't compare against a list of names baked into this skill:

- **A terminal state** (one of the terminal set `./references/workflow/status-transitions.md` defines) → proceed to step 3.
- **A non-terminal (live) state** → **Refuse**: report the current status and tell the user to carry the task to a terminal state — finish it, or abandon it — through the normal lifecycle, then re-run. Change nothing on disk.
- **No `plan.md`, or a `**Status:**` not in that vocabulary** → can't confirm the task is finished. Refuse and report; don't archive a folder of unknown state.

### 3. Guard the destination

Let `slug` be `SRC`'s own folder name and `DEST = PARENT/Archive/<slug>` — both anchored on the parent resolved in Step 1 (rebound to the backlog's own parent when Step 1 found `SRC` parked — the one case where `PARENT` is not `SRC`'s immediate parent), **never** on the current directory. Then:

- If `DEST` already exists → **refuse**: something already holds that slug in this archive; report it rather than overwriting or merging.
- If `PARENT/Archive` exists but is a **symlink** or **not a directory** → **refuse**: a symlinked `Archive/` sends the move through the link to an unexpected location, and a file named `Archive` can't hold the task. Require a real directory — or nothing — at `PARENT/Archive`. (Only `PARENT/Archive` itself matters; a symlinked *ancestor* — macOS's `/tmp` → `/private/tmp`, say — affects `SRC` and `DEST` identically and is fine.)
- If `PARENT/Archive` already exists as a real directory with unrelated, non-task content (a user's own `~/notes/Archive/`) → **use it**: archiving adds `<slug>/` beside whatever is there; the only collision that matters is `DEST` itself.

If the checks pass, create `PARENT/Archive/` as a real directory if it doesn't exist yet (`mkdir -p -- "$PARENT/Archive"`).

### 4. Move the folder

Move the resolved `SRC` — not a path rebuilt from the slug and cwd — into `DEST` in one operation:

```bash
# SRC, PARENT, and DEST were all fixed in Steps 1 and 3.
mv -- "$SRC" "$DEST"
```

A plain filesystem move — no git. The source is the exact folder resolved and validated above, and the destination sits in that folder's own `PARENT/Archive/`, so a `plan.md` path from another project can never validate one task and move another. Because every cross-reference inside the folder is `./`-relative, the move rewrites nothing inside it.

### 5. Report

Confirm what moved (`<slug>` → the actual `DEST`), note that the folder's internal links are intact, and remind the user that the task is now excluded from active listings; when `SRC` was parked, say the move also took it out of `Backlog/`. To un-archive it, move it back out of `Archive/` — naming its slug only lets discovery find it there, it does not un-archive it. When the folder is inside a git repo, the change is working-tree-only — review with `git status` and commit; a task outside any repo has nothing to commit.

The move is the whole of this section's write surface: nothing is regenerated, refreshed, or recorded outside `PARENT` afterwards.

## Output Template

On success:

```markdown
# archive-task — <slug>

Archived `<slug>` → `<DEST>` (plan was `done`; canonically `.agents/tasks/Archive/<slug>/`).
Internal `./` links preserved; folder excluded from active listings.
Working-tree only — review with `git status` and commit (if the folder is inside a git repo).
```

On refusal:

```markdown
# archive-task — <slug>

Not archived: plan `**Status:**` is `executing` (only tasks in a terminal state archive).
Carry it to `done`, or mark the plan `skipped`, then re-run.
```

## Don't Rationalize

- "This `plan.md` path has a `done` plan, good enough to move" — Check *what* it is first: a real task folder (top-level `plan.md`, no `Archive/` or `Backlog/` subdirectory inside it, its own parent not named `Archive/`). A tasks-parent directory would drag its whole archive and backlog along; an already-archived folder would nest `Archive/Archive/`. Refuse the former; no-op the latter.
- "It's parked in `Backlog/`, so its own parent's `Archive/` is `Backlog/Archive/` — close enough" — No: frozen history never files inside the container that holds unstarted work (`task-backlog.md`). Rebind `PARENT` to the backlog's own parent per the backlog exception in `task-archiving.md`; the archive lands beside the backlog, not inside it.
- "I'll just `mv .agents/tasks/<slug> …` from here" — That rebuilds the path from the current directory plus the slug, which can differ from the folder you resolved and validated. Move the exact resolved `SRC` into its own `PARENT/Archive/`; never assume the current directory is the resolved folder's project.
- "`Archive/` is probably a normal directory" — Check. If `PARENT/Archive` is a symlink, `mv` follows it and relocates the task somewhere else entirely. Refuse a symlinked (or file) `PARENT/Archive`.
- "`<parent>/Archive/` has the user's own files in it — I'll refuse or pick another spot" — No: an existing `Archive/` directory is fine at any location; archiving adds `<slug>/` beside whatever is there. The only refusals are a `DEST` collision or a symlink/non-directory at `PARENT/Archive`.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Terminal vs. live decided by reading `./references/workflow/status-transitions.md`'s terminal set at run time; archive location read from `task-archiving.md`, discovery from `task-layout.md` — nothing baked in
- [ ] `SRC` validated by contents and position (real non-symlink directory with a top-level `plan.md`; not a tasks-parent; immediate parent not named `Archive/` in any case); already-archived folders no-op'd, never nested into `Archive/Archive/`; a parked `SRC` (immediate parent named `Backlog/`, any case) archived out with `PARENT` rebound to the backlog's own parent — never into `Backlog/Archive/`
- [ ] Non-terminal, unknown-status, or missing-`plan.md` folders refused with the path to proceed; status and content never edited
- [ ] Destination guarded — `DEST` collision refused, symlink or non-directory at `PARENT/Archive` refused
- [ ] The exact resolved `SRC` moved into its own `PARENT/Archive/` in one operation (never a path rebuilt from slug + cwd); internal `./` links intact
- [ ] No git state mutated; nothing outside `PARENT` touched

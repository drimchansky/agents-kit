---
name: archive-task
description: Use when asked to archive a finished task — move a completed (`done`) or abandoned (`skipped`) task folder into its parent's `archive/` (canonically `.agents/tasks/archive/`) to keep the active list short.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.

This skill operates on the **task-folder envelope** — it relocates a whole task folder on disk — not on a task's domain content. Like `migrate-task-format`, it deliberately does **not** resolve a `**Domain:**` pack: archiving is identical for every task regardless of its domain, so there is no domain-specific overlay to load. Its source of truth is `./references/workflow/task-layout.md` (the archive location and discovery rules) and `./references/workflow/task-lifecycle.md` (the **terminal-state set** that says which tasks are finished), read **at run time** — never a hardcoded status list.

This skill moves a finished task folder into its own parent's `archive/` — canonically from `.agents/tasks/` into `.agents/tasks/archive/`, though a task folder anywhere on disk archives the same way — so the active list shows only live work. It is the **write** side of the archive boundary whose read side already exists: discovery rules already exclude `archive/` from active scans and fall back into it for an explicit slug (`task-layout.md`). Archiving is a one-way move — a plain `mv` of the whole folder, which preserves every internal `./` link. It never edits task content, never changes a `**Status:**`, and never touches git.

**CRITICAL**:

- **Terminal tasks only.** Archive a task only when its `plan.md` `**Status:**` is one of the **terminal states** that `task-lifecycle.md` defines — read them from there at run time; don't bake the names in here. A task in any non-terminal (live) state is refused and reported; never archive it, and never change its status to make it archivable.
- **Operate only on the resolved folder.** Everything after Step 1 — the terminal check, the destination guard, and the move — acts on the *exact path resolved in Step 1*, never on a path rebuilt from the slug plus the current directory. A path can resolve to a folder in another project or anywhere else on disk; a cwd-relative `.agents/tasks/<slug>` would then validate one task but move a same-slug task somewhere else. Derive the archive destination from the resolved folder's own parent directory, not from cwd.
- **Read-only on status and content.** This skill moves the folder; it does not edit `**Status:**`, goals, plan steps, or the result record. If a task should be abandoned, the user does that through the normal lifecycle (`task-lifecycle.md`) first, then re-runs.
- **Never clobber.** If the destination `archive/<slug>/` under the resolved task's own parent already exists, refuse — don't overwrite or merge into it.
- **Never touch git.** No add, commit, checkout, stash, or `git mv`. The move is a plain working-tree `mv`; the user reviews with `git status` / `git diff` and commits.
- **Whole folder, one move.** Move the entire folder in a single operation so its `./`-relative cross-links survive. Never copy or relocate files individually.

## When to Use

**Use when:**

- A task has reached a terminal state (finished or abandoned, per `task-lifecycle.md`) and you want it out of its parent's active listing (canonically `.agents/tasks/`).
- The active task list has grown cluttered with completed work.

**Skip when:**

- The task is still live (any non-terminal state) — finish or abandon it first; this skill won't archive in-flight work.
- You want to *un-archive* (revive) a task — that's a manual `mv` back out of `archive/`; this skill is one-way (see `task-layout.md`'s revive note).
- There's no `.agents/tasks/` folder yet and no task was named by path — nothing to archive.

## Process

### 1. Resolve the target task folder

Resolve per the base resolution rules in `./references/workflow/task-layout.md`:

- **Bare slug given** → resolve to `.agents/tasks/<slug>/` among the canonical root's active folders (excluding `archive/`). If it matches an active folder, use it. If the slug matches only an **already-archived** folder (`.agents/tasks/archive/<slug>/`), report that it's already archived and stop — nothing to do.
- **Explicit task-folder path given** → use it verbatim, anywhere on disk; the folder's own name is the slug.
- **Full `plan.md` path given** → derive the task folder from its parent.
- **Nothing named** → list the active task folders with each one's `plan.md` `**Status:**`, and ask which to archive (the **resolve-or-ask** fallback). Don't guess.

If nothing matches, report the task wasn't found and list the active folders.

Call the folder you resolve here `SRC`, and the directory that *contains* it `PARENT` — canonically a `.agents/tasks/` directory, but any parent on disk works the same, and it may live outside the current working directory entirely. Every step below operates on `SRC` and `PARENT`; never rebuild a path from the slug and the current directory.

**Validate the resolved folder (every branch, before going further).** However `SRC` was produced — slug, folder path, or `plan.md` path — confirm it is a real, live task folder by **contents and position**, not by address shape:

- `SRC` must be a task folder by contents: a real directory (not a symlink) holding a top-level `plan.md` — Step 2 reads its `**Status:**` and refuses when the file is missing or the status isn't in the lifecycle vocabulary, so a folder that merely "looks done" never passes. A folder that itself *contains* an `archive/` subdirectory is a task **parent**, not a task folder — **refuse**; moving it would drag its whole archive along.
- If `SRC`'s **immediate parent directory is named `archive`**, the task is already archived — that is exactly where location-relative archiving puts one → report it and stop (a no-op). This is the case a bare `plan.md` path can otherwise slip past: never let `PARENT` resolve to an `archive/` directory and re-archive into `archive/archive/<slug>`. A directory named `archive` *higher* up the path (the user's own tree naming) does not count — only the immediate parent.

### 2. Confirm the task is terminal

Read the resolved folder's `plan.md` `**Status:**`, then look it up in the plan-state vocabulary in `task-lifecycle.md` — don't compare against a list of names baked into this skill:

- **A terminal state** (one of the terminal set `task-lifecycle.md` defines) → proceed to step 3.
- **A non-terminal (live) state** → **Refuse**: report the current status and tell the user to carry the task to a terminal state — finish it, or abandon it — through the normal lifecycle, then re-run. Change nothing on disk.
- **No `plan.md`, or a `**Status:**` not in that vocabulary** → can't confirm the task is finished. Refuse and report; don't archive a folder of unknown state.

### 3. Guard the destination

Let `slug` be `SRC`'s own folder name and `DEST = PARENT/archive/<slug>` — both anchored on the parent resolved in Step 1, **never** on the current directory. Then:

- If `DEST` already exists → **refuse**: something already holds that slug in this archive; report it rather than overwriting or merging.
- If `PARENT/archive` exists but is a **symlink** or **not a directory** → **refuse**: a symlinked `archive/` sends the move through the link to an unexpected location, and a file named `archive` can't hold the task. Require a real directory — or nothing — at `PARENT/archive`. (Only `PARENT/archive` itself matters; a symlinked *ancestor* — macOS's `/tmp` → `/private/tmp`, say — affects `SRC` and `DEST` identically and is fine.)
- If `PARENT/archive` already exists as a real directory with unrelated, non-task content (a user's own `~/notes/archive/`) → **use it**: archiving adds `<slug>/` beside whatever is there; the only collision that matters is `DEST` itself.

If the checks pass, create `PARENT/archive/` as a real directory if it doesn't exist yet (`mkdir -p -- "$PARENT/archive"`).

### 4. Move the folder

Move the resolved `SRC` — not a path rebuilt from the slug and cwd — into `DEST` in one operation:

```bash
# SRC, PARENT, and DEST were all fixed in Steps 1 and 3.
mv -- "$SRC" "$DEST"
```

A plain filesystem move — no git. The source is the exact folder resolved and validated above, and the destination sits in that folder's own `PARENT/archive/`, so a `plan.md` path from another project can never validate one task and move another. Because every cross-reference inside the folder is `./`-relative, the move rewrites nothing inside it.

### 5. Report

Confirm what moved (`<slug>` → the actual `DEST`), note that the folder's internal links are intact, and remind the user that the task is now excluded from active listings; to revive it, move it back out of `archive/` — naming its slug only lets discovery find it there, it does not revive it. When the folder is inside a git repo, the change is working-tree-only — review with `git status` and commit; a task outside any repo has nothing to commit.

## Output Template

On success:

```markdown
# archive-task — <slug>

Archived `<slug>` → `<DEST>` (plan was `done`; canonically `.agents/tasks/archive/<slug>/`).
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

- "The task is basically finished, I'll archive it even though the plan says `executing`" — Only terminal tasks archive. A non-terminal (live) status means live work; refuse and report.
- "This `plan.md` path has a `done` plan, good enough to move" — Check *what* it is first: a real task folder (top-level `plan.md`, no `archive/` subdirectory inside it, its own parent not named `archive/`). A tasks-parent directory would drag its whole archive along; an already-archived folder would nest `archive/archive/`. Refuse the former; no-op the latter.
- "I'll just mark the plan `skipped` so I can archive it" — This skill never edits `**Status:**`. Abandoning a task is the user's lifecycle call; they mark it, then re-run.
- "An archived folder with this slug exists — I'll merge into it" — A destination collision is a refusal, not a merge. Don't clobber another task's record.
- "I'll `git mv` so the move is staged" — Never touch git. Plain working-tree `mv`; the user commits.
- "I'll move the files one at a time" — Move the whole folder in one operation so the `./` links survive; never relocate files individually.
- "There's no `plan.md` but the folder looks done" — No confirmable terminal status means no archive. Refuse and report.
- "I'll just `mv .agents/tasks/<slug> …` from here" — That rebuilds the path from the current directory plus the slug, which can differ from the folder you resolved and validated. Move the exact resolved `SRC` into its own `PARENT/archive/`; never assume the current directory is the resolved folder's project.
- "`archive/` is probably a normal directory" — Check. If `PARENT/archive` is a symlink, `mv` follows it and relocates the task somewhere else entirely. Refuse a symlinked (or file) `PARENT/archive`.
- "`<parent>/archive/` has the user's own files in it — I'll refuse or pick another spot" — No: an existing `archive/` directory is fine at any location; archiving adds `<slug>/` beside whatever is there. The only refusals are a `DEST` collision or a symlink/non-directory at `PARENT/archive`.

## Verification

- [ ] Determined terminal vs. live by reading `task-lifecycle.md`'s terminal set at run time — not a status list baked into this skill; archive location + discovery rules likewise read from `task-layout.md`
- [ ] Resolved the target per base resolution — bare slug among the canonical root's active folders (excluding `archive/`), explicit path used verbatim; an already-archived slug reported as a no-op
- [ ] Validated `SRC` by contents and position (a real non-symlink directory with a top-level `plan.md`, no `archive/` subdirectory inside it, immediate parent not named `archive/`); task-parent directories refused, already-archived folders no-op'd, never re-archived into `archive/archive/`
- [ ] Archived only when `plan.md` `**Status:**` is a terminal state per `task-lifecycle.md`; a non-terminal or unknown status refused with its status and the path to proceed
- [ ] `**Status:**`, goals, plan steps, and result content left unedited (the skill moves the folder, nothing else)
- [ ] Destination collision (`archive/<slug>/` already exists) refused, not overwritten
- [ ] Whole folder moved in one operation; internal `./` links still resolve after the move
- [ ] The folder moved is the exact one resolved in Step 1 (`SRC`), not a path rebuilt from slug + cwd; the destination is `SRC`'s own `PARENT/archive/`
- [ ] Refused when `PARENT/archive` is a symlink or a non-directory, instead of moving through or into it (ancestor symlinks are fine)
- [ ] No git state mutated (no add, commit, checkout, stash, `git mv`); change is working-tree-only
- [ ] Nothing outside `PARENT` touched — the move stays inside the resolved task's own parent directory

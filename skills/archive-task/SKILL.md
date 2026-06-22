---
name: archive-task
description: Use when asked to archive a finished task — move a completed (`done`) or abandoned (`skipped`) task folder under `.agents/tasks/` into `archive/` to keep the active list short.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.

This skill operates on the **task-folder envelope** — it relocates a whole task folder on disk — not on a task's domain content. Like `migrate-task-format`, it deliberately does **not** resolve a `**Domain:**` pack: archiving is identical for every task regardless of its domain, so there is no domain-specific overlay to load. Its source of truth is `./references/workflow/task-layout.md` (the archive location and discovery rules) and `./references/workflow/task-lifecycle.md` (the **terminal-state set** that says which tasks are finished), read **at run time** — never a hardcoded status list.

This skill moves a finished task folder from the active `.agents/tasks/` list into `.agents/tasks/archive/`, so the active list shows only live work. It is the **write** side of the archive boundary whose read side already exists: discovery rules already exclude `archive/` from active scans and fall back into it for an explicit slug (`task-layout.md`). Archiving is a one-way move — a plain `mv` of the whole folder, which preserves every internal `./` link. It never edits task content, never changes a `**Status:**`, and never touches git.

**CRITICAL**:

- **Terminal tasks only.** Archive a task only when its `plan.md` `**Status:**` is one of the **terminal states** that `task-lifecycle.md` defines — read them from there at run time; don't bake the names in here. A task in any non-terminal (live) state is refused and reported; never archive it, and never change its status to make it archivable.
- **Operate only on the resolved folder.** Everything after Step 1 — the terminal check, the destination guard, and the move — acts on the *exact path resolved in Step 1*, never on a path rebuilt from the slug plus the current directory. A `plan.md` path can resolve to a folder in another project (or under a different cwd); a cwd-relative `.agents/tasks/<slug>` would then validate one task but move a same-slug task somewhere else. Derive the archive destination from the resolved folder's own task root, not from cwd.
- **Read-only on status and content.** This skill moves the folder; it does not edit `**Status:**`, goals, plan steps, or the result record. If a task should be abandoned, the user does that through the normal lifecycle (`task-lifecycle.md`) first, then re-runs.
- **Never clobber.** If the destination `archive/<slug>/` under the resolved task's own root already exists, refuse — don't overwrite or merge into it.
- **Never touch git.** No add, commit, checkout, stash, or `git mv`. The move is a plain working-tree `mv`; the user reviews with `git status` / `git diff` and commits.
- **Whole folder, one move.** Move the entire folder in a single operation so its `./`-relative cross-links survive. Never copy or relocate files individually.

## When to Use

**Use when:**

- A task has reached a terminal state (finished or abandoned, per `task-lifecycle.md`) and you want it out of the active `.agents/tasks/` listing.
- The active task list has grown cluttered with completed work.

**Skip when:**

- The task is still live (any non-terminal state) — finish or abandon it first; this skill won't archive in-flight work.
- You want to *un-archive* (revive) a task — that's a manual `mv` back out of `archive/`; this skill is one-way (see `task-layout.md`'s revive note).
- There's no `.agents/tasks/` folder yet — nothing to archive.

## Process

### 1. Resolve the target task folder

Resolve per the base resolution rules in `./references/workflow/task-layout.md`:

- **Slug or task-folder path given** → resolve to `.agents/tasks/<slug>/` among the active folders (excluding `archive/`). If it matches an active folder, use it. If the slug matches only an **already-archived** folder (`.agents/tasks/archive/<slug>/`), report that it's already archived and stop — nothing to do.
- **Full `plan.md` path given** → derive the task folder from its parent.
- **Nothing named** → list the active task folders with each one's `plan.md` `**Status:**`, and ask which to archive (the **resolve-or-ask** fallback). Don't guess.

If nothing matches, report the task wasn't found and list the active folders.

Call the folder you resolve here `SRC`, and its task root `TASKS` — the `.agents/tasks/` directory that *contains* `SRC` (its parent), which may live in a different project than the current working directory. Every step below operates on `SRC` and `TASKS`; never rebuild a path from the slug and the current directory.

**Validate canonical placement (every branch, before going further).** However `SRC` was produced — slug, folder path, or `plan.md` path — confirm it is a real *active* task folder before touching it:

- `SRC` must sit *directly* under a task root: its parent must be a `tasks/` directory whose own parent is `.agents/` — i.e. `SRC` = `<root>/.agents/tasks/<slug>/`, exactly one level under `tasks/`. An arbitrary path, or a folder nested deeper, is **refused** — this skill only moves canonical task folders, never content elsewhere on disk.
- If any component of `SRC`'s path is `archive/` (the input already points inside `.agents/tasks/archive/`), the task is **already archived** → report it and stop (a no-op). This is the case a bare `plan.md` path can otherwise slip past: never let `TASKS` resolve to `.agents/tasks/archive` and re-archive into `archive/archive/<slug>`.

### 2. Confirm the task is terminal

Read the resolved folder's `plan.md` `**Status:**`, then look it up in the plan-state vocabulary in `task-lifecycle.md` — don't compare against a list of names baked into this skill:

- **A terminal state** (one of the terminal set `task-lifecycle.md` defines) → proceed to step 3.
- **A non-terminal (live) state** → **Refuse**: report the current status and tell the user to carry the task to a terminal state — finish it, or abandon it — through the normal lifecycle, then re-run. Change nothing on disk.
- **No `plan.md`, or a `**Status:**` not in that vocabulary** → can't confirm the task is finished. Refuse and report; don't archive a folder of unknown state.

### 3. Guard the destination

Let `slug` be `SRC`'s own folder name and `DEST = TASKS/archive/<slug>` — both anchored on the task root resolved in Step 1, **never** on the current directory. Then:

- If `DEST` already exists → **refuse**: a distinct archived task already holds that slug; report it rather than overwriting or merging.
- If `TASKS/archive` (or any component of the path) is a **symlink** → **refuse**: a symlinked `archive/` would send the move through the link to an unexpected location. Require a real directory inside `TASKS`.

If both checks pass, create `TASKS/archive/` as a real directory if it doesn't exist yet (`mkdir -p -- "$TASKS/archive"`).

### 4. Move the folder

Move the resolved `SRC` — not a path rebuilt from the slug and cwd — into `DEST` in one operation:

```bash
# SRC, TASKS, and DEST were all fixed in Steps 1 and 3.
mv -- "$SRC" "$DEST"
```

A plain filesystem move — no git. The source is the exact folder resolved and validated above, and the destination sits in that folder's own `TASKS/archive/`, so a `plan.md` path from another project can never validate one task and move another. Because every cross-reference inside the folder is `./`-relative, the move rewrites nothing inside it.

### 5. Report

Confirm what moved (`<slug>` → `archive/<slug>/`), note that the folder's internal links are intact, and remind the user that the task is now excluded from active listings; to revive it, move it back out of `archive/` — naming its slug only lets discovery find it there, it does not revive it. The change is working-tree-only — review with `git status` and commit.

## Output Template

On success:

```markdown
# archive-task — <slug>

Archived `<slug>` → `.agents/tasks/archive/<slug>/` (plan was `done`).
Internal `./` links preserved; folder excluded from active listings.
Working-tree only — review with `git status` and commit.
```

On refusal:

```markdown
# archive-task — <slug>

Not archived: plan `**Status:**` is `executing` (only tasks in a terminal state archive).
Carry it to `done`, or mark the plan `skipped`, then re-run.
```

## Don't Rationalize

- "The task is basically finished, I'll archive it even though the plan says `executing`" — Only terminal tasks archive. A non-terminal (live) status means live work; refuse and report.
- "This `plan.md` path has a `done` plan, good enough to move" — Check *where* it lives first. If `SRC` isn't directly under `.agents/tasks/<slug>/`, or it's inside `archive/`, archiving it would move content out of the tree or nest `archive/archive/`. Refuse a non-canonical path; treat an already-archived one as a no-op.
- "I'll just mark the plan `skipped` so I can archive it" — This skill never edits `**Status:**`. Abandoning a task is the user's lifecycle call; they mark it, then re-run.
- "An archived folder with this slug exists — I'll merge into it" — A destination collision is a refusal, not a merge. Don't clobber another task's record.
- "I'll `git mv` so the move is staged" — Never touch git. Plain working-tree `mv`; the user commits.
- "I'll move the files one at a time" — Move the whole folder in one operation so the `./` links survive; never relocate files individually.
- "There's no `plan.md` but the folder looks done" — No confirmable terminal status means no archive. Refuse and report.
- "I'll just `mv .agents/tasks/<slug> …` from here" — That rebuilds the path from the current directory plus the slug, which can differ from the folder you resolved and validated. Move the exact resolved `SRC` into its own `TASKS/archive/`; never assume the current directory is the resolved folder's project.
- "`archive/` is probably a normal directory" — Check. If it's a symlink, `mv` follows it and relocates the task outside the tree. Refuse a symlinked `archive/`.

## Verification

- [ ] Determined terminal vs. live by reading `task-lifecycle.md`'s terminal set at run time — not a status list baked into this skill; archive location + discovery rules likewise read from `task-layout.md`
- [ ] Resolved the target among active folders (excluding `archive/`); an already-archived slug reported as a no-op
- [ ] Validated `SRC` is a canonical active task folder (`<root>/.agents/tasks/<slug>/`, not under `archive/`, not an arbitrary or deeper path); archived or arbitrary inputs were no-op'd or refused, never re-archived into `archive/archive/`
- [ ] Archived only when `plan.md` `**Status:**` is a terminal state per `task-lifecycle.md`; a non-terminal or unknown status refused with its status and the path to proceed
- [ ] `**Status:**`, goals, plan steps, and result content left unedited (the skill moves the folder, nothing else)
- [ ] Destination collision (`archive/<slug>/` already exists) refused, not overwritten
- [ ] Whole folder moved in one operation; internal `./` links still resolve after the move
- [ ] The folder moved is the exact one resolved in Step 1 (`SRC`), not a path rebuilt from slug + cwd; the destination is `SRC`'s own `TASKS/archive/`
- [ ] Refused when `archive/` (or a path component) is a symlink, instead of moving through it
- [ ] No git state mutated (no add, commit, checkout, stash, `git mv`); change is working-tree-only
- [ ] Nothing outside `.agents/tasks/` touched

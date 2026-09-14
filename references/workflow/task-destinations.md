# Task Destinations: Where a New Task Folder Lands

## Destination paths (creating skills)

The resolve-or-create skills in `./task-layout.md` accept an optional destination. Resolve creation in this order:

1. The user's explicit destination.
2. A matched project area in a registered root, confirmed when the canonical root holds a task.
3. The project-local canonical root, `.agents/tasks/<slug>/`.

`decompose-task` Phase 1 step 2 continues an existing sibling sequence before item 2.

Interpret explicit destinations from disk:

- Existing task folder, under `./task-layout.md` § *One task, one flat folder*: use it verbatim, with its basename as slug.
- Existing non-task directory: create `<path>/<slug>/`. If its basename already equals the derived slug, ask before creating a doubled path.
- Missing path with the derived slug as basename: create the folder verbatim. Otherwise ask whether the path names the parent or the task itself.
- Existing file: refuse; the destination must be a directory.

Resolve an absolute path before use. Before creating live work anywhere considered archived by `./task-archiving.md` § *Already archived is asked of the whole path up to the store*, warn and confirm. Backlog requires no equivalent confirmation; a task may be created parked (`./task-backlog.md`).

## A matched project area

A registered root matches when it contains an area whose basename equals the main checkout's basename case-insensitively, and that area **holds a task**. Use the main checkout root, including from linked worktrees, not the current directory or nearest `.agents` ancestor.

For every occupancy check here, **holds a task** means the recursive walk in `./task-store.md` § *The root registry* finds a recognized task. Count tasks under groups and all Archive/Backlog containers. Recognition uses `./task-layout.md` § *One task, one flat folder*.

- When the canonical root also holds a task, confirm the matched area first. Declining uses the canonical root. Without canonical tasks, an unambiguous match needs no confirmation.
- If that confirmation cannot be presented, use the canonical root and say: `No destination given and the area confirmation is unavailable; creating in <absolute canonical root>.`
- Announce every matched-area creation before use: `Creating in <absolute destination> — matched area <area> to git root <basename>; pass a destination path to override.`
- With no registry, no matching basename, or an area holding no task, fall through silently to the canonical root.

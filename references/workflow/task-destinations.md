# Task Destinations: Where a New Task Folder Lands

Where a **creating** skill puts a new task folder — the precedence that places it, how an explicit destination path is read off what is on disk, and when a registered root's project area is used instead of the canonical root — split out of `./task-layout.md`, which keeps the folder shape, the recognition set, and the discovery rules that find an *existing* folder. **This file is the single source of truth for destination resolution.** Read it when creating a task folder, or when stating what registering a root does and does not grant.

## Destination paths (creating skills)

The creating skills — `resolve-or-create`'s four members, listed in `./task-layout.md` § *Discovery rules for skills* — accept an optional destination path naming where the task folder should live. A new task folder's location resolves by this precedence. `decompose-task` is the one member that interposes a step of its own: its Phase 1 step 2 continues a source's sibling sequence ahead of step 2 below.

1. **An explicit destination path** the user gave.
2. **A matched project area in a registered root** — confirmed first when the project-local canonical root holds a task.
3. **The project-local canonical root**, `.agents/tasks/<slug>/`.

Interpret an explicit destination path by what's on disk:

- **Exists, and is a task folder** (by contents, per the **recognition set** in `./task-layout.md` § *One task, one flat folder* — that section owns the file list, including the legacy suffix forms) → that *is* the task folder; use it verbatim. Its name is the slug — don't derive one.
- **Exists, and is a directory** holding no recognition-set file → it's the **parent**: create `<path>/<slug>/` inside it. Exception: if its basename already equals the derived slug, ask — silently creating `<slug>/<slug>/` is almost never intended.
- **Doesn't exist** → if its basename equals the derived slug, the user named the folder itself: create it verbatim. Otherwise ask whether to create `<path>/<slug>/` inside it (the usual intent) or use `<path>` as the folder itself.
- **Exists, but is a file** → refuse; a destination must be a directory.

Resolve the destination to an absolute path before using it. Avoid creating a live task directly under a directory named `Archive/` — location-relative archiving (`./task-archiving.md`) reads that as already archived; warn and confirm first. A destination under a directory named `Backlog/` needs no such guard — it creates the task parked from birth, which is permitted (`./task-backlog.md`).

## A matched project area

A registered root (`./task-store.md`) matches when it holds an area directory whose basename equals the git root's basename case-insensitively — `Tasks/Treasury/` matches the `treasury` checkout — *and* that area **holds a task**. A directory **holds a task** when at least one folder inside it is a task folder by the **recognition set** in `./task-layout.md` § *One task, one flat folder*, counting those under `Archive/` and `Backlog/`: an archive proves the project's tasks live there. That one test settles every occupancy question in this rule — no other reading of "empty" applies. **Git root** here means the main checkout's root — not the working directory, and not the nearest `.agents/` ancestor — so a linked worktree matches the area its main checkout does.

- **Confirm first only when the project-local canonical root holds a task** — the project demonstrably uses both roots, so which one is meant is a real question. Declining creates in the canonical root. When that root holds none, or is absent, an unambiguous match creates without asking.
- **When that confirmation can't be presented, create in the canonical root** and say which root and why: `No destination given and the area confirmation is unavailable; creating in <absolute canonical root>.` That is the default by rule — nothing here detects a run mode.
- **Creation in a matched area is never silent.** Print the **absolute** destination path — not the area name — what it matched on, and that a destination path overrides it: `Creating in <absolute destination> — matched area <area> to git root <basename>; pass a destination path to override.` A case-insensitive compare can land on the wrong project, and this line is what makes that visible before the folder is used.
- **No match falls through to the canonical root silently** — no registry, no area of that basename, or an area of that basename that holds no task creates `.agents/tasks/<slug>/`, with no confirmation and no notice.

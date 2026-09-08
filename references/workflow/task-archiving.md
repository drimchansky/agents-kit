# Archiving Finished Tasks (Optional)

How a finished task folder leaves the active listings — the discovery rules that exclude what sits under `Archive/` stay in the sibling `task-layout.md`. **This file is the single source of truth for archiving.**

Archiving is **location-relative**: a finished task folder moves into an `Archive/` subdirectory of whatever directory contains it — the same rule at every location:

```
<parent>/<slug>/  →  <parent>/Archive/<slug>/      # canonically: .agents/tasks/Archive/<slug>/
```

A completed (`done`) or `skipped` task is moved there to keep its parent's active list short. At a non-canonical location `<parent>/Archive/` may already exist with the user's own unrelated content; that's fine — archiving adds `<slug>/` beside it, and the only collision that matters is `<parent>/Archive/<slug>/` itself.

**One exception to the mechanical line: a task already inside a `Backlog/`.** When `<parent>` is itself a backlog container (`./task-backlog.md`, matched case-insensitively), the finished task does not archive in place — that would nest `Backlog/Archive/<slug>/`, filing frozen history inside the container that holds unstarted work. It archives **out of the backlog** instead, into the backlog's own parent's archive:

```
<grandparent>/Backlog/<slug>/  →  <grandparent>/Archive/<slug>/
```

One move both takes the folder out of the backlog and archives it. `scripts/task-move.ts` derives its destination this way, and a hand `mv` follows the same line. Only the immediate parent takes the exception — a `Backlog` higher up the path is the user's own tree naming.

**Already archived is asked of the whole path up to the store, not of the immediate parent alone.** An archive container anywhere between the folder and the root it resolved in — a registered task root, or the canonical `.agents/tasks` — means the folder is already archived; a folder under neither is in no store, where there is no bound to draw and the whole path stays the reading. So a terminal task sitting at `<root>/Archive/<group>/<slug>` is refused for archiving rather than gaining a second container beneath the first, and is refused for parking on the same reading; the refusal names the container it found. The bound is what keeps the question inside the store: a directory named `archive` *above* the root is the user's own tree naming, exactly as a `Backlog` higher up the path is, and never makes the tasks beneath it unmovable. This is the archive's one asymmetry with the backlog, which stays the immediate parent's question at every depth — an `Archive` between a task and its store root is the lifecycle state of everything under it, while a `Backlog` there is not.

**Recognizing the directory is case-insensitive.** New archives are always *created* as `Archive/`, but wherever a skill *recognizes* an existing one — excluding it from an active scan, falling back into it for a bare slug, guarding a creation destination, or refusing to re-archive an already-archived folder — the name is matched **case-insensitively**. That last site reads the whole path up to the store, per the paragraph above; the others read the one directory in front of them. A lowercase `archive/` from a pre-rename layout, or the same folder on a case-insensitive filesystem (macOS's APFS), still counts as the archive. `maintain`'s format sweep normalizes a stray lowercase `archive/` container back to `Archive/`. **`scripts/lifecycle-constants.ts` carries the machine-readable copy of this name as `ARCHIVE_DIR`**, because the scripts that recognize the container cannot read prose at run time; rename it here and change that module in the same edit.

The `archive-task` skill performs this move by running `scripts/task-move.ts`, which confirms the plan is `done` or `skipped`, guards the destination, then relocates the whole folder — or you can `mv` it by hand, which lands the folder in the same place. What the hand move skips is the guards, the already-archived reading above among them: it will nest an archive inside an archive where the script refuses.

Moving a whole task folder preserves its internal `./` links, since every cross-reference inside the folder is relative to the folder itself. Nothing else needs rewriting.

**What the folder inherits is preserved with it.** The move drops the task below a container without taking it out of the groups it sat under, and a container is transparent to inheritance — including a `GROUP_CONTEXT.md` someone put directly inside `Archive/`, which is no source either before or after. `./task-store.md` § *Shared group context* owns that rule and this file adds nothing to it: an archived task's shared grounding is neither copied in, snapshotted, nor rewritten by the move.

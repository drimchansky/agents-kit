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

One move both takes the folder out of the backlog and archives it. `archive-task` derives its destination this way, and a hand `mv` follows the same line. Only the immediate parent takes the exception — a `Backlog` higher up the path is the user's own tree naming.

**Recognizing the directory is case-insensitive.** New archives are always *created* as `Archive/`, but wherever a skill *recognizes* an existing one — excluding it from an active scan, falling back into it for a bare slug, guarding a creation destination, or refusing to re-archive an already-archived folder — the name is matched **case-insensitively**. A lowercase `archive/` from a pre-rename layout, or the same folder on a case-insensitive filesystem (macOS's APFS), still counts as the archive. `maintain`'s format sweep normalizes a stray lowercase `archive/` container back to `Archive/`.

The `archive-task` skill performs this move — it confirms the plan is `done` or `skipped`, then relocates the whole folder — or you can `mv` it by hand; the result is identical.

Moving a whole task folder preserves its internal `./` links, since every cross-reference inside the folder is relative to the folder itself. Nothing else needs rewriting.

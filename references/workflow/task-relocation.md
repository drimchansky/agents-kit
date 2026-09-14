# Relocating a Task Folder: The Shared Move Protocol

Move whole folders through `scripts/task-move.ts` into a sibling Archive or Backlog container (`./task-archiving.md`, `./task-backlog.md`).

## 1. Resolve the target task folder

Use **resolve-or-ask** from `./task-layout.md` § *Discovery rules for skills* at run time. Resolve ambiguity before invoking the helper; pass the absolute folder path as `SRC`, not the unresolved slug.

Validate SRC by contents under the direction's recognition rule, wherever it sits. Refuse any folder containing its own Archive or Backlog directory, matched case-insensitively: it is a task parent and must not move with its children.

## 2. Run the move

```bash
node <kit-root>/scripts/task-move.ts <SRC> --to <archive|backlog>
```

Resolve `<kit-root>` using `./task-store.md` § *Resolving `<kit-root>`*. If unavailable, report that the move cannot run and stop; offer no hand-completed substitute.

Apply `../scripts/task-move.md`. The helper checks the direction's state gate, derives the destination from SRC's parent, and preserves an existing container's spelling. It refuses symlinked sources, symlinked/non-directory containers, and occupied destinations. Never bypass a refusal with a manual move or merge colliding folders.

Read its exit status:

- **0**: moved; stdout is `moved <src> -> <dest>`. Report that destination.
- **1**: refused, nothing moved. Surface stderr's reason verbatim and stop.
- **2**: run failed before deciding. For usage errors, unmatched/ambiguous slugs, or unreadable slug-search stores, correct the invocation to the resolved absolute SRC and retry. Report other failures and stop.

## 3. Report

Name the moved slug and printed destination, preserved internal `./` links, and exclusion from active listings. In a Git repository, report a working-tree-only move for the user to inspect and commit; outside one, there is nothing to commit.

The move is the entire write surface. Regenerate, refresh, and record nothing afterwards, including task grounding.

In-place filing preserves applicable group sources (`./task-store.md` § *Shared group context*). A move between groups is outside this protocol: use a plain move, and the next task invocation reads the new chain. Snapshot nothing and rewrite no context or prior result history. The user must repoint task citations to former group sources; those files may still exist while no longer applying, so ordinary drift checks will not catch stale applicability (`./one-home.md`).

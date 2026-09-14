# Parking Unstarted Tasks in a Backlog (Optional)

Park an unstarted task relative to its parent, excluding it from active listings (`./task-layout.md`):

```
<parent>/<slug>/  →  <parent>/Backlog/<slug>/
```

Location alone means parked; add no lifecycle status. Whole-folder moves, preserved links, existing-container content, and destination collisions follow `./task-archiving.md`.

**The entry gate is unstarted.** `scripts/task-move.ts` applies `../scripts/task-move.md` against `./task-lifecycle.md` § *Status values*. A refused task is not parked manually either. Live work pauses through blocked; terminal work archives, including terminal tasks already in Backlog, which archive out rather than nesting Archive beneath it.

Creating a fresh folder directly under Backlog is permitted and needs no Archive-style destination confirmation (`./task-destinations.md` § *Destination paths*).

**Recognizing the directory is case-insensitive.** Create `Backlog/`; recognize every existing spelling case-insensitively for scans, slug fallback, and already-parked checks. Only the task's immediate parent establishes parked state. `maintain` normalizes stray lowercase spelling.

`BACKLOG_DIR` in `scripts/lifecycle-constants.ts` is a sanctioned copy per `AGENTS.md` § *Consumer lists*.

**Planning acts in place; execution activates first.** `refine-idea` and `plan-task` work on parked folders without moving them. `implement-task` and `resume-task` offer activation and proceed only after user confirmation moves the folder to its container's parent. Activation is a plain `mv`, offered or manual; a terminal task may instead archive out. Resolving a Backlog slug never activates it.

`backlog-task` performs the inbound move through the guarded helper. A permitted manual move lands the same folder. Neither parking nor activation changes group inheritance (`./task-store.md` § *Shared group context*). Read the current chain after activation under `./task-layout.md` § *Reading a resolved folder*; no context rewrite or snapshot accompanies the move.

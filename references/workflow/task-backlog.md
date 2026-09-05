# Parking Unstarted Tasks in a Backlog (Optional)

How a task that is deliberately not started yet leaves the active listings — the discovery rules that exclude what sits under `Backlog/`, and fall back into it for a bare slug, stay in the sibling `task-layout.md`. **This file is the single source of truth for the backlog.**

Backlogging is **location-relative**: an unstarted task folder moves into a `Backlog/` subdirectory of whatever directory contains it — the same rule at every location:

```
<parent>/<slug>/  →  <parent>/Backlog/<slug>/      # canonically: .agents/tasks/Backlog/<slug>/
```

`Backlog/` is the counterpart of the `Archive/` in `./task-archiving.md`: finished tasks archive, deliberately parked ones backlog. **Location alone carries "parked"** — there is no `**Status:**` value for it. The move itself is the archive's move with `Backlog/` in place of `Archive/`; the whole-folder relocation, what it does to the folder's internal links, the container that may already exist at a non-canonical location, and the collision that matters are all stated in `./task-archiving.md` and hold here unchanged.

**The entry gate is *unstarted*, and `scripts/task-move.ts` applies it.** Which folder states it admits and which it refuses is that script's contract — `../scripts/task-move.md` owns it, read against the status vocabulary in `./task-lifecycle.md` § *Status values*. A task the gate refuses is not parked by hand either: a live one pauses through the `blocked` status, never by being moved, and a finished one archives (`./task-archiving.md`) — including one already misfiled inside a `Backlog/`, which that file's backlog exception takes **out** of the backlog rather than into a nested `Backlog/Archive/`.

Creating a task folder directly under a `Backlog/` is permitted, and means parked from birth — a fresh folder satisfies the gate by construction. That is deliberately unlike `Archive/`, whose creation destination is guarded (`./task-destinations.md` § *Destination paths*).

**Recognizing the directory is case-insensitive**, the same recognition rule the archive container follows. New backlogs are always *created* as `Backlog/`, but wherever a skill *recognizes* an existing one — excluding it from an active scan, falling back into it for a bare slug, or deciding a folder is already parked — the name is matched **case-insensitively**. `maintain`'s format sweep normalizes a stray lowercase `backlog/` container back to `Backlog/`.

**Planning acts in place; execution activates first.** `refine-idea` and `plan-task` operate on a backlogged task where it lies and move nothing — planning a parked task does not start it. `implement-task` and `resume-task` do not run on a parked task at all: they offer **activation**, and on the user's confirmation `mv` the folder back out to its container's parent, then proceed. Activation is the backlog's one exit into work, and it is always a plain `mv` — by hand, or through that offer; a misfiled *terminal* task leaves the other way, archived out per `./task-archiving.md`'s backlog exception. Naming a backlogged task's slug only lets discovery find it; it does not activate it.

The `backlog-task` skill performs the inbound move by running `scripts/task-move.ts`, which applies the entry gate its contract states, guards the destination, then relocates the whole folder — or you can `mv` it by hand; the result is identical.

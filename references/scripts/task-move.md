# `scripts/task-move.ts`

Performs one guarded task-folder move for the `archive-task` and `backlog-task` skills: the
location-relative relocation into a sibling `Archive/` or `Backlog/` container defined by
`../workflow/task-archiving.md` and `../workflow/task-backlog.md`. The archive
precondition — a terminal plan — stays with `task-archiving.md`; the park precondition, the
**unstarted entry gate**, is this script's own contract, stated here: a folder with no `plan.md`
is admitted provided it holds no `result.md` either (a result file exists only once execution
starts); a plan at `to-do` is admitted; `executing`, `blocked`, or `in-review` is refused (a live
task pauses through the `blocked` status, never by being moved); `done` or `skipped` is refused,
pointing at archiving; a status outside the vocabulary is refused as unplaceable. The status
values are read from `scripts/lifecycle-constants.ts`, the sanctioned copy of
`../workflow/task-lifecycle.md` § *Status values*.

```
node scripts/task-move.ts <slug-or-path> --to archive|backlog
```

**Contract.** A completed move writes one line to stdout, `moved <src> -> <dest>` with both paths
absolute, and exits 0. A refused move writes its one-line reason to stderr and exits 1, having
changed nothing on disk. A run that never got as far as deciding — bad usage, a slug matching no
folder or several, or an unexpected failure — writes one line to stderr and exits 2. The exit status
carries the outcome here rather than always being 0 as in the reporting scripts beside it, because a
caller must be able to tell a completed move from a refused one without parsing prose. Warnings — an
unreadable registry is the only one — also go to stderr and change no outcome.

A refused move that created the container removes it again, with `rmdirSync` rather than a recursive
remove: a container something else wrote into between the create and the failed rename is not this
run's to delete. One that already existed is the user's and is left alone.

**Resolution** is deliberately minimal, since the skills own interactive disambiguation: an argument
holding a path separator is taken verbatim (resolved against the process directory), while a bare slug
is looked up as `<root>/<slug>` and inside each root's archive and backlog containers, across the
canonical `<cwd>/.agents/tasks` plus every `taskRoots` entry of `~/.config/agents-kit/config.json`
(`../workflow/task-store.md`). `~` is expanded here because this script reads the registry
itself rather than being handed an already-resolved root. No match, or more than one, exits 2 asking
for a path rather than guessing at which task was meant.

Either form must name a **task folder**, identified by its contents against the recognition set in
`scripts/lifecycle-constants.ts` — the same set the health walk uses. Position never qualifies a
folder: a registered root's project area and a store root are both directories holding no role file,
and both would otherwise pass the unstarted gate, which tests only what a task folder does *not*
hold. A bare slug that matches no task folder exits 2; a path naming one is refused with 1.

The move is a single rename of the whole folder, which is what keeps its internal `./` links intact.
Inside the folder this reads the directory listing and the plan's status header — the entry gate tests
a `result.md` for existence alone — and nothing in it is ever written.

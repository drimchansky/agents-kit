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
folder or several, a store the lookup could not read in full, or an unexpected failure — writes one
line to stderr and exits 2. The exit status carries the outcome here rather than always being 0 as
in the reporting scripts beside it, because a caller must be able to tell a completed move from a
refused one without parsing prose. Warnings — an unparseable registry, ignored whole; a `taskRoots`
that is not an array, or an entry in it carrying no path, each ignored and named; and a registered
root skipped rather than searched — also go to stderr and change no outcome.

A refused move that created the container removes it again, with `rmdirSync` rather than a recursive
remove: a container something else wrote into between the create and the failed rename is not this
run's to delete. One that already existed is the user's and is left alone.

**Already-archived is asked of the whole path up to the store.** `../workflow/task-archiving.md` owns
that rule and this file adds nothing to it; what is this script's own is the bound it resolves the rule
against. On a bare slug that is the root the slug matched in — the innermost registered task root holding
the folder, or the canonical `.agents/tasks`. On a path argument nothing resolved, it is the innermost
registered root containing the folder, else its `.agents/tasks` store — read from a registry the path route
tolerates: one that is absent, unreadable, or malformed leaves it with no registered root and the
`.agents/tasks` fallback, and warns about nothing, since the bound needs neither completeness nor
uniqueness and a refusal's stderr stays the one line `../workflow/task-relocation.md` promises. A folder
under neither is in no store this script knows, so there is no bound to draw and the whole path stays
the reading — the one case that keeps the pre-bound behaviour, and the reason a directory named
`archive` above a *store* no longer reaches it. Being *parked* stays the immediate parent's question
alone, per `../workflow/task-backlog.md`.

**Resolution** is deliberately minimal, since the skills own interactive disambiguation: an argument
holding a path separator is taken verbatim (resolved against the process directory), while a bare slug
is looked up across the canonical `<cwd>/.agents/tasks` plus every `taskRoots` entry of
`~/.config/agents-kit/config.json` (`../workflow/task-store.md`). Those two kinds of root are read
to the depths `../workflow/task-layout.md` § *Discovery rules for skills* fixes, and deliberately so.
The canonical root is read one level deep —
`<root>/<slug>`, and the same inside each archive and backlog container sitting directly in it — which
is the lookup an unregistered project keeps exactly. A registered root is instead walked to unbounded
depth, exactly as `../workflow/task-store.md` § *The root registry* defines that walk. Registration is
what buys that depth.

A slug matches a folder name **exactly**, and identically in both kinds of root. Each arm compares the
slug against the names its own directory listing reports, rather than joining it onto a root and asking
the filesystem to resolve it — so a case-insensitive volume cannot fold `MyTask` onto `mytask` under the
canonical root while a case-sensitive one refuses the same slug under a registered one, which is the
divergence a join would reintroduce on the first macOS checkout. It also leaves `.`, `..`, and an empty
subject naming nothing, a listing reporting none of them: each exits 2 as any unmatched slug does,
rather than resolving to the store root or its parent and moving a whole store.

A lifecycle container is transparent to that walk — stepped through, never taken for a task folder
itself, whatever it happens to hold — so a task archived or parked inside any group is found at
whatever depth it sits; every match counts equally, and which container held one is the skills'
active-first report to make rather than this script's. `~` is expanded here because this script
reads the registry itself rather than being handed an already-resolved root, and each root is then
reduced to the directory it physically names, so two spellings of one root are searched once. A
root registered inside another registered one is searched on its own account rather than folded
into its container: the outer walk prunes, and a dotted or `node_modules` ancestor — or one holding
a role file, where the walk stops — would leave the inner root unreachable through it. Matches are
collected by physical path too, so one folder reachable through two registrations is one match,
whichever walk reached it. No match, or more than one after that collapse, exits 2 asking for a
path rather than guessing at which task was meant.

A registered root that is absent, or is not a directory, is skipped with one warning line on stderr and
changes no outcome — one registry describes several machines, and a root that is not there conceals
nothing. A directory *inside* a present registered root that cannot be listed is the opposite case: the
run exits 2 naming that path and the cause, before anything moves, because an unreadable group can hold
a second folder of the same slug and a search that could not finish must not choose among the matches it
did see. A registered root that is present and is a directory but cannot itself be listed conceals just
as much, so it is refused the same way rather than skipped like an absent one — and that exit 2 ends the
run against every other root with it, since a slug is answered only from a search that read each root in
full. **The canonical root and the registry file itself are read under that same rule**, because the
uniqueness a refusal protects spans both kinds of root rather than each on its own: an unreadable
canonical container, or a registry that exists and cannot be read, conceals exactly what an unreadable
registered root does — a second folder of the slug, or the whole set of roots that would have held one —
so each exits 2 naming the path and the cause. Only absence stays silent: no registry, no canonical
root, or either one not a directory is the ordinary state of an unregistered project and resolves from
whatever remains.

Either form must name a **task folder**, identified by its contents against the recognition set in
`scripts/lifecycle-constants.ts` — the same set the health walk uses. Position never qualifies a
folder: a registered root's project area and a store root are both directories holding no role file,
and both would otherwise pass the unstarted gate, which tests only what a task folder does *not*
hold. A bare slug that matches no task folder exits 2; a path naming one is refused with 1.

The move is a single rename of the whole folder, which is what keeps its internal `./` links intact.
Inside the folder this reads the directory listing and the plan's status header — the entry gate tests
a `result.md` for existence alone — and nothing in it is ever written.

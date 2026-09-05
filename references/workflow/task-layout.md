# Task Layout: Directories and Discovery

How task artifacts are arranged on disk, and how skills discover them. **This file is the single source of truth for layout.** Status values and transitions live in the sibling `task-lifecycle.md`; this file covers where files sit and how they're found. The contracts extracted from it live beside it — cite the one a task touches instead of loading them all: the one-home rule in `./one-home.md`, where a new task folder lands in `./task-destinations.md`, store-level artifacts and the root registry in `./task-store.md`, the goals file in `./task-goals.md`, the observations ledger in `./task-observations.md`, doc-task roles in `./doc-task-files.md`, multi-part sibling efforts in `./task-siblings.md`, archiving in `./task-archiving.md`, and the backlog in `./task-backlog.md`.

## One task, one flat folder

A task lives in a single flat folder, named for its slug. A task folder is defined by its **contents** — the role-named files below — not by its address: any folder holding them is a task folder, wherever it sits on disk. The **canonical root**, `<project-root>/.agents/tasks/`, is the default location: where a creating skill puts a new task folder when nothing higher in the precedence of `./task-destinations.md` applies, and the one root every discovery rule falls back to when this machine registers no others (§ *Discovery rules for skills*). `<project-root>` is the repository's **main checkout** root — the first entry of `git worktree list --porcelain` — never a linked worktree's, so a run working inside a task worktree (`./task-delivery-edges.md` § *The task worktree is the run's shared tree*) discovers and writes the one folder rather than the copy beside it. The folder name *is* the slug — the handoff token passed between `prepare-ticket` → `refine-idea` → `plan-task` → `implement-task`; the bare slug suffices for a folder in the canonical root or in any registered one, and the handoff token is the folder's path only when its root is neither. Inside sit the role-named files below, found by their fixed names (never by a path someone typed) — four core files plus two optional role files: an upstream `ticket.md` and a derived `observations.md`:

```
.agents/tasks/<slug>/        # the canonical default — but any parent directory works
├── ticket.md       # optional: the product-facing ask (upstream origin) — see ticket-format.md
├── CONTEXT.md      # static grounding context
├── goals.md        # acceptance criteria — what "done" means
├── plan.md         # the contract: scope, steps, verify criteria
├── observations.md # optional, derived: last observed state of the cited external references
└── result.md       # rewritable Current-state header + append-only execution log
```

One plan per folder. `CONTEXT.md` is capitalized; `ticket.md`, `goals.md`, `plan.md`, `observations.md`, and `result.md` are lowercase. A skill finds each file by its fixed role name (convention/glob), so moving, relocating, or archiving a folder never breaks a path. The in-folder `**Context:**` / `**Goals:**` / `**Plan:**` / `**Result:**` link-headers point at `./CONTEXT.md`, `./goals.md`, `./plan.md`, and `./result.md` — stable `./` links that survive folder moves; when the task has a `ticket.md`, the plan's optional `**Ticket:**` header points at `./ticket.md` the same way. Inside `result.md`, the first `##` section is the rewritable `## Current state` block (contract in the sibling `task-authorship.md`); everything beneath it is the append-only log.

**The recognition set — what makes a directory a task folder.** This is the single home for that test. Every walker applies it rather than carrying its own list: the discovery rules below, `init-config`'s root discovery, and the scripts. Those scripts read it from `scripts/lifecycle-constants.ts`, which carries the one machine-readable copy of the two lists below and the membership test over them, because a script cannot read this prose at run time — a sanctioned copy per `AGENTS.md` § *Consumer lists*, which names its importers; change either list here and change it there in the same edit. One copy rather than one per script is what keeps a folder from being a task to the health walk and not to the move that refuses to relocate anything else. A directory is a task folder when it holds at least one file that is either

- one of the **role names** — `CONTEXT.md`, `goals.md`, `plan.md`, `result.md`, `ticket.md`. `observations.md` is a derived companion and never establishes a folder on its own; or
- a **legacy suffix form** — any file ending `.plan.md`, `.result.md`, `.spec.md`, or `.ticket.md`. These predate the fixed role names and are what `maintain`'s format sweep renames. Nothing new writes them, but the sweep reaches only the kit's own canonical root, so any other root can hold them indefinitely and recognition has to accept them.

A young folder holding only a `ticket.md`, a `CONTEXT.md`, or a hand-authored `goals.md` qualifies — that is the normal state before planning. A directory holding none of these is not a task folder; say so rather than guessing.

**Two size budgets bound a folder.** A task folder holds at most **64 KB** of `.md`, counting every file but the ticket, role-named or legacy-suffixed — the upstream ask is as long as its author made it. Inside `result.md`, each `## Step` or `## Full Run` record holds at most **2 KB**: a record longer than that is narrative the next reconcile trims, not evidence. Both numbers have one machine-readable copy — `TASK_MAX_KB` and `RECORD_MAX_KB` in `scripts/lifecycle-constants.ts`, which `scripts/health-check.ts` measures against because a script cannot read this prose at run time; a sanctioned copy per `AGENTS.md` § *Consumer lists*, so change a budget here and change it there in the same edit. Crossing either is a sweep line `maintain` surfaces, never a refusal to write.

Within a task folder each fact lives in exactly one file — its home — and the sibling files cite it rather than restate it; that discipline, and the citation forms that reach across folders, live in the sibling `./one-home.md`.

## Discovery rules for skills

When resolving which task to act on, the **base resolution** is shared; skills differ only in what they do when the user named nothing.

What a **registered root** is, the optional machine registry at `~/.config/agents-kit/config.json` that names them, and the store-level files a root may carry all live in the sibling `./task-store.md`; with no registry the rules below fall back to the canonical root alone.

**Base resolution (every skill):**

- **Bare slug given** → resolve among the active folders of the canonical root and of every registered root (excluding `Archive/` and `Backlog/`, both matched case-insensitively — see `./task-archiving.md` and `./task-backlog.md`); if none matches, search each of those roots' `Archive/` and `Backlog/` before giving up, reporting which container held the match — a finished task may have been archived there, a deliberately unstarted one backlogged. A slug is **globally unique across registered roots**, so at most one folder matches; two that do are a layout error to surface, not to guess between. With no registry the search is the canonical root alone, and a task living outside it must be named by path. (Anything containing a path separator is a path; a bare kebab-case token is a slug.)
- **Explicit task folder path given** → use it verbatim, anywhere on disk; the folder's own name is the slug. Confirm it's a task folder by contents, per the **recognition set** in § *One task, one flat folder* — that section owns the file list, including the legacy suffix forms. There is no container fallback for a path — verbatim is verbatim.
- **A full plan path given** (`.../plan.md`) → use it directly and derive the task folder from its parent — the parent folder is the task folder, wherever it sits.

Once the folder is resolved, its files are found by their fixed role names — no stem-globbing, no path a user typed. Don't guess between ambiguous candidates — ask.

**Fallback when the user named nothing** — this is the only branch that varies, by what the skill does:

- **resolve-or-create** (`refine-idea`, `plan-task`, `prepare-ticket`, `decompose-task`) → derive a slug from the task description and create the task folder when no folder matches — **checking every registered root, active, archived, and backlogged, not only the destination's**. That check binds every member. A match is reported with the root that holds it rather than worked around — an active one means the task already exists; a backlogged one means it already exists, parked, and is worked on where it lies, since planning acts in place (`./task-backlog.md`); an archived-only one asks whether to un-archive it or start fresh. The **destination is unchanged** by the widened check — it resolves by the precedence in the sibling `./task-destinations.md`, never by which root held the match.
- **resolve-current-or-ask** (`implement-task`, `resume-task`, `reconcile-task`) → first check whether a task is already established **in this session** — a folder / `CONTEXT.md` resolved earlier this session (e.g. from a preceding `refine-idea`, `plan-task`, or `review-task`, or one the user named). If so, use it. Otherwise list the active folders (excluding `Archive/` and `Backlog/`) of the canonical root and every registered root, grouped by label, and ask which.
- **resolve-or-ask** (`review-task`, `archive-task`, `backlog-task`) → list the active folders (excluding `Archive/` and `Backlog/`) of the canonical root and every registered root, grouped by label, and ask which.

Archived and backlogged tasks are intentionally absent from the default active listing — that is the point of archiving and of parking, not a discovery bug. Likewise, tasks in a root that is neither canonical nor registered are absent from *every* listing — unlistable by design; reach them by path, or register their root.

### Reading a resolved folder

**This sub-section is the single home for the read order**, so a skill that opens a resolved folder cites it and states only what the order means for its own work.

1. **Run the report first.** `node <kit-root>/scripts/task-state.ts <task-dir>` — `<kit-root>` per `./task-store.md` § *Resolving `<kit-root>`*, its contract `../scripts/task-state.md`. It carries the plan's status, every step in plan order with its checkbox, `nextPendingStep` with its `**What:**` and `**Verify:**` lines, each checkpoint's `**Outcome:**`, whether a checked step's `([result](…))` anchor still resolves, goal coverage, and `result.md`'s `currentState` block. Its exit 1 is a folder holding no readable `plan.md`.
2. **Then `goals.md` in full, and the report's `currentState`.** The acceptance contract and the task's standing state — the two things no report can summarize for you, and the whole of what a run needs to orient.
3. **Then only the sections the step at hand needs.** `CONTEXT.md`'s header block for `**Domain:**`, and its prose sections when a step's work turns on them; `plan.md`'s `## Scope` for the partition, and a step's own body when that step is about to run; `result.md`'s `**Blocked:**` or `**In review:**` section when the plan's status owes one. Opening a whole file to reach one section is what this order exists to stop.
4. **No kit root, script, or `node`** → say the report could not be run, then read `plan.md`, `goals.md`, `CONTEXT.md`, and `result.md` in full, in that order, reconstructing by hand what it would have carried.

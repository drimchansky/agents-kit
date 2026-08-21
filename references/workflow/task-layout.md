# Task Layout: Directories and Discovery

How task artifacts are arranged on disk, and how skills discover them. **This file is the single source of truth for layout.** Status values and transitions live in the sibling `task-lifecycle.md`; this file covers where files sit and how they're found. The contracts extracted from it live beside it — cite the one a task touches instead of loading them all: the one-home rule in `./one-home.md`, store-level artifacts and the root registry in `./task-store.md`, the goals file in `./task-goals.md`, the diagram in `./task-diagram.md`, the observations ledger in `./task-observations.md`, doc-task roles in `./doc-task-files.md`, multi-part sibling efforts in `./task-siblings.md`, archiving in `./task-archiving.md`, and the backlog in `./task-backlog.md`.

## One task, one flat folder

A task lives in a single flat folder, named for its slug. A task folder is defined by its **contents** — the role-named files below — not by its address: any folder holding them is a task folder, wherever it sits on disk. The **canonical root**, `<project-root>/.agents/tasks/`, is the default location: where a creating skill puts a new task folder when nothing higher in the precedence of § *Destination paths* applies, and the one root every discovery rule falls back to when this machine registers no others (§ *Discovery rules for skills*). The folder name *is* the slug — the handoff token passed between `prepare-ticket` → `refine-idea` → `plan-task` → `implement-task`; the bare slug suffices for a folder in the canonical root or in any registered one, and the handoff token is the folder's path only when its root is neither. Inside sit the role-named files below, found by their fixed names (never by a path someone typed) — four core files plus three optional role files: an upstream `ticket.md`, a `diagram.md`, and a derived `observations.md`:

```
.agents/tasks/<slug>/        # the canonical default — but any parent directory works
├── ticket.md       # optional: the product-facing ask (upstream origin) — see ticket-format.md
├── CONTEXT.md      # static grounding context (origin marker + inputs)
├── goals.md        # acceptance criteria — what "done" means
├── plan.md         # the contract: scope, steps, verify criteria
├── diagram.md      # optional: the target-state shape the plan builds toward
├── observations.md # optional, derived: last observed state of the cited external references
└── result.md       # rewritable Current-state header + append-only execution log
```

One plan per folder. `CONTEXT.md` is capitalized; `ticket.md`, `goals.md`, `plan.md`, `diagram.md`, `observations.md`, and `result.md` are lowercase. A skill finds each file by its fixed role name (convention/glob), so moving, relocating, or archiving a folder never breaks a path. The in-folder `**Context:**` / `**Goals:**` / `**Plan:**` / `**Result:**` link-headers point at `./CONTEXT.md`, `./goals.md`, `./plan.md`, and `./result.md` — stable `./` links that survive folder moves; when the task has a `ticket.md` or a `diagram.md`, the plan's optional `**Ticket:**` and `**Diagram:**` headers point at `./ticket.md` and `./diagram.md` the same way. Inside `result.md`, the first `##` section is the rewritable `## Current state` block (contract in the sibling `task-authorship.md`); everything beneath it is the append-only log.

**The recognition set — what makes a directory a task folder.** This is the single home for that test. Every walker applies it rather than carrying its own list: the discovery rules below, `init-config`'s root discovery, and `scripts/health-check.ts`. A directory is a task folder when it holds at least one file that is either

- one of the **role names** — `CONTEXT.md`, `goals.md`, `plan.md`, `result.md`, `ticket.md`. `diagram.md` and `observations.md` are derived companions and never establish a folder on their own; or
- a **legacy suffix form** — any file ending `.plan.md`, `.result.md`, `.spec.md`, or `.ticket.md`. These predate the fixed role names and are what `maintain`'s format sweep renames. Nothing new writes them, but the sweep reaches only the kit's own canonical root, so any other root can hold them indefinitely and recognition has to accept them.

A young folder holding only a `ticket.md`, a `CONTEXT.md`, or a hand-authored `goals.md` qualifies — that is the normal state before planning. A directory holding none of these is not a task folder; say so rather than guessing.

Within a task folder each fact lives in exactly one file — its home — and the sibling files cite it rather than restate it; that discipline, and the citation forms that reach across folders, live in the sibling `./one-home.md`.

## Discovery rules for skills

When resolving which task to act on, the **base resolution** is shared; skills differ only in what they do when the user named nothing.

What a **registered root** is, the optional machine registry at `~/.config/agents-kit/config.json` that names them, and the store-level files a root may carry all live in the sibling `./task-store.md`; with no registry the rules below fall back to the canonical root alone.

**Base resolution (every skill):**

- **Bare slug given** → resolve among the active folders of the canonical root and of every registered root (excluding `Archive/` and `Backlog/`, both matched case-insensitively — see `./task-archiving.md` and `./task-backlog.md`); if none matches, search each of those roots' `Archive/` and `Backlog/` before giving up, reporting which container held the match — a finished task may have been archived there, a deliberately unstarted one backlogged. A slug is **globally unique across registered roots**, so at most one folder matches; two that do are a layout error to surface, not to guess between. With no registry the search is the canonical root alone, and a task living outside it must be named by path. (Anything containing a path separator is a path; a bare kebab-case token is a slug.)
- **Explicit task folder path given** → use it verbatim, anywhere on disk; the folder's own name is the slug. Confirm it's a task folder by contents, per the **recognition set** in § *One task, one flat folder* — that section owns the file list, including the legacy suffix forms. There is no container fallback for a path — verbatim is verbatim.
- **A full plan path given** (`.../plan.md`) → use it directly and derive the task folder from its parent — the parent folder is the task folder, wherever it sits.

Once the folder is resolved, its files are found by their fixed role names — no stem-globbing, no path a user typed. Don't guess between ambiguous candidates — ask.

**Destination paths (creating skills).** The creating skills — `resolve-or-create`'s four members, listed below — accept an optional destination path naming where the task folder should live. A new task folder's location resolves by this precedence. `decompose-task` is the one member that interposes a step of its own: its Phase 1 step 2 continues a source's sibling sequence ahead of step 2 below.

1. **An explicit destination path** the user gave.
2. **A matched project area in a registered root** — confirmed first when the project-local canonical root holds a task.
3. **The project-local canonical root**, `.agents/tasks/<slug>/`.

Interpret an explicit destination path by what's on disk:

- **Exists, and is a task folder** (by contents, per the **recognition set** in § *One task, one flat folder* — that section owns the file list, including the legacy suffix forms) → that *is* the task folder; use it verbatim. Its name is the slug — don't derive one.
- **Exists, and is a directory** holding no recognition-set file → it's the **parent**: create `<path>/<slug>/` inside it. Exception: if its basename already equals the derived slug, ask — silently creating `<slug>/<slug>/` is almost never intended.
- **Doesn't exist** → if its basename equals the derived slug, the user named the folder itself: create it verbatim. Otherwise ask whether to create `<path>/<slug>/` inside it (the usual intent) or use `<path>` as the folder itself.
- **Exists, but is a file** → refuse; a destination must be a directory.

Resolve the destination to an absolute path before using it. Avoid creating a live task directly under a directory named `Archive/` — location-relative archiving (`./task-archiving.md`) reads that as already archived; warn and confirm first. A destination under a directory named `Backlog/` needs no such guard — it creates the task parked from birth, which is permitted (`./task-backlog.md`).

**A matched project area.** A registered root (`./task-store.md`) matches when it holds an area directory whose basename equals the git root's basename case-insensitively — `Tasks/Treasury/` matches the `treasury` checkout — *and* that area **holds a task**. A directory **holds a task** when at least one folder inside it is a task folder by the **recognition set** in § *One task, one flat folder*, counting those under `Archive/` and `Backlog/`: an archive proves the project's tasks live there. That one test settles every occupancy question in this rule — no other reading of "empty" applies. **Git root** here means the main checkout's root — not the working directory, and not the nearest `.agents/` ancestor — so a linked worktree matches the area its main checkout does.

- **Confirm first only when the project-local canonical root holds a task** — the project demonstrably uses both roots, so which one is meant is a real question. Declining creates in the canonical root. When that root holds none, or is absent, an unambiguous match creates without asking.
- **When that confirmation can't be presented, create in the canonical root** and say which root and why: `No destination given and the area confirmation is unavailable; creating in <absolute canonical root>.` That is the default by rule — nothing here detects a run mode.
- **Creation in a matched area is never silent.** Print the **absolute** destination path — not the area name — what it matched on, and that a destination path overrides it: `Creating in <absolute destination> — matched area <area> to git root <basename>; pass a destination path to override.` A case-insensitive compare can land on the wrong project, and this line is what makes that visible before the folder is used.
- **No match falls through to the canonical root silently** — no registry, no area of that basename, or an area of that basename that holds no task creates `.agents/tasks/<slug>/`, with no confirmation and no notice.

**Fallback when the user named nothing** — this is the only branch that varies, by what the skill does:

- **resolve-or-create** (`refine-idea`, `plan-task`, `prepare-ticket`, `decompose-task`) → derive a slug from the task description and create the task folder when no folder matches — **checking every registered root, active, archived, and backlogged, not only the destination's**. That check binds every member. A match is reported with the root that holds it rather than worked around — an active one means the task already exists; a backlogged one means it already exists, parked, and is worked on where it lies, since planning acts in place (`./task-backlog.md`); an archived-only one asks whether to un-archive it or start fresh. The **destination is unchanged** by the widened check — it resolves by the precedence in *Destination paths* above, never by which root held the match.
- **resolve-current-or-ask** (`implement-task`, `resume-task`, `reconcile-task`) → first check whether a task is already established **in this session** — a folder / `CONTEXT.md` resolved earlier this session (e.g. from a preceding `refine-idea`, `plan-task`, or `review-task`, or one the user named). If so, use it. Otherwise list the active folders (excluding `Archive/` and `Backlog/`) of the canonical root and every registered root, grouped by label, and ask which.
- **resolve-or-ask** (`review-task`, `challenge-task`, `archive-task`, `backlog-task`) → list the active folders (excluding `Archive/` and `Backlog/`) of the canonical root and every registered root, grouped by label, and ask which.
- **resolve-current-or-refuse** (`review-pr-triage-verify-reconcile`) → check whether a task is already established **in this session**, exactly as `resolve-current-or-ask` does. If so, use it. Otherwise **refuse**: say the task has to be named, and stop.

Archived and backlogged tasks are intentionally absent from the default active listing — that is the point of archiving and of parking, not a discovery bug. Likewise, tasks in a root that is neither canonical nor registered are absent from *every* listing — unlistable by design; reach them by path, or register their root.

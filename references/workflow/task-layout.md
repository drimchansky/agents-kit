# Task Layout: Directories and Discovery

Placement: `./task-destinations.md`; registry and group context: `./task-store.md`; lifecycle: `./task-lifecycle.md`. File contracts: `./one-home.md`, `./task-goals.md`, `./task-observations.md`, and `./doc-task-files.md`. Siblings: `./task-siblings.md`; filing: `./task-archiving.md` and `./task-backlog.md`.

## One task, one flat folder

A task occupies one flat folder named for its slug, with one plan. Recognition depends on contents, wherever the folder sits.

The canonical root is `<project-root>/.agents/tasks/`. `<project-root>` is the main checkout, the first entry of `git worktree list --porcelain`, even when execution uses a linked worktree (`./task-delivery-edges.md`). Creation follows `./task-destinations.md`; without registered roots, discovery uses the canonical root alone.

The handoff token between skills is the bare slug wherever § *Discovery rules for skills* resolves it; otherwise use the folder path.

```
.agents/tasks/<slug>/
├── ticket.md       # optional upstream ask
├── CONTEXT.md      # grounding
├── goals.md        # acceptance
├── plan.md         # execution contract
├── observations.md # optional derived reference state
└── result.md       # Current state plus execution history
```

Use these exact role names and casing. Resolve files by role, not a typed stem. Link headers use `./CONTEXT.md`, `./goals.md`, `./plan.md`, and `./result.md`; the optional Ticket header uses `./ticket.md`. The result's first `##` section is Current state (`./task-authorship.md`); the log below its closing separator is append-only.

**Recognition set.** A folder qualifies when it holds at least one file named `CONTEXT.md`, `goals.md`, `plan.md`, `result.md`, or `ticket.md`, or a legacy `*.plan.md`, `*.result.md`, `*.spec.md`, or `*.ticket.md`. `observations.md` alone does not qualify. A ticket-only or context-only folder qualifies; a folder holding none of the set does not. Report that absence rather than guessing. New work uses role names; `maintain` renames legacy forms.

`scripts/lifecycle-constants.ts` holds the recognition lists and membership test, a sanctioned copy per `AGENTS.md` § *Consumer lists*.

**Size budgets.** A folder holds at most **64 KB** of Markdown, excluding the ticket but including legacy files. Each `## Step` or `## Full Run` result record holds at most **2 KB**. Oversize records are narrative for reconciliation to trim; `maintain` surfaces both budgets as findings, not write refusals.

`TASK_MAX_KB` and `RECORD_MAX_KB` in `scripts/lifecycle-constants.ts` are a sanctioned copy per `AGENTS.md` § *Consumer lists*.

Place each fact according to `./one-home.md` and cite its section from siblings.

## Discovery rules for skills

Read optional roots from `./task-store.md` § *The root registry*. With none, search only the canonical root.

**Base resolution, every skill:**

- **Bare slug**: search active folders across the canonical root and every registered root, excluding Archive and Backlog case-insensitively. The canonical root is one level deep; a registered root is recursive through groups (`./task-store.md`). A canonical root explicitly registered takes the recursive rule.
- If no active match exists, search lifecycle containers before giving up. Search the canonical root's own Archive/Backlog one level deep, and every container the registered-root walk reaches. Report which container held the match (`./task-archiving.md`, `./task-backlog.md`).
- Slugs are globally unique across registered roots. Multiple matches are a layout error: surface them, never choose one.
- **Explicit folder path**: use it verbatim anywhere on disk; confirm recognition by contents. The basename is the slug. Do not apply container fallback to a path.
- **Full `plan.md` path**: use it directly and take its parent as the task folder.

A token containing a path separator is a path; a bare kebab-case token is a slug. Find sibling files by fixed role names after resolution. Ask about ambiguous candidates.

**When no task was named:**

- **resolve-or-create** (`refine-idea`, `plan-task`, `prepare-ticket`, `decompose-task`): derive a slug and check active, archived, and backlogged folders across every registered root and the canonical root before creating. A match is reported with its root, never worked around. Active means existing; Backlog means existing and planned in place (`./task-backlog.md`); archived-only asks whether to un-archive or start fresh. Creation destination still follows `./task-destinations.md`.
- **resolve-current-or-ask** (`implement-task`, `resume-task`, `reconcile-task`): use the task already established in this session. Otherwise list active tasks across all roots, grouped by label, and ask.
- **resolve-or-ask** (`review-task`, `archive-task`, `backlog-task`): list those active tasks and ask.

Archived and backlogged tasks are excluded from default listings. Tasks outside canonical/registered roots require paths. So do tasks under groups in an unregistered canonical root: its shallow discovery cannot resolve their slugs or list them. Register the root to enable recursive discovery.

### Reading a resolved folder

1. Run `node <kit-root>/scripts/task-state.ts <task-dir>` first. Resolve `<kit-root>` through `./task-store.md` § *Resolving `<kit-root>`*; contract: `../scripts/task-state.md`. The report carries status, ordered checkboxes, next pending What/Verify, checkpoint outcomes, result-anchor resolution, goal coverage, and Current state. Exit 1 means no readable plan.
2. Read `goals.md` in full and the report's `currentState`.
3. Read applicable `GROUP_CONTEXT.md` files root-to-task under `./task-store.md` § *Shared group context*, before task-local grounding. No registered containing root or no files means no inherited grounding.
4. Read only needed sections: context's Domain header and relevant prose; plan Scope and the current step; result Blocked/In review when status requires them. Do not open whole files merely to reach these sections.
5. If kit root, script, or Node is unavailable, report that and read plan, goals, context, and result in full, in that order. Reconstruct the report manually. Still load group grounding from disk before the task's context.

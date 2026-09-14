---
name: archive-task
description: Use when asked to archive a finished task — move a completed (`done`) or abandoned (`skipped`) task folder into its parent's `Archive/` (canonically `.agents/tasks/Archive/`) to keep the active list short.
argument-hint: '[task folder slug or path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

Archive a whole finished task folder through `scripts/task-move.ts`. This skill changes no task content or status and mutates no Git state. No staging, commits, checkout, stash, or `git mv`.

Load no domain pack; filing is domain-independent. Read `./references/workflow/task-archiving.md`, `./references/workflow/task-relocation.md`, `./references/workflow/task-layout.md`, and `./references/workflow/status-transitions.md` at run time. Use the registered terminal set, not a copied status list.

## When to Use

**Use when** removing finished or abandoned tasks from their parent's active list.

**Skip when** work is live; finish or abandon it through its lifecycle first. Un-archiving is the user's own move; this skill is one-way. With no canonical task root and no named path, report nothing to archive.

## Process

### 1. Resolve the target task folder

Apply `./references/workflow/task-relocation.md` § *1. Resolve the target task folder*: resolve an exact absolute SRC and refuse task parents. This direction requires a top-level `plan.md`.

- Already archived under `./references/workflow/task-archiving.md`'s whole-path-to-store rule: report it and stop. Recognize the container case-insensitively, including above a grouping directory.
- With nothing named, list active folders with their plan Status and ask which; do not guess.

### 2. Run the move

```bash
node <kit-root>/scripts/task-move.ts <SRC> --to archive
```

Pass the exact absolute SRC resolved in Step 1, never a bare slug or a path rebuilt from cwd. Apply `./references/workflow/task-relocation.md` § *2. Run the move* and `./references/scripts/task-move.md` for root resolution, guards, and output.

The helper permits only terminal plans, refusing live, unknown, or missing plans. Never change status to pass the gate or bypass a refusal. A terminal task directly in Backlog archives out to the grandparent's Archive, not Backlog/Archive (`./references/workflow/task-archiving.md`).

Report non-zero output verbatim and stop, without moving anything manually or merging a collision.

### 3. Report

Apply `./references/workflow/task-relocation.md` § *3. Report*, using the helper's printed destination. State when the task left Backlog. Explain that un-archiving moves it out from under the applicable Archive container; naming its slug merely discovers it there. Make no post-move content or record update.

## Output Template

On success:

```markdown
# archive-task — <slug>

Archived `<slug>` → `<dest>` (plan was `<observed terminal status>`).
Internal `./` links preserved; folder excluded from active listings.
Working-tree only; review with `git status` and commit if inside a Git repository.
```

On refusal:

```markdown
# archive-task — <slug>

Not archived: <script's line verbatim>
<Applicable next action; finish or explicitly abandon live work before retrying.>
```

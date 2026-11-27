---
name: migrate-tasks
description: Preview and apply the one-time task and group store migration. Includes archived and backlogged tasks and restores the active tasks' current records on confirmation.
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`.
2. Use `./references/scripts/task-migrate.md` for the conversion and its guarded apply. Preserve plan status, checked steps, accepted scope, and the work products.

**Model invocation:** requires a confirmed proposal (`./references/workflow/skill-conventions.md` § *The invocation gate*).

## Propose the sweep

Resolve the canonical task root of the kit and the registered task roots under `./references/workflow/task-store.md` § *The root registry (optional)*. Use supplied replacement roots for a rehearsal on copies. Check existence, deduplicate by physical directory, and keep each label.

Name the full registered-root sweep, the canonical root, and every absolute target. List each missing registered root as skipped in this proposal and the final report. Describe the group conversions, active record updates and the decisions to preserve in backlogged tasks. A model-invoked run waits for confirmation here, before walking the roots. For a live cutover, obtain the user's confirmation of the targets and a restore point for each before applying changes.

## Preview

1. Walk each existing root under the root registry's prune and task-recognition rules. Include Archive and Backlog. Collect group directories as well as tasks, visiting each physical directory once.
2. Identify current-format tasks under `./references/workflow/task-layout.md` § *Result format before writing*. When a current record required by a checked step or plan status is missing or damaged, exclude that folder from conversion and follow-up edits. Report the diagnostic for lifecycle repair under `./references/workflow/task-progress.md`. Run `node <kit-root>/scripts/task-migrate.ts --root <store-root> <folder>` for each remaining group and task (`<kit-root>`: `./references/workflow/task-store.md` § *Resolving `<kit-root>`*). When the helper is unavailable, stop the sweep before any write and report that the migration helper is unavailable. Use its selected physical root, including the replacement root on a rehearsal. Retain the root, folder, token, changed files, removed files, skipped legacy roles, missing snapshots, unresolved commit choices, and links for manual review. A preview writes nothing. Exclude a refused folder from all migration writes and name its cause.
3. Before any apply, inventory live decisions in every proposed active task and the settled decisions conversion would displace in every proposed backlogged task. Capture the selected rule, its recorded reason, its source section and its live home from the original files. For active tasks, also capture outstanding findings, pending decisions, external checks and blockers with their owners and next actions. Keep a private comparison copy of each live section a follow-up edit will replace. Use an existing restore copy when it holds the previewed bytes. Leave task history closed.
4. Group the proposed changes by root and folder. Name the affected files, proposed follow-up edits, their evidence and any exceptions. Name each removed file as a deletion. Hold any preview that would create a result for a backlogged task without one and report the inconsistency. Keep the preview tokens with the proposal. Ask for confirmation of this set before its first write. A user may accept several named folders in one reply.

## Apply the confirmed set

Apply groups before their tasks so a group can still use the original task records to date its Decisions lines. For each confirmed folder run `node <kit-root>/scripts/task-migrate.ts --root <store-root> --apply <preview-token> <folder>` with the root used for its preview. On changed input, make a fresh preview and obtain confirmation of the revised change set before writing it. Include skipped folders in the report. An archived task receives only the helper's conversion.

For each confirmed active task with a successful helper apply and an existing result, rebuild the following records from the captured evidence and the converted live files under `./references/workflow/task-result.md`:

- Refresh Current state with a dated status gloss, the current delivery identifiers, and the next action. Retain each independent wait or verification constraint that determines the next action. Check the current group grounding for later evidence that changes an earlier task wait. Preserve the ticket state and the branch, PR and revision identifiers needed to resume.
- Put every unresolved finding, pending decision and incomplete check in Open findings with its evidence, owner and next action. Preserve the issue or thread ID, triage severity, and any withdrawn part of a finding. Keep an unresolved question and its options at its live home. Name an unrecorded owner or missing evidence explicitly. Preserve items with conflicting evidence as open.
- At blocked, keep one Blocked section with the current cause, prior attempts, required unblock evidence, and last passing health coverage. At in-review, keep one In review section naming every pending verification and verifier. Carry independently pending checks outside that pause in Open findings. Check each pending condition against its goal, step, target, and environment. A missing goal verdict cannot expand the target or create a new verification requirement. Remove superseded waits only after accounting for their still-live items.
- Keep one latest recorded verdict per goal in Acceptance, with its evidence, caveats, deferrals, or awaited confirmation. Preserve shared health and release evidence. Leave a missing verdict unverified. Do not gate work or change a plan marker based on migration.

After a successful helper apply, restore each inventoried decision at its live home in the active or backlogged task, including tasks without a result. Where only a link label survives, replace it with the settled rule and its recorded reason. Preserve checked What and Verify text and place their rules at the appropriate live home. Keep backlogged tasks in place with their original plan status.

For active tasks, replace a stale prose reference to a removed result section with its live evidence, or remove the obsolete parenthetical when the passage already states the rule and source. Repair a live reference to the former group log with the current rule or its live group home when established. List every remaining mention by file and line. Live files cite no history entry.

If a migration specification itself quotes the former snapshot path, distinguish the specification from a note that needs restoration. Name the same parent directory and child separately in prose. Build the same search needle from its components in an executable criterion and test it on a planted match. Preview each affected file and section, preserve its original bytes in history, and keep checked step text intact.

Apply corrections in an unstarted task's existing live files without creating a result. Immediately before each follow-up edit, compare the file with the bytes reviewed after helper apply. Hold a changed file for a new preview. Append the complete old bytes of each displaced section to task history with its source file and migration date before replacing it. Append without reading earlier history. Protect the original pre-conversion wording as well when the helper normalized that section. Keep source snapshots and recoverable text intact.

## Verify and report

Check each inventoried decision against its live rule and reason in the active or backlogged task. Verify each backlogged task retains its plan status and that result presence matches the original. For active tasks, also compare findings, waits, checks and blockers with the pre-apply inventory. Check every finished What and Verify against the original wording, allowing only the mechanical link updates. Report any unmatched item and owner. Verify the resulting shape, checked links, group log conversion and highest question IDs under `./references/scripts/task-migrate.md`. Run `node <kit-root>/scripts/task-state.ts <folder>` on each converted folder (`./references/scripts/task-state.md`). Run `node <kit-root>/scripts/health-check.ts <root>` on each converted root (`./references/scripts/health-check.md`). Resolve `<kit-root>` under `./references/workflow/task-store.md` § *Resolving `<kit-root>`*. Compare their link findings with the original results. When either helper is unavailable, report its verification as not run.

Report converted and unchanged folders per root, skipped missing roots and legacy folders, remaining group-log mentions, unavailable snapshots, unresolved choices, and verification gaps. List the file and line for each link needing manual review. Preserve the deliverable's bytes throughout follow-up edits. For the live cutover, record the delivery merge commit for stores migrated later.

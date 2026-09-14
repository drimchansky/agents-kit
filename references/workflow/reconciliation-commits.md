# Reconciliation: Commit Scan and Watermark

Run `node <kit-root>/scripts/commit-scan.ts <task-dir>` to report commits as JSON without writing. Resolve the kit through `./task-store.md` § *Resolving `<kit-root>`*; CLI/report contract: `../scripts/commit-scan.md`.

Commits, including reverts, nominate pending steps; they never verify work. Check boxes only through `./reconciliation.md` § *Strengthen only on verified evidence*. The scan never unchecks steps; vanished work takes the unbacked-step repair.

## The watermark

The watermark is one entry on the result's `## Current state` `**Pointers:**` line, written `SHA <sha> (recorded YYYY-MM-DD)`; the line's other identifiers stay beside it (`./task-authorship.md`). The SHA records the last-observed tip of `<ref>` and the scan floor. Use the task's recorded branch as `<ref>` (`./task-delivery.md` § *Branch and worktree creation*); branch fallback follows the script report.

`scripts/commit-scan.ts` carries this entry shape, a sanctioned copy per `AGENTS.md` § *Consumer lists*. Rewording the shape requires changing its pattern in the same edit.

## The scan

Resolve the repository holding a project-local task folder, or the session repository for a task-store/registered-root folder (`./task-store.md`). Never infer the root from the shell directory. No repository resolved: omit the section.

At least one plan-named path must exist on disk inside that root. Otherwise omit: no scan, seed, or re-seed. These omissions are `no-checkout`, never an empty scanned range.

For externally stored tasks, the script's `no-checkout` means **unscanned**; name the repository the rule resolved (`../scripts/commit-scan.md`). Report unavailable or failed scans rather than implying an empty range.

## Degenerate cases

- **`no-watermark`**: report the missing baseline. The reconcile phase seeds at `<ref>`'s tip, recording `baseline seeded — no commits reconstructed`, only once a result entry exists. A `to-do` plan is owed no result, so its seed waits (`./reconciliation.md` § *The record*).
- **`orphaned`**: report that the watermark left `<ref>`'s history. The reconcile phase re-seeds `**Pointers:**` at `<ref>`'s tip and records the re-seed; never scan the bogus range.

## The record — reconcile phase only

- Write dated commit lines on Reconciliation's `**Commits:**` (`./reconciliation.md` § *The record*). Apply the 20-commit cap explicitly with `showing 20 of M since <sha>`; never silently truncate.
- Without a Reconciliation entry, never seed, re-seed, or advance. This covers no actionable findings (`./reconciliation.md` § *Sequence and output*) and no result holding an entry.
- With the record, advance Pointers to the scanned tip and re-date during `./reconciliation.md` § *Current state refresh*.
- Checked boxes link this run's entry: `([result](./result.md#reconciliation--YYYY-MM-DD))`; same-day second entries use `-2`.

## Read/write split

Briefs scan read-only; they never write watermarks or rerun candidate Verify criteria. Surface non-rerunnable candidates with boxes open under `./reconciliation.md` § *Strengthen only on verified evidence*.

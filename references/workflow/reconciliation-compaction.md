# Reconciliation Compaction

Run `node <kit-root>/scripts/task-state.ts --compaction-plan <task-dir>` to inspect whether compaction is due, its history precondition, and keep/removable sections. This reports JSON without writing. Resolve `<kit-root>` through `./task-store.md` § *Resolving `<kit-root>`*; CLI and report: `../scripts/task-state.md`.

## Compaction (size trigger)

At a `reconcile-task` run's end, propose compaction when the report says `due`. Apply only on user confirmation; never auto-compact. Docs → reality never compacts. This confirmation is separate from finding-based consent (`./reconciliation.md` § *Consent model: findings apply, the record carries them*).

Refuse unless `precondition.state` is `ok` and `uncommitted` is false; removed text must remain recoverable from version history. On `uncommitted`, have the user commit first; a later run re-tests before proposing.

The trigger is **20 KB**. `RESULT_MAX_KB` in `scripts/lifecycle-constants.ts` is a sanctioned copy per `references/maintenance/repository.md` § *Consumer lists*. Change both in the same edit. `scripts/task-state.ts` and `scripts/health-check.ts` consume it; `maintain` reads this section and passes `--result-max-kb`.

## What may be collapsed

Treat `removable` as eligibility, not permission. Collapse only superseded narrative, such as sections a later `## Reconciliation` entry supersedes, verbose transcripts, or overtaken step detail. Keep all other sections, and never touch a `keep` entry.

Select approved sections by their reported allocated `anchor`, not heading text, which may repeat.

Keep each selected section's opening and every live nested ATX heading verbatim, in their original global order. Replace only narrative with one plain note: "Compacted YYYY-MM-DD; full text in git history (pre-compaction state)."

Keep protected sections byte-for-byte, including legacy `## Compacted` stubs. Add no heading, anchor syntax, or report field. Preserve all checked links and allocated section anchors; verify the same active pause remains protected.

If retained headings or protected content keep the result oversized, report that remaining size without removing evidence.

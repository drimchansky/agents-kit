# Reconciliation Compaction

Run `node <kit-root>/scripts/task-state.ts --compaction-plan <task-dir>` to inspect whether compaction is due and which sections are keep or removable. This reports JSON without writing. Resolve `<kit-root>` through `./task-store.md` § *Resolving `<kit-root>`*; CLI and report: `../scripts/task-state.md`.

## Compaction (size trigger)

At a `reconcile-task` run's end, propose compaction when the report says `due`. The proposal must explain that confirming writes a full copy of `result.md` under `~/.local/state/agents-kit/compaction/`, kept after the run. State that the notes can recover removed text only on this machine. Apply only on user confirmation; never auto-compact. Docs → reality never compacts. This confirmation is separate from finding-based consent (`./reconciliation.md` § *Consent model: findings apply, the record carries them*).

Retain the proposed plan's `resultSha256` and `planStatus` with the prepared replacement. After confirmation, run `node <kit-root>/scripts/task-state.ts --compaction-snapshot <task-dir>` before changing `result.md`. It copies the full file byte for byte under `~/.local/state/agents-kit/compaction/` and reports the copy's `path`. Change nothing unless it exits 0; on any other exit, report its stderr and leave `result.md` unchanged.

Before any change, require the snapshot's `sha256` to equal the confirmed plan's `resultSha256`. Re-run `--compaction-plan`; require its `resultSha256` and `planStatus` to match the confirmed plan. On a mismatch, leave `result.md` unchanged and regenerate the plan and replacement from the current files. Propose again if the approved sections' classification or allocated anchors changed. Repeat the snapshot and input checks against the regenerated plan before editing.

Immediately before writing the compacted `result.md`, require byte equality and confirm the live file and snapshot are not the same file. For example, run `[ ! <task-dir>/result.md -ef <path> ] && cmp -s <task-dir>/result.md <path>`. If either check fails, leave `result.md` unchanged and restart the regeneration and input checks above. Every result follows this path, whatever its Git state.

The copy is kit run state (`./task-store.md` § *The root registry*), not a scratch artifact. Keep it after the run, because every collapsed or trimmed section's note names it. Recovering removed text from a note works only on the machine that wrote the copy. `./reconciliation.md` § *Docs, not the world* permits this write.

The trigger is **20 KB**. `RESULT_MAX_KB` in `scripts/lifecycle-constants.ts` is a sanctioned copy per `references/maintenance/repository.md` § *Consumer lists*. Change both in the same edit. `scripts/task-state.ts` and `scripts/health-check.ts` consume it; `maintain` reads this section and passes `--result-max-kb`.

## What may be collapsed

Treat `removable` as eligibility, not permission. Collapse only superseded narrative, such as sections a later `## Reconciliation` entry supersedes, verbose transcripts, or overtaken step detail. Keep all other sections, and never touch a `keep` entry.

Select approved sections by their reported allocated `anchor`, not heading text, which may repeat. Leave a section whose `anchor` is null untouched.

Keep each selected section's opening and every live nested ATX heading verbatim, in their original global order. Replace only narrative with one plain note: "Compacted YYYY-MM-DD; full text in `<path>`." Each section a confirmed compaction trims keeps its remaining content and gains the same note. Write the snapshot's reported `path` with its home-directory prefix replaced by `~`, as in `~/.local/state/agents-kit/compaction/<file>`.

`reconcile-task` trims record narrative toward the record and folder budgets (`./task-layout.md` § *One task, one flat folder*) only on a confirmed compaction that is due. Trimming on that confirmation follows the snapshot, input checks, and mismatch handling in § *Compaction (size trigger)* before any change. It trims only sections the compaction plan lists as `removable`, narrative never evidence. It reports an oversized `keep` entry's size as accepted instead of trimming it.

Keep protected sections byte-for-byte, including legacy `## Compacted` stubs. A legacy stub lists each collapsed heading as a `- ` tombstone bullet, and step links to those bullets remain valid anchors. Add no heading, anchor syntax, or report field. Preserve all checked links and allocated section anchors; verify the same active pause remains protected.

If retained headings or protected content keep the result oversized, report that remaining size without removing evidence.

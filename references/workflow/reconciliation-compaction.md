# Reconciliation Compaction

Compacting a `result.md` that outgrew the size trigger — split out of `./reconciliation.md`, which keeps no part of it. This file owns the consent a compaction needs and the judgment of what may collapse. Read it when a run reaches the trigger and the proposal is being built.

**The mechanics are a script.** `node <kit-root>/scripts/task-state.ts --compaction-plan <task-dir>` reports whether the result is `due`, whether the version-history precondition holds, and which sections a compaction must keep against which it may collapse — as JSON, writing nothing. `<kit-root>` resolves per `./task-store.md` § *Resolving `<kit-root>`*; `<kit-root>/SCRIPTS.md` § *`scripts/task-state.ts`* owns its CLI form, stdout contract, and exit statuses.

## Compaction (size trigger)

At the end of a `reconcile-task` run, if the report says `due`, add a judgment item to the batched round proposing compaction (`./reconciliation.md` § *Consent model: obvious fixes only, ask for the rest*) — never auto-apply it, and docs → reality never compacts. **Anything but `precondition: ok` refuses the compaction outright**: this is the one sanctioned removal of prior log sections, safe only because the removed text stays recoverable from version history, and that field is the whole of what says it does. A report saying `uncommitted` refuses just the same: the working text is in no commit yet, so consenting would collapse sections recoverable nowhere. Have the user commit first; a later run re-tests and may propose then.

The trigger is **20 KB**. This number has one machine-readable copy — `RESULT_MAX_KB` in `scripts/lifecycle-constants.ts`, which the mode measures against and `scripts/health-check.ts` applies to a bare run, since a script cannot read this prose at run time. It is a sanctioned copy per `AGENTS.md` § *Consumer lists*: change the trigger here and change it there in the same edit. (`maintain` needs no such copy — it reads this section at run time and passes the value as `--result-max-kb`.)

## What may be collapsed

The report's `removable` list is **eligibility, never a decision**: collapse only **superseded narrative** — sections a later `## Reconciliation` entry supersedes, verbose transcripts, step detail long overtaken by events. Everything else it lists stays where it is, and nothing on its `keep` list is ever touched.

Each collapsed section becomes one line under a single `## Compacted — YYYY-MM-DD` stub, the bullet carrying that section's reported `heading` and nothing else, and the stub closing with "full text in git history (pre-compaction state)." as its own line after the bullets, never appended to one.

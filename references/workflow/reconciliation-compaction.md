# Reconciliation Compaction

Compacting a `result.md` that outgrew the size trigger — split out of `./reconciliation.md`, which keeps no part of it. This file owns the whole of compaction: the trigger value, the consent rule, and the procedure. Read it when a run reaches the trigger and the proposal is being built.

## Compaction (size trigger)

At the end of a `reconcile-task` run, if `result.md` exceeds **20 KB**, add a judgment item to the batched round proposing compaction (`./reconciliation.md` § *Consent model: obvious fixes only, ask for the rest*) — never auto-apply it, and docs → reality never compacts. Compaction is the one sanctioned removal of prior log sections, safe only because the removed text stays recoverable.

This number has one machine-readable copy — `RESULT_MAX_KB` in `scripts/lifecycle-constants.ts`, the default `scripts/health-check.ts` applies to a bare run, since a script cannot read this prose at run time. It is a sanctioned copy per `AGENTS.md` § *Consumer lists*: change the trigger here and change it there in the same edit. (`maintain` needs no such copy — it reads this section at run time and passes the value as `--result-max-kb`.)

## The procedure

- **Precondition:** the result file **resolves at `HEAD`** — `git -C <task-dir> cat-file -e HEAD:./<result-file>` succeeds — refuse otherwise, since compaction deletes text recoverable only via version history. Repo membership is not enough: an **ignored** task folder passes it while holding nothing in history. Being **tracked** is not enough either: a staged-but-never-committed file has no commit holding its text, and index membership is not history. Only a `HEAD`-resolvable version makes the tombstone's "full text in git history" line true. Note in the proposal if the file has uncommitted changes: the user should commit before consenting.
- **Collapse only superseded narrative** — sections a later `## Reconciliation` entry supersedes, verbose transcripts, step detail long overtaken by events. Always keep: the link header, `## Current state`, `## Decision log`, every `## Acceptance`, every `## Health boundary`, the latest `## Reconciliation`, and any active pause section.
- Each removed section becomes one line under a single `## Compacted — YYYY-MM-DD` stub naming the collapsed anchors. Each bullet is the removed heading's text and nothing else — `- Step 1 — Old title` — because `scripts/health-check.ts` resolves a step's evidence link by slugifying the whole bullet line, so any word added to one stops the tombstone answering the anchor it names. The stub then closes with "full text in git history (pre-compaction state)." as its own line after the bullets, never appended to one.

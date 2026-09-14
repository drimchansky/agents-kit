# Reconciliation: The Reference Sweep

Sweep under `./reconciliation.md` § *The reference sweep*, following its § *Sequence and output*.

## Ledger

Read `observations.md` first (`./task-observations.md`): comparison baseline and failed-fetch carry-forward. Rewrite wholesale afterward, including otherwise-empty reconciliations: one dated line per swept URL, including `info`, with its strongest occurrence tag.

## Scope

Run `node <kit-root>/scripts/sweep-scope.ts <task-dir>` before fetching. Resolve the kit through `./task-store.md` § *Resolving `<kit-root>`*; report contract: `../scripts/sweep-scope.md`.

Scope is every fetchable citation on an actionable surface, deduplicated by URL; each entry lists every citing occurrence and the ledger's last tag as its baseline. Sweep exactly what the script returns. Let the script select the active pause from plan status. Two swept surfaces are never written into: the deliverable's `**Published:**` line and the active pause section (`./reconciliation.md` § *Never-annotated surfaces*).

Without kit root, Node, or the script, report skipped scope enumeration; never hand-scope. Report enumeration failures with their errors rather than as empty scope.

An empty citations list means no fetch and no ledger rewrite; delete only a stale ledger.

## Fetching

Fetch read-only, preferring structured integrations over HTML scraping. Never comment, update, or post to cited systems. Capture title, status, and last-updated against the previous ledger line; new URLs use each occurrence's description.

Compare every occurrence's description; route by its `surface`. One URL is one fetch and one ledger line, but one finding per citing occurrence. Sweeps never replace claim-level verification.

## Tags

- `info`: clean fetch with no material change. A fetch that establishes nothing also tags `info`, unless a prior `warn`/`block` line exists to carry forward. Mark auth walls `auth required — re-check manually`; other failures `unreachable — <error>, re-check manually`. Retain the carried `warn`/`block` line's tag and observation, appending the dated failed attempt.
- `warn`: material change, including status changes, answered questions, substantive edits, or PR merge/closure.
- `block`: broken, moved, or deleted. Re-observed 404 remains block every sweep, never info. Already-correct annotations remain no-ops (`./reconciliation.md` § *Annotation formats*).

## Output and routing

Fetch failures are findings: capture, tag, and continue. Print `## References` in the report; empty enumerated scope prints `No external references in sweep scope.` Unavailable enumeration is skipped, not empty.

Surface auth-walled/unreachable URLs for manual re-check, carrying prior observations; never report them verified. Beyond the ledger, info writes nothing; direction mappings route warn/block. Re-report outstanding flag-only findings under `./reconciliation.md` § *Flag-only findings are re-reported*.

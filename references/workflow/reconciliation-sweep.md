# Reconciliation: The Reference Sweep

The mechanics of the external reference check, split out of `./reconciliation.md`, which keeps § *The reference sweep*, § *Never-annotated surfaces*, and § *Flag-only findings are re-reported*. Read it on a run that sweeps; where the sweep sits in that run is `./reconciliation.md` § *Sequence and output*.

## Ledger

`observations.md` is the sweep's record (`./task-observations.md`). Read it **before the sweep**: its lines are both the diff baseline and what a failed fetch carries forward. Rewrite it **wholesale** at the end, one dated line per swept URL, `info` included, each line carrying the strongest tag that URL's occurrences produced — the precedence the report's `tag` field applies. The rewrite is part of the check, not an evidenced edit, and the one write an otherwise-empty sweep still makes.

## Scope

**The scope is a script.** `node <kit-root>/scripts/sweep-scope.ts <task-dir>` enumerates every fetchable citation on an actionable surface, deduplicated by URL, each entry carrying every citing surface and the tag `observations.md` last recorded for it, as JSON, fetching and writing nothing. `<kit-root>` resolves per `./task-store.md` § *Resolving `<kit-root>`*; `../scripts/sweep-scope.md` owns its CLI form, stdout contract, surfaces, and skipped links. Run it before fetching and sweep what it returns, not an enumeration of your own — which pause section counts as *active* included, decided there from the plan's own status.

Three of the surfaces it reads are swept but **never written into**, and the inclusion test they pass is what every surface the report leaves out fails: `./reconciliation.md` § *Never-annotated surfaces* names the three and owns both.

**The script unavailable** — no kit root, no `node`, or the script itself missing → the scope goes unenumerated and the sweep is **reported skipped** rather than hand-scoped; a hand enumeration is exactly what this section replaces.

**No citation in scope → no sweep**: enumeration is the whole run — nothing fetched, no ledger touched past deleting a stale one.

## Fetching

Compare the fetch against **every** occurrence's description and route each occurrence's finding by its own `surface`: one URL is one fetch and one ledger line, and still as many findings as surfaces citing it. Fetch **read-only** with the best capability the host agent offers, a structured integration over raw HTML scraping; nothing cited is ever commented on, updated, or posted to. Capture title, status, and last-updated, diffed against the URL's previous ledger line; on a first sweep, or a URL new to the file, fall back to each citing surface's description.

**Enumeration, not the URL, separates this from a reporting skill's drift check**: the sweep reports on *every* URL cited from an actionable surface, where a drift check opens *one artifact a claim names* to test that claim. The same page reached both ways is no conflict, and the sweep never substitutes for claim-level verification.

## Tags

- `info` — fetched cleanly, no material change since the baseline. A fetch establishing **nothing** also tags `info`, but only absent a prior `warn`/`block` to carry forward: auth-walled, marked `auth required — re-check manually`; or failed without establishing anything (timeout, 5xx, rate limit, connector error), marked `unreachable — <error>, re-check manually`. With a prior `warn`/`block` line, the carried line **keeps its tag**, the dated failed attempt appended.
- `warn` — material change: status flipped, new comments resolving an open question, doc substantively edited, PR merged or closed.
- `block` — broken (404, moved, deleted). **A state tag, not a change tag** — deciding *existence* where `warn` and `info` decide *change* against the baseline — so a re-observed 404 re-tags `block` every sweep, never `info`, and reappears in every sweep's report while the *edit* it routes to fires once (`./reconciliation.md` § *Annotation formats*: an annotation already correct is a no-op).

## Output and routing

A failed fetch is a finding, never a halt: capture the error, tag it, continue. Print the results under a `## References` heading in the run's report, or `No external references in sweep scope.` where the gate above skipped it — the absence line is the verification statement for the swept surfaces, not the folder. Auth-walled and unreachable URLs are surfaced there for manual re-check, never recorded as verified, each carrying its last observation forward. What a tag writes *beyond* the ledger is the direction's business, its mappings routing `warn` and `block`; `info` is a **no-op in every direction** past its ledger line. A **flag-only finding whose repair hasn't landed** rides the non-`info` tags, on the terms `./reconciliation.md` § *Flag-only findings are re-reported* fixes.

# Reconciliation: The Reference Sweep

The mechanics of the external reference check — split out of `./reconciliation.md`, which keeps § *The reference sweep* (who runs one, and the exemption for a finding set pinned to a producing phase), § *Never-annotated surfaces* (the never-annotated rule the flag-only findings below route by), and § *Flag-only findings are re-reported* (how far re-reporting one reaches). Read this file on a run that sweeps; where the sweep sits in that run is `./reconciliation.md` § *Sequence and output*.

## Ledger

`observations.md` is the sweep's record (`./task-observations.md`). Read it **before the sweep**: its lines are both the diff baseline and what a failed fetch carries forward. Rewrite it **wholesale** at the end, one dated line per swept URL, `info` included. The rewrite is part of the check, not an evidenced edit, and is the one write an otherwise-empty sweep still makes.

## Scope

**In scope** — every external URL cited from an **actionable surface**:

- `CONTEXT.md`'s `## References` and `## Open Questions`;
- `plan.md` steps and its `## Open Questions`;
- `ticket.md`'s References;
- the result's `## Current state` `**Pointers:**` entries, first-class citations: a PR or ticket pointer is fetched like any URL, a bare branch/SHA pointer checked against the repo instead;
- the result's **active pause section** — the `**Blocked:**` / `**In review:**` section the plan's current status owes: only when the plan's `**Status:**` is `blocked` or `in-review`, and then only the most recent one;
- a doc-task deliverable's `**Published:**` URL, the deliverable resolved per `./doc-task-files.md` (fixed without the plan's optional `**Deliverable:**` header).

**Out of scope**, however much they cite: `observations.md`, the sweep's own record; `result.md` below `## Current state` bar the active pause section (prior log sections and the append-only `## Decision log` alike); the `## Current state` gloss and `**Next:**` line; `goals.md`; `CONTEXT.md` prose; `plan.md` outside its steps and `## Open Questions`.

Three of the in-scope surfaces — `ticket.md`, a deliverable's `**Published:**` line, and the active pause section — are swept but **never written into**, and the inclusion test they pass is what every out-of-scope surface fails: `./reconciliation.md` § *Never-annotated surfaces* owns both.

**No external URL in scope → no sweep**: enumeration is the whole run — nothing fetched, no ledger touched past deleting a stale one.

## Fetching

Skip `mailto:`, `file://`, `localhost`, anchors-only, and relative links. **Deduplicate for fetching and for the ledger line by URL, retaining every citing surface**: compare the fetch against **every** occurrence's description, take the strongest tag for the one ledger line (`block` over `warn` over `info`), and route each occurrence's own finding by its own surface. Fetch **read-only** with the best capability the host agent offers, a structured integration over raw HTML scraping; read-only is absolute in both directions — nothing cited is ever commented on, updated, or posted to. Capture title, status, and last-updated, diffed against the URL's previous ledger line; on a first sweep, or a URL new to the file, fall back to the citing file's description.

**Enumeration, not the URL, separates this from a reporting skill's drift check**: the sweep enumerates *every* URL cited from an actionable surface and reports on each, where a drift check opens *one artifact a claim names* to test that claim. The same page reached both ways is no conflict, and the sweep never substitutes for claim-level verification.

## Tags

- `info` — fetched cleanly, no material change since the baseline. A fetch establishing **nothing** also tags `info`, but only absent a prior `warn`/`block` to carry forward: auth-walled, marked `auth required — re-check manually`; or failed without establishing anything about the target (timeout, 5xx, rate limit, connector error), marked `unreachable — <error>, re-check manually`. Don't pretend either was fetched. With a prior `warn`/`block` line, the carried line **keeps its tag**, the dated failed attempt appended.
- `warn` — material change: status flipped, new comments resolving an open question, doc substantively edited, PR merged or closed.
- `block` — broken (404, moved, deleted): the docs point at something gone. **A state tag, not a change tag** — deciding *existence* where `warn` and `info` decide *change* against the baseline — so a re-observed 404 re-tags `block` every sweep, never `info`, and reappears in every sweep's report while the *edit* it routes to fires once (`./reconciliation.md` § *Annotation formats*: an annotation already correct is a no-op).

## Output and routing

A failed fetch is a finding, never a halt: capture the error, tag it, continue. Print the results under a `## References` heading in the run's report, or `No external references in sweep scope.` where the gate above skipped it — the absence line is the verification statement for the swept surfaces, not the folder. Auth-walled and unreachable URLs are surfaced there for manual re-check, never recorded as verified, each carrying its last observation forward with the failed attempt dated. What a tag writes *beyond* the ledger is the direction's business, its mappings routing `warn` and `block`; `info` is a **no-op in every direction** past its ledger line. A **flag-only finding whose repair hasn't landed** rides the non-`info` tags, on the terms `./reconciliation.md` § *Flag-only findings are re-reported* fixes.

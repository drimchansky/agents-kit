# ADR Format Checklist

For `adr.md` deliverables (`../workflow/doc-task-files.md`). Consult store doc-conventions when present (`../workflow/task-store.md` § *Store-level artifacts*).

## Header block

Use `# ADR: <subject>`, followed by:

- `**Status:**` Draft / Proposed / Accepted / Superseded, independent of task status. Record acceptance date, gatekeeper, and sign-off source locally.
- `**Author:**` with role in parentheses.
- `**Reviewers:**` acceptance gatekeepers only, each with a role. Omit merely consulted people.
- `**Companions:**` upstream RFC, research dossiers, superseded doc, and consumed sibling seams as `·`-separated links.
- `**Drafting basis:**` fixed inputs, including accepted upstream decisions, prior docs, and draft contracts.
- `**Published:**` dated live-truth pointer when an external copy exists (`../workflow/doc-task-files.md`).

## Section skeleton

Use numbered `## N.` sections for stable `§N.M` citations:

1. **TL;DR:** actionable bullets understandable without the body.
2. **Context:** product frame, purpose, replacement, cited fixed inputs, verified as-built state with date, and numbered decision drivers.
3. **Decision:** follow § *Decision shape*; repeat per decision area when needed.
4. **Contracts:** resulting interfaces and agreements. Reconcile prior drafts and annotate divergences.
5. **Coverage, rollout & risks:** day-one coverage, rollout, and decision-specific risks.
6. **Supersession:** what ends, what survives, and where survivors now live.
7. **Open-items ledger:** deferred items with owner and phase; apply § *Open-questions bar*.
8. **References:** source list.

Adapt names and grouping while covering each applicable concern. Omit a section only when its concern is absent.

## Decision shape

- Give each decision exactly one recommendation and an explicit rejection reason for every unchosen option.
- Record and justify settled upstream inputs with their decision sources; do not re-decide them.
- For unsettled dependencies, state a default, its change condition, and the open item's owner.

## Open-questions bar (the ledger)

- Number genuinely open items. Cut answered questions; cite questions owned elsewhere.
- Give each item one question, its owner, and what it blocks, or explicitly "gates nothing".
- Put options in decision sections, outside the ledger.

## Register & trim

- Expand acronyms at first use, for example "BFF (backend-for-frontend)".
- Cut restatement, jargon, and pointers immediately repeating adjacent diagrams or sections. Prefer shorter words carrying the same meaning.
- Write diagram labels for outside readers. Keep internal precision, such as process-locality details, in prose when public labels do not need it.

## Verify

Check shape within the unit criterion using `./verification.md`. Apply register and trimming through `review-docs`; this checklist adds no separate gate.

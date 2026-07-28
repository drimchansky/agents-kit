# ADR Format Checklist

The generic format bar for an ADR deliverable — the `adr.md` work product of a doc task (the
deliverable role in `../workflow/task-layout.md` § *Doc-task files*). This file owns document
*shape*: structure, decision form, register. How a step over the doc is verified is
`./verification.md` — this checklist supplies the ID'd shapes its coverage check counts — and the
register & trim bar below is applied by `review-docs`'s quality pass. Org specifics (people and
mention tables, house style, published-page handling) live in the store's doc-conventions file,
discovered per `../workflow/task-layout.md` § *Store-level artifacts* — consult it when present;
this checklist stays org-free by design.

## Header block

`# ADR: <subject>` title, then a compact header block:

- `**Status:**` — the **document's own lifecycle** (Draft / Proposed / Accepted / Superseded),
  distinct from the task's plan/result statuses. The local copy carries acceptance provenance:
  date, who the gate was, where the sign-off is recorded.
- `**Author:**` — with role in parentheses.
- `**Reviewers:**` — only the people whose sign-off actually gates acceptance, each with a role in
  parentheses; everyone merely consulted stays out of the header.
- `**Companions:**` — the upstream RFC, research dossiers, the doc this ADR supersedes, sibling
  seams it consumes — `·`-separated links.
- `**Drafting basis:**` — the fixed inputs the ADR synthesizes (accepted upstream decisions, prior
  docs, draft contracts), stated as fixed.
- `**Published:**` — when a copy lives outside the folder, the published-pointer line declaring
  which copy is live truth, dated (`../workflow/task-layout.md` § *Doc-task files*).

## Section skeleton

Numbered `## N.` sections, so reviewers can cite `§N.M` stably:

1. **TL;DR** — a handful of bullets a reader can act on without the body.
2. **Context** — the product frame; why this ADR exists and what it replaces; **fixed inputs
   cited, not re-litigated**; current state as-built (verified against the real systems, with an
   as-of date); decision drivers, numbered.
3. **Decision** — the core (see *Decision shape*); a multi-decision ADR repeats the section per
   decision area.
4. **Contracts** — the concrete interfaces/agreements the decisions produce, reconciled against
   any prior draft — divergences annotated, never silent.
5. **Coverage, rollout & risks** — what the decision covers day one, how it lands, what could go
   wrong (risks specific to this decision, not generic).
6. **Supersession** — when the ADR replaces a prior doc: what dies, what survives, and where the
   survivors now live.
7. **Open-items ledger** — deferred items, each with an owner and a phase (see *Open-questions
   bar*).
8. **References** — the source list.

Adapt names and grouping to the doc — the bar is that each concern above has a home, not that
headings match verbatim; drop a section only when its concern genuinely doesn't exist (no prior
doc → no supersession).

## Decision shape

- Each decision states **exactly one recommendation**, and every non-chosen option carries
  an explicit **rejection reason** — an option list without rejection reasons is a survey, not a
  decision.
- A decided upstream input is **recorded and justified, never re-decided** — cite where it was
  settled; re-opening it in the ADR sets the review up to re-litigate it.
- A decision resting on something unsettled states a **default plus the condition** that would
  change it, and names the owner of the open piece — a decision with a fallback, not a blocker.

## Open-questions bar (the ledger)

- Numbered items, each **genuinely open** — questions already answered, or owned by another doc or
  team, are cut or cited, not carried.
- One crisp question per item, plus its **owner** and a **gating note** — what the answer blocks,
  or explicitly "gates nothing".
- No option enumeration inside the ledger — options belong in a decision section.

## Register & trim

- **Expand acronyms at first use** — "BFF (backend-for-frontend)" style — the first time each term
  meets the reader.
- **Trim restatement and jargon** — no "the X — that is, the X" tails; no cross-reference repeated
  immediately before a diagram or section that shows the same thing; prefer the shorter word when
  it carries the meaning ("follow-up", not "follow-up ADR", on second mention).
- **Diagram labels read for the audience** — label nodes and edges with what an outside reader
  needs; drop internal-precision labels (e.g. process-locality markers like "in-process" /
  "out-of-process") from public diagrams and keep that precision in prose.

## Verify

Shape conformance is checked inside the step verify over the doc — the mechanical recipe (coverage
closure, citation spot-checks, render fidelity, sign-off disposition) is `./verification.md`; the
register & trim bar is applied by `review-docs`'s quality pass. Run them there rather than treating
this checklist as a separate gate.

# RFC Format Checklist

The generic format bar for an RFC deliverable — the `rfc.md` work product of a doc task (the
deliverable role in `../workflow/doc-task-files.md`). An RFC here is the
findings-and-decisions-to-confirm doc: it pins what is known, asks exactly the decisions that gate
the work, and records answers as they land. This file owns *shape*; how a step over the doc is
verified is `./verification.md` — this checklist supplies the `F<n>` / `D<n>` IDs its coverage
check counts — and the register bar below is applied by `review-docs`'s quality pass. Org specifics
(people and mention tables, house style, published-page handling) live in the store's
doc-conventions file, discovered per `../workflow/task-layout.md` § *Store-level artifacts* —
consult it when present; this checklist stays org-free by design.

## Header block

`# RFC: <subject> — findings & decisions to confirm` (with the tracking key in the title when one
exists), then a compact header block:

- `**Author:**` — with role in parentheses; `**Date:**`.
- `**Status:**` — the **document's own lifecycle** (Draft / In review / Accepted / Superseded),
  distinct from the task's statuses; the local copy carries acceptance provenance (what closed,
  when, where recorded) and the planned hand-off ("→ superseded by the implementation ADR when it
  ships").
- Delivery-frame links when they exist — the epic / milestone / deadline that anchors the ask.
- `**Companions:**` — the research dossier, the task context, sibling docs on adjacent questions.
- `**Published:**` — the published-pointer line when a copy lives outside the folder
  (`../workflow/doc-task-files.md`).
- A **numbering note** whenever item IDs changed mid-review — IDs are durable (below), so a
  renumber is recorded with date and reason, never silent.

## Findings (`F<n>`)

- The facts the RFC stands on, each `F<n>`-numbered and **citing a source** (dossier section,
  link). Findings state what *is*; decisions ask what *should be* — don't mix the two.
- A stance that is already decided is marked decided and carried as a **fixed input** (recorded
  and justified like an ADR decision), not re-asked as an item.

## Decision items (`D<n>`)

- Each decision to confirm is `D<n>`-numbered with a **durable ID** — later docs and the log cite
  these, so a removed item retires its number; never renumber.
- Item form: **context → proposed default → owner(s) → outcome**. The proposed default makes
  silence actionable ("default stands unless objected by <date>"); the outcome line is filled when
  answered, with its source.
- **Blocks split by gating** — items that gate the work (the "answer before build" block) separate
  from direction items that don't, so reviewers see what must close and what may idle.

## Decision log

- A live log section, filled as answers arrive: per item — date, who, outcome, source link. The
  log is the RFC-side record of the round; each item's outcome line points into it.

## Scope bounds

- **Who needs to answer what** — a mapping of owners to the items awaiting them.
- **What we are NOT asking** — the explicit non-goals section bounding the RFC.
- **Next steps** — what follows once the gating block closes (typically the implementation ADR).

## Register & trim

The same bar as the ADR checklist — `./adr-format.md` § *Register & trim*: acronyms expanded at
first use, restatement and jargon trimmed, diagram labels written for the audience.

## Verify

Shape conformance is checked inside the unit-outcome criterion over the doc — the recipe is
`./verification.md`; the `F<n>` / `D<n>` item IDs above are exactly the keys its coverage /
mapping-closure check counts on both sides.

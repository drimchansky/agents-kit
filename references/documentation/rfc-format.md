# RFC Format Checklist

Use `rfc.md` (`../workflow/doc-task-files.md`) to pin findings, request gating decisions, and record answers. Apply discovered store conventions (`../workflow/task-store.md` § *Store-level artifacts*).

## Header block

Use `# RFC: <subject> — findings & decisions to confirm`, including a tracking key when available, followed by:

- `**Author:**` with role; `**Date:**`.
- `**Status:**` Draft / In review / Accepted / Superseded, independent of task status. Locally record acceptance provenance: what closed, when, and its source. Include the planned handoff, such as supersession by an implementation ADR.
- Delivery-frame links when available: epic, milestone, deadline.
- `**Companions:**` research dossier, task context, and adjacent sibling documents.
- `**Published:**` external-copy pointer (`../workflow/doc-task-files.md`).
- A dated numbering note with reason if IDs changed during review. Preserve durable IDs thereafter.

## Findings (`F<n>`)

- Number facts `F<n>` and cite sources. Keep factual findings separate from requested decisions.
- Mark settled stances decided. Record and justify them as fixed inputs without asking again.

## Decision items (`D<n>`)

- Assign durable `D<n>` IDs. Retire removed numbers; never renumber remaining items.
- Use **context → proposed default → owner(s) → outcome**. Make silence actionable, for example "default stands unless objected by <date>". Fill answered outcomes with their sources.
- Separate "answer before build" gates from non-gating direction items.

## Decision log

- Record answers as they arrive: item, date, who, outcome, source link. Point each item's outcome line into this log.

## Scope bounds

- **Who needs to answer what:** map owners to waiting items.
- **What we are NOT asking:** explicit non-goals.
- **Next steps:** actions after the gating block closes, usually the implementation ADR.

## Register & trim

Apply `./adr-format.md` § *Register & trim*.

## Verify

Prove shape through `./verification.md` within the unit criterion. Count `F<n>` and `D<n>` IDs on both sides of the coverage mapping.

# Documentation Verification

For documentation tasks run by `implement-task`, `implement`, `review-task`, `resume-task`, and `reconcile-task`. Apply the shared loop in `../workflow/execution-loop.md`.

## Documentation mapping to the shared verification tiers

### Unit outcome — every unit

Before marking a unit complete, prove both:

- The stated criterion from the consumer's Source binding (`../workflow/execution-bindings.md`). Select applicable checks below. Review a criterion needing an unlisted check; do not silently improvise.
- A whole-deliverable link/cross-reference sweep after every unit. Resolve every relative link, URL, anchor, and internal section pointer, including renumbered targets.

Each check needs observable evidence: counts, opened sources, fetched pages, or resolved targets. Stop before the next unit if either part fails.

### Unit-outcome criterion checks (the document recipe)

1. **Coverage / mapping closure:** enumerate source and deliverable IDs or sections, then reconcile counts. Give every unmatched item a disposition: incorporated, declined with reason, or deferred with owner. Apply this to requirements, review comments, and finding/source mappings.
2. **Citation spot-checks:** open every load-bearing decision citation and at least a handful elsewhere. Confirm support for the specific assertion; a matching topic alone fails.
3. **Render fidelity:** when a staged or live copy exists, fetch it and compare content with the local deliverable. Check headings, lists, tables, links, mentions, and diagrams. A successful write alone proves no rendering.
4. **Sign-off disposition:** record each claimed approval, acknowledgement, or answer with who, where, when, and its source. External approval belongs to an `(external)` goal, closed on the best available proxy (`../workflow/acceptance-criteria.md`). Never record expected approval as received.

### Integrated health — declared boundaries

At each consumer-declared health boundary, run and record the link/cross-reference sweep across the integrated deliverable set. Include its dossiers and outbound drafts. This boundary supplements the per-unit whole-deliverable sweep.

Run only mechanical documentation checks; no engineering typecheck, lint, test, stack detection, or build commands.

Run `review-docs` at checkpoints and before publishing (`./rules.md` § *Before presenting a doc*). Treat coherence/register findings as judgment, separate from both verification tiers and integration assertions.

## Stop-the-Line (when a verification tier or assertion fails)

Apply `../workflow/execution-loop.md` § *Stop-the-Line*. Localize the failure to the document, source, or mapping. Correct the claim, reopen the source, or repair the mapping; vague wording cannot clear a substance error.

Record corrections with date, change, and reason under the consumer's Record binding. Also use the document's annotation convention when present.

## Integration assertions

Run every assertion at its declared point, including `implement-task` checkpoints and the end of `implement`. Exercise named coverage closure and reader journeys across the integrated document. Follow its TL;DR, decision, and source as a reader would. Failed assertions take Stop-the-Line.

Keep the adjacent health sweep and `review-docs` quality findings separate from assertion results.

## Acceptance-gate recipe

Verify each goal against the live deliverable and its published state. Open documents, fetch pages, and recount mappings; prior step records are insufficient.

For drift/resume checks, reopen the document or page cited by a prior `met` goal and confirm its current state.

Tag unconfirmed `(external)` goals `pending external` and park at `in-review`. Close them when confirmation arrives, using reported approval or observed page state. Follow `../workflow/acceptance-criteria.md` and `../workflow/task-lifecycle.md`.

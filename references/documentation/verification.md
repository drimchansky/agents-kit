# Documentation Verification

What "verify" means when the deliverable is a document — the recipe behind the neutral **unit
outcome**, **integrated health**, **integration assertions**, Stop-the-Line, and acceptance gate for
`**Domain:** documentation` tasks
(`implement-task`, `implement`, `review-task`, `resume-task`, `reconcile-task`).
`../workflow/execution-loop.md` owns *that* you verify and gate; this file owns *what to run*.

## Documentation mapping to the shared verification tiers

Documentation retains its existing per-unit mechanical cadence. The shared tiers classify the
evidence and declare where it becomes current for the integrated deliverable set; they do not defer
the whole-deliverable sweep or import an engineering recipe.

### Unit outcome — every unit

Before a documentation unit is marked outcome-complete, prove both of these mechanical parts:

- **The stated unit criterion** — the consumer's **Source** binding in
  `../workflow/execution-bindings.md` supplies it. For document work it is normally assembled from the
  four checks below; a plan step picks the ones its outcome makes applicable. A criterion needing a
  check none of the four name is a signal to look twice at the step (or extend this recipe), not to
  improvise silently.
- **The whole-deliverable link / cross-ref sweep** — after every unit, not only at a consumer health
  boundary, confirm that every relative link, URL, and section anchor in the deliverable resolves and
  each internal "see §N" pointer still reaches the intended section after any renumbering.

The outcome tier is deliberately mechanical: every check produces an observable artifact (a count,
opened source, fetched page, or link target) and can fail on its own. Never start the next unit while
the prior unit outcome is failing.

### Unit-outcome criterion checks (the document recipe)

1. **Coverage / mapping closure** — prove "every X is accounted for" by counting both sides, never
   by reading and nodding. Enumerate the items on the source side and on the deliverable side —
   `grep -c` / `grep -o … | sort` over the IDs (`F<n>`, `D<n>`, `G<n>`, comment numbers) or the
   section list — reconcile the counts, and chase every unmatched item to an explicit disposition
   (incorporated, declined-with-reason, or deferred-with-owner). The same procedure covers
   requirements→sections mapping, review-comment dispositions, and findings→source closure.
2. **Citation spot-checks** — open the actual sources behind a sample of the step's citations:
   every load-bearing citation in a decision section, and at least a handful elsewhere. Confirm
   each source says what the doc claims — the assertion, not merely the topic. A citation that
   points at the right doc but doesn't support the sentence in front of it fails the check.
3. **Render fidelity** — when a published copy exists (a staged or live page), fetch the actual
   published copy and compare it against the local deliverable: headings, lists, tables, links,
   mentions, and diagrams all render, and content matches — no mangled blocks, no silently dropped
   sections. Never assume a write rendered; the fetch is the proof.
4. **Sign-off disposition** — every approval, acknowledgement, or answer the step claims is
   recorded with its source: who, where, when (a comment link, a message link, an explicit line in
   the doc). An approval that happens outside the session belongs to an `(external)` goal and
   closes on its best-available proxy — see `../workflow/acceptance-criteria.md`; never record one
   on an expectation.

### Integrated health — declared boundaries

At every **Health boundary** the consumer declares, run and record the link / cross-ref sweep over
the integrated deliverable **set** — the deliverable, dossiers, and outbound drafts that must not
disagree. This establishes current integrated-health evidence for that exact set; it does not replace
the same whole-deliverable sweep required in every unit outcome.

The documentation integrated-health recipe is mechanical only. Do not run engineering typecheck,
lint, test, stack-detection, or build commands for a documentation task.

Document *quality* — whole-doc coherence and register — is judgment, not a verification tier or an
integration assertion. Run `review-docs` at checkpoints and before publishing
(`./rules.md` § *Before presenting a doc*); it produces findings, never a silent mechanical pass.

## Stop-the-Line (when a verification tier or assertion fails)

Stop. Don't start the next step, don't mark the current step done, don't bandage the wording. Work
the triage in order:

1. **Localize** — which section, claim, or mapping fails, and on which side: the doc, the source,
   or the map between them.
2. **Fix the claim or the source, not the wording** — a failed check is usually a substance error
   (wrong fact, missed comment, stale citation), and rewording a sentence into vagueness until the
   check "passes" hides it. Correct the fact, re-open the source, or repair the mapping.
3. **Record the correction dated, never silently** — a corrected claim in an already-reviewed doc
   is itself information. Record what changed and why per the consumer's **Record** binding, and in
   the doc's own annotation convention when it has one (a dated inline note, a changelog line).
4. **Re-prove the failed unit outcome, rerun the failed integrated-health boundary, or rerun the
   failed integration assertion.** Only then continue.

If it can't be resolved this session, stop — don't skip ahead — and record the pause per the
consumer's **Blocked** binding in `../workflow/execution-bindings.md`.

## Integration assertions

At each assertion point the consumer declares (`implement-task`'s `### Checkpoint after Step N`, or
the end of an `implement` run), run every named assertion. For document work that typically means
coverage closure re-run across the integrated whole and the named reader journey — follow the doc's
own path (TL;DR → decision → cited source) as a reviewer, not as its author. If an assertion fails,
apply Stop-the-Line.

The integrated deliverable-set link / cross-ref sweep runs at the adjacent health boundary, not as
an assertion. The `review-docs` quality pass also remains separate: run it at the checkpoint or
before publishing, assess its findings as judgment, and never count it as a mechanical-tier or
assertion result.

## Acceptance-gate recipe

Verify each goal against the **live deliverable and its published state**, not against your record
of the work: open the actual doc, fetch the actual page, re-count the actual mappings. "Step 3
says it was covered" is not verification — a record captures intent, not current state.

Spot-checking a prior `met` goal (drift / resume): open the doc or fetch the page the goal cites
and confirm the state still holds; a locked page may have gained comments, a "final" doc may have
been hand-edited since.

**Goals verified after the session (`(external)`).** Sign-offs, review-round outcomes, and
live-page states the agent can't drive in-session carry the `(external)` marker in `goals.md`: tag
such a goal `pending external` (not `met`, not `unmet`) and let the task park at `in-review` until
the confirmation arrives — then close it on its best-available proxy (the reported approval, the
observed page state). See `../workflow/acceptance-criteria.md` and `../workflow/task-lifecycle.md`.

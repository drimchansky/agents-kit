# Execution Acceptance and Presentation

The execution loop's closing gates: how the acceptance gate runs against the criteria as the user wrote them, and what has to hold before a finished run is presented.

## Acceptance discipline

The gate proves the whole ask is satisfied. What it runs against and where the verdict goes is the consumer's **Acceptance** binding; how it runs is the same for every consumer:

- **Re-read each criterion as the user wrote it.** Do not paraphrase or reinterpret.
- **Verify it against the real outcome**, not against your own record of the work: run the actual command, exercise the actual flow, observe the actual output. Reading "step 3 says it works" is never verification. For code, `../engineering/acceptance-gate.md` § *Acceptance-gate recipe*.
- **When an outcome can't be re-run** (an event that happened, a booking that's confirmed), verify it against its **best available proxy** (a confirmation, a receipt, direct observation of the end state), and evaluate judgment-based outcomes post-hoc in a short retro (`./acceptance-criteria.md`).
- **A gap is a gap.** Never downgrade an unmet criterion to a caveat in order to finish. Apply Stop-the-Line: close missed work, or surface a misunderstanding of the ask to the user.

## Before presenting

Run the final health boundary if the work product changed since the last successful one; otherwise present on that current evidence rather than re-running it. Then run the pre-presentation checks the domain's `rules.md` names, owed on every run: for code, a consumer grep when exports or shared code changed (`../engineering/rules.md` § *Before presenting changes*); for documents, the checks in `../documentation/rules.md` § *Before presenting a doc*. Remove scratch artifacts. Then summarize: what shipped, how acceptance came out, any deviations, any open follow-ups.

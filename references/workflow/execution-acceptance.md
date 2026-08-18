# Execution Acceptance and Presentation

The execution loop's closing gates, split out of `./execution-loop.md`: how the acceptance gate is run
against the criteria as the user wrote them, and what has to hold before a finished run is presented.
Read it at the run's acceptance gate and before presenting a completed run.

## Acceptance discipline

Every unit's outcome proof proves a slice works; the acceptance gate still proves the whole ask is
satisfied. What it runs against and where the verdict goes is the consumer's **Acceptance** binding.
How it runs is the same either way:

- **Re-read each criterion as the user wrote it.** Don't paraphrase or reinterpret.
- **Verify it against the real outcome**, not against your own record of the work — a record captures
  intent, not current state. Observe the outcome directly where you can: run the actual command,
  exercise the actual flow, observe the actual output. Reading "step 3 says it works" is never
  verification. When the domain is code, the recipe is in `../engineering/acceptance-gate.md`
  § *Acceptance-gate recipe*.
- **When an outcome can't be directly re-run** — a one-shot or irreversible result (an event that
  happened, a negotiation that concluded, a booking that's confirmed) — verify it against its **best
  available proxy** (a confirmation, a receipt, a recorded result, direct observation of the end
  state), and evaluate genuinely judgment-based outcomes **post-hoc** in a short retro rather than
  pretending they re-run. See `./acceptance-criteria.md`.
- **A gap is a gap.** Don't downgrade an unmet criterion to a caveat in order to finish. Apply
  Stop-the-Line: localize the gap and decide whether it's missed work (go back and close it) or a
  misunderstanding of the ask (surface it to the user).

## Before presenting

Confirm that integrated-health evidence covers the final changed surface: run the final health boundary
if the work product changed since the last successful one, and otherwise preserve that current evidence
rather than re-running it to present.

Either way, run the remaining pre-presentation checks the resolved domain's `rules.md` names — for code,
a consumer grep when exports or shared code changed (`../engineering/rules.md` § *Before presenting
changes*); for documents, the link, placeholder, sourcing, and side-effect checks in
`../documentation/rules.md` § *Before presenting a doc*. They are independent of the health branch above
and are owed on every run. Remove scratch artifacts left over from the work. Then summarize: what
shipped, how acceptance came out, any deviations, any open follow-ups.

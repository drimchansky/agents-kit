# Engineering Acceptance Gate

What the acceptance gate runs when the domain is code, split out of `./verification.md` so the tier
mapping every run reads stays small. Read it when running the acceptance gate on code goals.

## Acceptance-gate recipe

When running the acceptance gate, verify each criterion against the **shipped behavior**, not
against your record of the work: run the actual command, exercise the actual flow, observe the
actual output. "Step 3 says it works" is not verification — a record describes intent, not current
state.

Spot-checking a prior `met` goal (drift / resume): open the file or run the command it cites
and confirm the behavior still holds; if the result file claims `met` but the named flow no longer
behaves as required, flag it so the gate is re-run before the prior result is trusted.

**Goals verified after the session (`(external)`).** Some code goals can't be re-run in-session
because verification happens downstream — a change confirmed only once it's deployed and observed
live in production, a manual-QA pass, or a client/stakeholder sign-off. These carry the
`(external)` marker in `goals.md` and the gate can't close them here: tag such a goal
`pending external` (not `met`, not `unmet`) and let the task park at `in-review` until the check is
confirmed on a later re-run. Don't verify-by-proxy an outcome you can't actually observe yet just to
reach `done`. See `../workflow/acceptance-criteria.md` and the `in-review` state in
`../workflow/task-lifecycle.md`.

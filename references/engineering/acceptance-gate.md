# Engineering Acceptance Gate

What the acceptance gate runs when the domain is code.

## Acceptance-gate recipe

Verify each criterion against the **shipped behavior**, not against your record of the work: run the actual command, exercise the actual flow, observe the actual output. A record describes intent, not current state.

Spot-checking a prior `met` goal (drift or resume): open the file or run the command it cites and confirm the behavior still holds. If the result file claims `met` but the flow no longer behaves as required, flag it so the gate is re-run before the prior result is trusted.

**Goals verified after the session (`(external)`).** A code goal confirmed only downstream (a change observed live in production, a manual-QA pass, a stakeholder sign-off) carries the `(external)` marker in `goals.md`. Tag it `pending external`, not `met` or `unmet`, and let the task park at `in-review` until a later re-run confirms it. Do not verify-by-proxy an outcome you cannot observe yet. See `../workflow/acceptance-criteria.md` and the `in-review` state in `../workflow/task-lifecycle.md`.

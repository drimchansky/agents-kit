# Engineering Verification

What "verify" means when the domain is code — the recipe behind the neutral verification tiers,
Stop-the-Line, health boundaries, and acceptance gate (`implement-task`, `implement`, `review-task`,
`resume-task`, `reconcile-task`, `fix-findings`).
`../workflow/execution-loop.md` owns *that* you verify and gate; this file owns *what to run*.

## Two verification tiers

Both are required, but they run on different cadences — they answer different questions:

- **Unit outcome** — immediately run the unit's stated verify criterion (see the consumer's
  **Source** binding in `../workflow/execution-bindings.md`). Then validate every comment the unit added
  or edited against `code-style.md` → Comments — that unit's comments only, never a repo-wide comment
  audit — and fix what that section prohibits before recording the outcome. This proves the new
  behavior and its touched comments; it is not integrated-health evidence.
- **Integrated health** — at every consumer-declared health boundary, run every exposed typecheck,
  lint, test, and distinct build command against the current shared tree, not only the changed area.
  Discover the full command set from the project's authoritative manifests, documented verification
  commands, and CI configuration; every project-exposed full command runs. Record an unavailable
  command category explicitly; never replace an exposed command with a narrower check.

Integrated-health evidence is state-specific: any work-product edit after the boundary invalidates
it, including a rollback. Do not report it current until the complete recipe has passed again on the
state that remains. A unit criterion that happens to invoke one health command does not exempt the
next health boundary from running the full recipe.

Never start the next unit while its outcome proof is failing, and never proceed past a health
boundary while its integrated-health recipe is failing.

### Batched finding fixes

`fix-findings` applies the unit-outcome tier immediately but pays the full recipe once for the
retained collection at its declared health boundary; it never starts with a health run or runs the
recipe once per finding. A red boundary reruns only its failed command or commands, never a second
full recipe merely to compare, and a rebuilt candidate earns one fresh complete recipe. What that
comparison establishes, what it implicates, and what it restores is that skill's own procedure —
`skills/fix-findings/SKILL.md` § *Integrated health boundary* owns it.

Both isolations obey the green-control rule in `../workflow/execution-loop.md` § *Evidence
lifecycle*: replaying a subset only implicates it when the predicate under test is green on the state
the replay starts from. A failed health command qualifies once it is green at the baseline, which is
why the comparison above runs first. A finding's own outcome tier never qualifies against the
bare baseline — the baseline predates that finding's fix, so the tier is red there by
construction — so isolate it from the baseline plus that finding's own change set, never from the
baseline alone. The tier is also what the replay tests: it is the whole tier that failed, and
narrowing the predicate back to the criterion hides a failure in the per-unit checks.

## Stop-the-Line (when either tier fails)

Stop. Don't start the next unit, don't call the current shared tree healthy or the run complete, and
don't bandage the symptom. Work the triage in order:

1. **Reproduce** — make the failure happen reliably; note conditions if intermittent.
2. **Localize** — narrow which layer fails (UI, API, DB, build, the test itself). `git bisect` is
   fair game for regressions.
3. **Reduce** — strip the failing case to the minimum that triggers it.
4. **Fix the root cause, not the symptom** — ask "why does this happen?" until you reach the actual
   cause. Deduplicating in the UI when the API returns duplicates is a symptom fix; fixing the JOIN
   is a root-cause fix.
5. **Guard against recurrence** — add a regression test that fails without the fix and passes with
   it.
6. **Re-prove the failed unit outcome, rerun the failed integration assertion, or rerun the failed
   health boundary.** Only then continue.

If it can't be resolved this session, stop — don't skip ahead — and record the pause per the
consumer's **Blocked** binding in `../workflow/execution-bindings.md` (for `implement-task`, a `blocked`
status with a `**Blocked:**` section naming what failed, what was tried, and what's needed, per
`../workflow/task-lifecycle.md`).

## Integration assertions

At each consumer-declared integration-assertion gate, run every named assertion and exercise every
named end-to-end flow **end to end**, never assuming it holds because unit tests pass. Integration
assertions and health boundaries may be adjacent, but their evidence remains distinct: an assertion
does not narrow or replace the full health recipe, and health does not replace a named assertion. If
an assertion fails, apply Stop-the-Line; if its recovery changes the work product, run a fresh health
boundary before presenting the run as complete.

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

# Engineering Verification

What "verify" means when the domain is code — the recipe behind the neutral spine's verify gates,
Stop-the-Line, checkpoints, and acceptance gate (`implement-task`, `review-task`, `resume-task`).
The spine owns *that* you verify and gate; this file owns *what to run*. See
`../workflow/domain-packs.md`.

## Two verify gates per step

Both are required after implementing a step — they answer different questions:

- **Step verify** — run the step's plan-defined `Verify` criterion. Proves the new behavior works.
- **Health verify** — run typecheck, the linter, and the existing test suite on the changed area.
  Proves nothing else regressed. Do not collapse this into the step verify.

Never start the next step while the previous step's verify is failing.

## Stop-the-Line (when either gate fails)

Stop. Don't start the next step, don't mark the current step done, don't bandage the symptom. Work
the triage in order:

1. **Reproduce** — make the failure happen reliably; note conditions if intermittent.
2. **Localize** — narrow which layer fails (UI, API, DB, build, the test itself). `git bisect` is
   fair game for regressions.
3. **Reduce** — strip the failing case to the minimum that triggers it.
4. **Fix the root cause, not the symptom** — ask "why does this happen?" until you reach the actual
   cause. Deduplicating in the UI when the API returns duplicates is a symptom fix; fixing the JOIN
   is a root-cause fix.
5. **Guard against recurrence** — add a regression test that fails without the fix and passes with
   it.
6. **Re-verify both gates.** Only then mark the step done.

If it can't be resolved this session, stop — don't skip ahead — and record the pause as a
`blocked` status with a `**Blocked:**` section (what failed, what was tried, what's needed), per
`../workflow/task-lifecycle.md`.

## Checkpoint assertions

At each `### Checkpoint after Step N`, run every assertion it lists — the full test suite, the
build / typecheck, and the named end-to-end flow exercised **end to end** (not assumed to work
because unit tests pass). If any fails, apply Stop-the-Line.

## Acceptance-gate recipe

When running the goals acceptance gate, verify each goal against the **shipped behavior**,
not the result file: run the actual command, exercise the actual flow, observe the actual output.
"Step 3 says it works" is not verification — the result file describes intent, not current state.

Spot-checking a prior `met` goal (drift / resume): open the file or run the command it cites
and confirm the behavior still holds; if the result file claims `met` but the named flow no longer
behaves as required, flag it so the gate is re-run before the prior result is trusted.

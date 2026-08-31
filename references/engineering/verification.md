# Engineering Verification

What "verify" means when the domain is code — the recipe behind the neutral verification tiers,
Stop-the-Line, health boundaries, and the acceptance gate, whose recipe sits in the sibling
`./acceptance-gate.md` (`implement-task`, `implement`, `review-task`, `resume-task`,
`reconcile-task`, `fix-findings`).
`../workflow/execution-loop.md` owns *that* you verify and gate; this file owns *what to run*.

## Two verification tiers

Both are required, but they run on different cadences — they answer different questions:

- **Unit outcome** — immediately run the unit's stated verify criterion (see the consumer's
  **Source** binding in `../workflow/execution-bindings.md`). Then validate every comment the unit added
  or edited against `code-style.md` → Comments — that unit's comments only, never a repo-wide comment
  audit — and fix what that section prohibits before recording the outcome. Then, where the project
  exposes a formatter, run it over the files that unit touched — those files only, never a repo-wide
  format run — and fix the drift it reports before the outcome is recorded, so no later boundary's
  delta carries formatting churn this unit left behind. This proves the new behavior, its touched comments,
  and their formatting; it is not integrated-health evidence.
- **Integrated health** — at every consumer-declared health boundary, run every exposed typecheck,
  lint, test, and distinct build command over the **dependency closure of the delta** since a recorded
  reference: this run's last green boundary. Outside the closure a file keeps that boundary's verdict,
  so re-running it proves nothing — the whole warrant for narrowing, and why it holds only where the
  reference carries a verdict. **A boundary whose reference carries no in-session green
  result runs the whole relevant surface instead.** Discovery is unchanged — the project's
  authoritative manifests, documented verification commands, and CI configuration — and every
  discovered command still runs; only its scope narrows. Record as unavailable a check class the
  project exposes no command for.

  How that scope is computed — per-class scopes, runner caches, reference and delta, widening
  triggers, infra-bound commands, concurrency — is `./boundary-scope.md`, read at a boundary and not
  between them.

Integrated-health evidence is state-specific: any work-product edit after the boundary invalidates
it, including a rollback. Do not report it current until the recipe has passed again on the state that
remains. A unit criterion that happens to invoke one health command does not exempt the next boundary,
which re-runs the closure of what changed since the last green one, so boundary count stops
mattering.

Never start the next unit while its outcome proof is failing, and never proceed past a health
boundary while its recipe is failing.

How `fix-findings` pays these tiers across a batch, and what a red boundary reruns:
`./batched-fixes.md` — read at a `fix-findings` health boundary, and above all when that boundary is
red.

## What a boundary records

**The one home for the shape of a recorded code-domain boundary**, cited by every consumer's
`**Health:**` field rather than restated. That field stays domain-neutral: the same skills run
documentation tasks, whose boundary is `../documentation/verification.md` § *Integrated health —
declared boundaries*, defining none of these. In order:

- **The reference** — the `worktree-merge.ts` manifest the delta was taken against and the tree it
  captured. A boundary that took none records why instead, and no delta: `whole surface: reference
  carries no in-session green result`, `reference skipped: no narrowing class exposed`, `reference
  skipped: no kit root`.
- **The delta** — its size in paths.
- **Per command** — its scope (delta, closure, or whole tree) and its result. A widened scope names
  the `./boundary-scope.md` § *Widening* trigger; a class reaching its closure as a cached whole-tree
  run says so. An infra-bound command records that file's `not run in-session: needs <X>; carried by
  CI required check <name>` / `uncovered` form instead of a result, leaving the boundary green.

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
   it. Prove the red half before the fix lands wherever that order is yours (`./execution.md`
   § *Prove-It pattern*, the planned bug-fix step); once it is live, the only thing left to un-fix is
   working code. Never edit the shared tree back to the broken state to get that red — an
   interruption then leaves the defect reintroduced in tracked code with only an unversioned copy to
   restore from — and `git stash` is no substitute, since `./rules.md` forbids mutating Git state
   unasked. Use a throwaway `git worktree` at the pre-fix state and remove it after: transient
   scratch that commits nothing and makes no branch sits inside that rule rather than against it
   (`../workflow/parallel-batch.md`). That pre-fix state is the shared tree with only the fix
   withheld, not the commit under it: `git worktree add` checks out a commit, and under the
   no-commit rule the tree carries earlier units and the new test itself uncommitted — so seed the
   worktree from the shared tree as that file's batches do, withhold the fix, and carry the test in.
   A red from an absent test or a missing module is not the red half. Where even that is
   unavailable, record the guard as proved forward-only — a gap the unit's report surfaces, not a
   cleared step, since a test written after the fix tests the implementation rather than the bug
   (`../workflow/execution-loop.md` § *Don't Rationalize*) — rather than asserting a red half that
   was never run.
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
does not narrow or replace the boundary's recipe, and health does not replace a named assertion. If
an assertion fails, apply Stop-the-Line; if its recovery changes the work product, run a fresh health
boundary before presenting the run as complete.

What the acceptance gate runs against shipped behavior, including drift spot-checks and `(external)`
goals: `./acceptance-gate.md` — read when running the acceptance gate on code goals.

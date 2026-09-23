# Engineering Verification

What "verify" means when the domain is code: the recipe behind the neutral verification tiers, Stop-the-Line, health boundaries, and the acceptance gate in `./acceptance-gate.md` (`implement-task`, `implement`, `review-task`, `resume-task`, `reconcile-task`, and code fixes in `fix-findings`). `../workflow/execution-loop.md` owns *that* you verify and gate; this file owns *what to run*.

## Two verification tiers

`../workflow/execution-loop.md` § *Two verification tiers* defines the tiers; this is the code recipe:

- **Unit outcome**: immediately run the unit's stated verify criterion (the consumer's **Source** binding, `../workflow/execution-bindings.md`). Then validate every comment the unit added or edited against `code-style.md` → Comments, that unit's comments only, and fix what it prohibits. Then, where the project exposes a formatter, run it over the touched files only and fix the drift before recording the outcome. This is not integrated-health evidence.
- **Integrated health**: at every consumer-declared health boundary, run every exposed typecheck, lint, test, and distinct build command over the **dependency closure of the delta** since this run's last green boundary. **A boundary whose reference carries no in-session green result runs the whole relevant surface instead.** Discovery is unchanged (manifests, documented verification commands, CI configuration) and every discovered command still runs; only its scope narrows. Record as unavailable a check class the project exposes no command for. Scope computation is `./boundary-scope.md`, read at a boundary.

A unit criterion that happens to invoke a health command does not exempt the next boundary. A rollback is a work-product edit like any other.

How `fix-findings` pays these tiers across a batch, and what a red boundary reruns: `./batched-fixes.md`.

## What a boundary records

The shape of a recorded code-domain boundary, cited by every consumer's `**Health:**` field. In order:

- **The reference**: the `worktree-merge.ts` manifest the delta was taken against and the tree it captured. A boundary that took none records why instead, and no delta: `whole surface: reference carries no in-session green result`, `reference skipped: no narrowing class exposed`, `reference skipped: no kit root`.
- **The delta**: its size in paths.
- **Per command**: its scope (delta, closure, or whole tree) and its result. A widened scope names the `./boundary-scope.md` § *Widening* trigger; a class reaching its closure as a cached whole-tree run says so. An infra-bound command records that file's `not run in-session: needs <X>; carried by CI required check <name>` / `uncovered` form instead of a result, leaving the boundary green.

## Stop-the-Line (when either tier fails)

`../workflow/execution-loop.md` § *Stop-the-Line* is the rule and its triage order. In code: localize with `git bisect` where the failure is a regression, and fix the root cause, not the symptom (fix the JOIN, not the UI deduplication).

Guard against recurrence with a regression test that fails without the fix and passes with it, proving the red half before the fix lands wherever that order is yours (`./execution.md` § *Prove-It pattern*). Never edit the shared tree back to the broken state to get that red, and never `git stash` for it (`./rules.md` forbids mutating Git state unasked). Use a throwaway `git worktree` (detached with `--detach`, no branch, no commit) seeded from the shared tree as `../workflow/parallel-batch.md`'s batches are, the fix withheld and the test carried in, and remove it after. A red from an absent test or a missing module is not the red half. Where even that is unavailable, record the guard as proved forward-only, a gap the report surfaces rather than a cleared step.

## Integration assertions

At each consumer-declared integration-assertion gate, run every named assertion and exercise every named end-to-end flow end to end, never assuming it holds because unit tests pass. Assertion evidence and boundary evidence stay distinct; neither replaces the other. A failed assertion is Stop-the-Line, and a recovery that changes the work product runs a fresh health boundary before the run is presented.

The acceptance gate on code goals, drift spot-checks and `(external)` goals included: `./acceptance-gate.md`.

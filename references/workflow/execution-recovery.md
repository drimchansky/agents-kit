# Execution Recovery and Scope Changes

The execution loop's failure path, split out of `./execution-loop.md` — the evidence lifecycle that
continues its § *Health boundaries*, the green control an isolation needs, and the scope-change rules.
Read it when isolating or reusing evidence across a failure, rollback, or parallel batch, or when the
work reveals the unit or plan is wrong.

## Evidence lifecycle

- **Serial success** — implement a unit, prove its outcome immediately, and continue while health is
  pending; run a required integration assertion at its own cadence, and at the declared boundary let
  the boundary's recipe pass on the accumulated tree so health becomes current.
- **Parallel batch success** — in consumer order, incorporate each unit or run its declared serial
  fallback, prove only that unit's outcome on the integrated tree as the intake requires
  (`./executor-contract.md` § *Write-mode routing*), and record its incorporated change set. After
  all executor worktrees are removed, run the boundary's recipe once where the consumer's declared
  boundary places it; no unit merge runs the recipe on its own.
- **Unit-outcome failure** — Stop-the-Line before recording that outcome or starting another unit;
  repair it, then prove the outcome on the coordinator's own tree — a report of failure is never
  evidence the intake accepts (`./executor-contract.md` § *Write-mode routing*) — before it can
  continue toward a boundary.
- **Health-boundary failure** — Stop-the-Line with all earlier outcome evidence still distinct from
  the failed integrated-health claim; repair the shared tree, re-prove affected outcomes, and rerun
  the boundary's recipe at its resolved scope.
- **Integration-assertion failure** — Stop-the-Line with the assertion failure distinct from health;
  repair the named end-to-end outcome, rerun the assertion, and run a fresh boundary if the recovery
  changed the work product.
- **Unchanged-tree presentation** — within the same run, when no code changed since the final
  successful boundary, its health evidence remains current; do not rerun it merely to present. If
  code changed, run the final boundary first. Across runs, apply the exact-identity rule in
  `./execution-loop.md` § *Health boundaries*.

**Isolating a failure needs a green control.** A recovery that replays subsets of the work to find
what broke — the dependency-closed groups `fix-findings` rebuilds from its baseline, or any
equivalent — may read "this subset fails" as evidence only when the predicate under test is **green
on the control state the replay starts from**. A predicate already red on that control fails for a
reason the replay did not cause, and then every subset reads as implicated: a unit's own outcome
criterion tested against a baseline that predates that unit's change set is red by construction, so
isolating with it implicates work that was never at fault. Establish the control first — for a
health command, the concrete set of targets its invocation resolved on the tree it ran on, rerun at
the baseline with those targets named explicitly so that only the tree changes, never the selecting
command re-evaluated there, which recomputes against a tree predating the change and so selects
nothing or something else; for a unit's outcome, the baseline plus that unit's own change set — and
only then does "fails alone" name a culprit.

**A named target the control tree does not carry is excluded from the rerun.** This is the same
invariant read the other way: the replay changes the tree and nothing else, so a target the work
*added* is not an argument the control can take, and naming it there makes the runner exit on a
missing path — an exit that is red for a reason the control never had, which is precisely the
false-red this section exists to prevent. Exclude such targets, and where the exclusion empties the
target set the comparison is **inconclusive** rather than matching or green: nothing was tested, so
nothing is established either way. Every replay site inherits this — the health-command control
above, and each dependency-closed group replayed under it.

## Scope changes mid-execution

Sometimes the work reveals that what you set out to build is wrong — a unit is infeasible, the scope
was wrong, a new unit is needed, or one turns out too large to land in a single slice.

- **Stop and surface it.** Don't silently work around it: a silent deviation makes the record
  worthless and takes the decision away from the user.
- **Don't absorb adjacent work because you're already here.** Either revise the scope explicitly, or
  treat the new work as separate.
- **Record the divergence** per the **Record** binding, including _why_ it changed.

**When a unit is too big to land in one slice**, split it: a **vertical slice** (one complete path
end to end, preferred), **contract-first** (define the interface or agreement first, then build
against it), or **risk-first** (tackle the most uncertain piece first, so a failure surfaces early).
When the domain is code, `../engineering/execution.md` details these, with the
~100-lines-before-outcome-check rule of thumb.

# Execution Recovery and Scope Changes

The execution loop's failure path: the evidence lifecycle that continues `./execution-loop.md` § *Health boundaries*, the green control an isolation needs, and the scope-change rules.

## Evidence lifecycle

- **Serial success**: prove each unit's outcome immediately and continue while health is pending; at the declared boundary the recipe passes on the accumulated tree and health becomes current.
- **Parallel batch success**: in consumer order, incorporate each unit or run its serial fallback, prove only that unit's outcome on the integrated tree as the intake requires (`./executor-contract.md` § *Write-mode routing*), and record its incorporated change set. After all executor worktrees are removed, run the recipe once where the consumer's boundary places it; no unit merge runs it on its own.
- **Unit-outcome failure**: Stop-the-Line before recording that outcome or starting another unit; repair it, then prove the outcome on the coordinator's own tree. A report of failure is never evidence the intake accepts.
- **Health-boundary failure**: Stop-the-Line, keeping earlier outcome evidence distinct from the failed health claim; repair the shared tree, re-prove affected outcomes, and rerun the recipe at its resolved scope.
- **Integration-assertion failure**: Stop-the-Line, keeping the assertion failure distinct from health; repair the named outcome, rerun the assertion, and run a fresh boundary if the recovery changed the work product.
- **Unchanged-tree presentation**: within one run, evidence from the final successful boundary stays current while no work product changes; if one changed, run the final boundary first. Across runs, apply `./execution-loop.md` § *Health boundaries*.

**Isolating a failure needs a green control.** A recovery that replays subsets of the work to find what broke (the dependency-closed groups `fix-findings` rebuilds from its baseline, or any equivalent) may read "this subset fails" as evidence only when the predicate under test is **green on the control state the replay starts from**; a predicate already red there implicates every subset. Establish the control first: for a health check, repeat its command or procedure at the baseline over the concrete targets it resolved on the shared tree, never a selector re-evaluated there; for a unit's outcome, use the baseline plus that unit's own change set.

**A named local target the control tree does not carry is excluded from the rerun**, since a target the work *added* makes the runner exit on a missing path. Where the exclusion empties the target set the comparison is **inconclusive**, neither matching nor green. Every replay site inherits this.

## Scope changes mid-execution

When the work reveals that a unit is infeasible, the scope was wrong, a new unit is needed, or one is too large for a single slice:

- **Surface the divergence.** Take unresolved impactful changes through `../../CORE_RULES.md` § *Ask Before Assuming* before dependent revisions or work.
- **Do not absorb adjacent work because you're already here.** Revise the scope explicitly, or treat the new work as separate.
- **Record the divergence** per the **Record** binding, including why it changed.

**When a unit is too big for one slice**, split it: a **vertical slice** (one complete path end to end, preferred), **contract-first** (the interface first, then build against it), or **risk-first** (the most uncertain piece first). For code, `../engineering/execution.md` details these.

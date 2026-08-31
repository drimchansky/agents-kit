# fix-findings: Recovery and Delegation Mechanics

The failure-path and delegation machinery of the `fix-findings` skill — dependency-safe recovery, the red health-boundary procedure, and the executor and batch mechanics — split out of that skill's SKILL.md, which keeps the gate, the loop bindings, the capture rules, and the report. Read this file when a final-integrated outcome or a health boundary fails, or before the first delegation. A `fix-findings` § citation names a section of that SKILL.md.

## Dependency-safe recovery

Use coordinator-managed scratch copies seeded from the immutable baseline. Replay the ordered change
sets in dependency-closed groups and test the active failure predicate there. Here the post-execution
form of `fix-findings` § *The Gate: Auto vs Ask*'s definition applies: a dependency includes an explicit dependency and
overlapping or ordering-sensitive change sets; never replay a later overlapping fix alone when its patch
embeds or relies on earlier bytes.

**Establish the control before isolating**, per the green-control rule in
`./execution-recovery.md` § *Evidence lifecycle*: a subset only implicates itself when
the predicate is green on the state each replay starts from. The two predicates need different
controls, and using the wrong one implicates work that was never at fault.

- **A failed health command** — the control is the immutable baseline, already proven green by the
  comparison the boundary section runs first. Isolate with only the failed command or commands, never
  the whole recipe, each named over its resolved targets minus those the replayed state does not
  carry (`./execution-recovery.md` § *Evidence lifecycle*) — a group replayed without the change set
  that added a target must not be handed that target, or it is implicated by the omission rather than
  by its own work.
- **A failed final-integrated outcome** — the control is the baseline **plus that finding's own change
  set**, never the bare baseline, which predates the fix and so reproduces the finding's problem by
  definition. Every replayed group carries that change set and its dependency closure, and that
  finding's **full outcome tier** is what is tested — the same tier whose failure opened the
  recovery, never the criterion alone, or a tier that failed on a per-unit check leaves every
  replayed group green and implicates nobody. Replay it alone first: if that tier still fails there,
  the fix itself is inadequate — bucket that finding Fix failed and implicate no other group.

Against its own control: if one group fails alone, it is the implicated dependency group. If groups
pass alone but a combination fails, isolate the smallest supported interaction group. If the evidence remains ambiguous, implicate
and revert the whole ambiguous group rather than guessing that the most recent fix caused it. Recovery
records say whether the result was one fix, a dependency group, or an interaction group; they do not
misattribute a group failure to every member as an individual failure.

Rebuild the shared tree from the immutable baseline plus survivor change sets in original order. The
result must equal that baseline plus exactly the ultimately reported survivors, with every pre-run
byte and presence otherwise preserved and every unattributed byte held by the attribution bound of `fix-findings` § *Content baseline and immediate outcomes* — the equality is a statement about this run's own change sets, never a licence to delete what
the run did not write. Do not reverse-patch, reset, or check out user content. **A survivor whose
known dependency is in the implicated group is not a survivor**: it joins that group, is reverted
with it, and is bucketed Fix failed naming that prerequisite — the same rule the immediate path
applies to a not-yet-attempted fix (`fix-findings` § *Content baseline and immediate outcomes*), for the same reason. Replaying it onto a base missing its
prerequisite's bytes tests nothing, and the next pass would then read it as independently inadequate,
which is the cascade misattribution this section forbids. A later fix that overlaps an implicated
change set survives only when it is independently replayable or re-executable and its outcome can be
re-proved on the rebuilt base; otherwise it too remains in the implicated dependency group. **Which of
the two is permitted follows the fix's authority.** A Confirmed auto-path fix may be re-executed,
because the verdict authorizes the change rather than a particular diff. An **ask-approved** fix may
only be replayed verbatim from its recorded change set: what the user approved was an edit, these
exact bytes (`fix-findings` § *The Gate: Auto vs Ask*), and re-executing it against a different base regenerates
bytes nobody approved. An ask-approved fix that cannot be replayed verbatim is re-approved against a
freshly shown diff or bucketed Fix failed — never silently re-derived. Re-prove every survivor on
the rebuilt final tree. Remove scratch copies and captures once their evidence has been recorded;
never mutate Git state.

## Red boundary: comparison, disposition, recovery

If it is red, rerun only the failed command or commands against the immutable baseline first — each
over the **targets the boundary's invocation resolved on the shared tree**, named explicitly so that
only the tree changes, never the selecting command re-evaluated on the baseline, where it recomputes
against pre-change bytes and passes vacuously (`./execution-recovery.md` § *Evidence lifecycle*).
**A named target the baseline does not carry is excluded from that rerun**, per the same section: a
fix that adds a file — the ordinary shape of a missing-regression-test fix — resolves targets the
baseline never had, and naming one there exits on a missing path, a red the comparison itself caused
and would otherwise read as the matching baseline failure below. Where the exclusion empties a
command's target set, that command's comparison is **inconclusive**.
Rerun it in a coordinator-managed scratch copy seeded from the baseline and materialized with the
dependency and build state that command needs, so an exposed command can execute there at all; never
by moving the shared tree back to the baseline to observe it, and never a second boundary recipe
merely to compare. **Reuse or link that state from the shared tree only where no retained change set
affects it**, and re-derive it from baseline sources otherwise: a fix that touched a manifest, a
lockfile, a codegen input, or a build input leaves the shared tree's derived state downstream of
this run's own edits, and baseline sources under it are a hybrid rather than the baseline — which is
exactly the control this comparison exists to establish. A command that cannot execute in that copy,
or whose state cannot be re-derived from the baseline, yields an **inconclusive comparison** —
neither matching nor green, and never grounds for selectively implicating one fix.

Neither a matching baseline failure nor an inconclusive comparison attributes the failed boundary to
a particular fix, but they differ in what they prove, and the disposition follows that difference.

**A matching baseline failure** is positive evidence the run did not cause the red: the same command
was already failing on bytes that predate every fix. Retain the survivors and report each under
**Health uncertifiable** — its final-integrated outcome evidence, the baseline-failing command, and
that no boundary certifies this tree. They are not Fixed, since Fixed requires a green boundary; the
certifying re-review the run's **Next** points at is what resolves them. Reverting outcome-verified
work over a failure the baseline already carried would discard the user's fixes for a defect they did
not introduce.

**An inconclusive comparison** proves nothing either way — the control was never established. Restore
the shared tree to the immutable pre-run content baseline within the attribution bound of `fix-findings` § *Content baseline and immediate outcomes* and place
every still-retained attempted fix in Fix failed, naming the reason the comparison could not run.
Preserve Decided, Untouched, and earlier immediate-failure buckets; no changed-code survivor remains.
This is collection-level rollback on an unestablished control, not selective fault attribution.

If the failed command is green at baseline, use dependency-safe recovery with those failed commands
as the predicate. Rebuild from baseline plus survivors, re-prove every survivor's final-integrated
outcome, then run one fresh health boundary over that candidate, **referenced to the immutable
pre-run baseline** — a rebuilt candidate is that baseline plus a subset of change sets, so it has no
green boundary of its own to reference. Repeat when that boundary is still red. If recovery cannot
converge to a green complete boundary in this session, restore the pre-run baseline within that same
attribution bound and place every still-retained attempted fix in Fix failed with the
unresolved-health reason. Preserve Decided, Untouched, and earlier immediate-failure buckets; no
changed-code survivor remains or is reported Fixed. A fresh boundary is only for this failure
recovery; otherwise the successful boundary remains the run's one health boundary.

## Delegation mechanics

A delegated fix runs through an **executor** per the `fix-findings` binding in `./executor-contract.md` § *Bindings* — read it before the first delegation — on the engine and defaults in `./executor-routing.md` § *Write-mode engine registry*. Unflagged that engine is `native`, whose host adapter supplies those defaults; with `-x` (`fix-findings` § *Flags*) it is that registry's `cross` entry instead — no adapter loads there, so the packet carries what one would have supplied — for every fix delegated inside the same Confirmed auto-path surface (`fix-findings` § *Execution strategy: every auto-path fix delegates*), which is every such fix no posture exception keeps inline — an exception fix still runs on the coordinator, flag or no flag. Under `-x` every delegated fix runs in a coordinator-managed worktree, a serially delegated one included, per that entry's worktree-always placement. That binding fixes the packet; the point of it is that the executor sees only the packet — the finding verbatim, its root cause, the chosen fix option, the expected surface, its processing order and any known dependencies, the always-applying pack section verbatim, the engineering-pack guidance the fix's surface triggers by path — and never this session, so whatever the fix depends on has to be in it. Its immediate-outcome result is advance evidence: the coordinator takes the report through the intake in `./executor-contract.md` § *Write-mode routing* — every heading read, a failed criterion or a scope escape routed to the failure path rather than accepted — then captures the ordered change set and performs the final-integrated checks and health boundary.

**The write surface binds the executor exactly as it binds you**: working-tree code and nothing else, never staged, never committed, no other Git state mutated, and nothing written back to the findings' source — no reply, no resolved thread, no push. The binding restates it for the executor. Delegation is not an escape hatch from the Git-discipline rule.

**Announce and record.** Delegation is the standing posture inside that surface (`./write-mode-posture.md`), so what chat announces is any fix that stays with the coordinator and which of the three exceptions kept it there. Note the delegation and the engine that ran it inside the affected `Fixed` / `Fix failed` entry — no new bucket — and note an exception fix's exception in the same place. That record is what keeps the standing posture from decaying silently into always-inline.

**Parallel batches.** Confirmed auto-path fixes may batch only under `./parallel-batch.md` § *Coordinator-side parallel batch*; its worktree placement, frozen shared tree, complete content/presence surface checks, ordered incorporation, and cleanup bind here. The order is this skill's processing order (`fix-findings` § *The Gate: Auto vs Ask*), and each expected surface is the chosen option's stated blast radius. After every merge or declared serial fallback, re-prove that finding's full outcome tier on the integrated tree — never the criterion alone — before appending its incorporated content/presence change set — relative to the shared state immediately before it, with known dependencies — to the immutable run-baseline recovery ledger. Executor proof is advance evidence only. After all selected fixes, these ledger entries feed the final-integrated outcome sweep and the one retained-collection health boundary; a batch adds no health pass of its own.

**Failure keeps revert-and-continue intact.** An unavailable or hung batch executor, like a surface escape or a conflict, discards its worktree — which leaves the shared tree untouched, the cleanest revert available — and the fix then re-executes serially, at the placement its engine then defines, per `./parallel-batch.md` § *Coordinator-side parallel batch*: the integrated tree unflagged, and under `-x` whatever the registry's ladder leaves the unit on — a fresh coordinator-managed worktree while it is still on `cross`, the integrated tree once an unavailable or hung executor has degraded it to `native`. All four triggers reach that one path; none of them silently drops the fix. For a serial delegate, the coordinator restores the pre-fix content capture on an immediate failure — within the attribution bound of `fix-findings` § *Content baseline and immediate outcomes*, so residue the run did not write is surfaced rather than reverted — then takes the next rung: under `-x` the registry's ladder degrades the fix to `native` first, and only a `native` failure retries inline or buckets the finding Fix failed and continues. A **merge-position** integrated-outcome failure restores the exact pre-incorporation capture `fix-findings` § *Content baseline and immediate outcomes* took, buckets the finding Fix failed, and continues — at that position the incorporation is the newest delta and its capture is still in hand, so the ledger recovery's own rationale (later fixes landed on top, the capture may be gone) does not apply, and the failed unit has no ledger entry to recover from in any case (`./parallel-batch.md` § *Coordinator-side parallel batch* records a change set only after the outcome passes). A **later** final-outcome or health failure is recovered from the ordered change-set ledger and immutable baseline above, never by unapplying a patch from the live dirty tree. The absolute half holds throughout: remove worktrees before recovery and never continue with a failing fix or implicated group left in the tree.

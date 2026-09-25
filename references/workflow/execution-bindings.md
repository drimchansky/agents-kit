# Execution Loop: Consumer Bindings

The per-consumer index for `./execution-loop.md`: what each of the three consumers substitutes for the loop's six parameters. **This is the index, not the authority**; each consumer's own skill file states its bindings in full. All three present on the final current boundary rather than re-running health for the report (`./execution-acceptance.md` § *Before presenting*).

## implement-task

Bindings in `implement-task` §4, **Acceptance** in §7, record formats in §5 and §6.

- **Source**: one plan step, verified by that step's plan-authored `Verify:` line
- **Record**: the result-file section `implement-task` §5 defines (per step in step-by-step mode, one combined `## Full Run` section in full-plan mode, merged batch steps excepted), the step's checkbox flipped and linked to it, and `## Current state` rewritten after each recorded unit (`./task-authorship.md`)
- **Blocked**: the plan's `blocked` status, plus a `**Blocked:**` section in the result file naming the cause and the last health boundary that passed with what it covered, or `none` (`./task-lifecycle.md`)
- **Acceptance**: `goals.md` by `G<n>` ID, tagged and written to the result file's `## Acceptance` section
- **Health boundaries**: before every step-by-step pause; at an authored checkpoint after its integration assertions; at a natural batch bound before dependent work; at the full-plan tail immediately before acceptance; and on every later-run `in-review → done` finalization, as a fresh boundary recorded in the dated section `implement-task` §8 defines. A batch that ends at a checkpoint or at the tail shares that one boundary. A failure uses this binding's **Blocked** behavior, taking the registered `in-review → executing` edge first when finalization began from `in-review`.
- **Integration assertions**: every assertion authored by a plan `### Checkpoint after Step N`, run at that checkpoint before its health boundary, each named outcome exercised end to end

## implement

Bindings in `implement` §3; §1 frames the ask and names each item's criterion, §5 the report.

- **Source**: one item of the framed ask, verified by the criterion named when it was framed
- **Record**: the chat report at the end. **This skill writes no task-folder file and no status**; work that wants a durable record belongs in `plan-task` → `implement-task`
- **Blocked**: report what failed, what was tried, and what's needed, then stop; there is no status to set
- **Acceptance**: the framed ask, verified live and reported in chat; a gap is Stop-the-Line, not a caveat
- **Health boundaries**: at the end of the run immediately before acceptance; at every mid-run user inspection pause; and once after a fully merged batch before a dependent item starts. A tail batch shares the end-of-run boundary. A failure stops under this binding's **Blocked** behavior.
- **Integration assertions**: exercise the framed ask's end-to-end outcome whole at the end of the run

## fix-findings

One fix per unit; bindings in `fix-findings` § *Applying Fixes*.

- **Source**: one finding with its chosen fix (a Confirmed verdict's fix option, or a fix the user approved), verified by the problem the finding names no longer reproducing
- **Record**: the chat report and each concern batch's commit (`fix-findings` § *Batch commits*); no task bookkeeping or status edit. A task-folder document changes only when selected as a finding's work product
- **Blocked**: an **immediate**-outcome failure restores that fix's pre-fix capture and continues with the next finding; a pending impactful choice restores the same way and lists the finding Awaiting decision (`fix-findings` § *Content baseline and immediate outcomes*); a failed final-integrated outcome goes to the skill's dependency-safe recovery, which may revert a whole implicated group or, unconverged, restore the concern-batch baseline. Never leave a failing fix or implicated group in the tree. A failed health boundary isolates fixes only when the failed check is green at the concern-batch baseline; a matching baseline failure retains the survivors as **Health uncertifiable**; an inconclusive comparison restores the concern-batch baseline and buckets that batch's retained fixes Fix failed (`fix-findings` § *Integrated health boundary*). With batch commits on, a concern batch whose stageable retained fixes do not commit stops the run; a matching baseline failure turns them off instead (`fix-findings` § *Batch commits*)
- **Acceptance**: every selected finding in exactly one report bucket, re-read against the live tree
- **Health boundaries**: no up-front, per-finding, or per-parallel-batch health run. One boundary per concern batch on its retained-fix tree, after its final-sweep re-proof passes (`fix-findings` § *Content baseline and immediate outcomes*) and before the batch commits; a deferred finding the boundary did not certify re-proves after it: before the commit on green, before the baseline comparison on red; it runs the engineering recipe for changed code and the documentation recipe for changed prose. Every tree-changing recovery earns one fresh boundary before any survivor is Fixed (`fix-findings` § *Integrated health boundary*).
- **Integration assertions**: none within the fix run; separate code and documentation reviews assess the changed surfaces

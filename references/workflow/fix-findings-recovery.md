# fix-findings: Recovery and Delegation Mechanics

A `fix-findings` section citation refers to `skills/fix-findings/SKILL.md`.

## Dependency-safe recovery

Use coordinator-managed scratch copies seeded from the immutable concern-batch baseline (`fix-findings` § *Content baseline and immediate outcomes*). Replay the concern batch's ordered change sets in dependency-closed groups and test the active failure predicate. Dependencies include explicit dependencies and overlapping or ordering-sensitive change sets (`fix-findings` § *The Gate: Auto vs Ask*). Do not replay a later overlapping fix without earlier bytes it embeds or requires.

Establish a green control before isolating (`./execution-recovery.md` § *Evidence lifecycle*):

- **Failed health check:** use the baseline proven green by the comparison below. Repeat only failed code commands or documentation sweeps over their resolved targets, excluding targets absent from each replayed state.
- **Failed final-integrated outcome:** use the baseline plus that finding's change set and dependency closure. For a finding from an earlier concern batch, the control is the concern-batch baseline itself. Run its full outcome tier on this control and on every replayed group of the current concern batch. If the control fails, bucket that finding Retained, failing without implicating another group.

A group failing alone implicates that dependency group. Groups passing alone but failing together implicate the smallest supported interaction group. Revert the whole ambiguous group when evidence cannot distinguish its members; do not blame recency. Record whether the evidence implicates one fix, a dependency group, or an interaction group.

Rebuild the shared tree from the immutable concern-batch baseline plus survivor change sets in original order, within `fix-findings` § *Content baseline and immediate outcomes*' attribution bound. The concern batch's run-owned result must equal exactly those survivors; preserve all other baseline content and presence. Do not reverse-patch, reset, or check out user content.

A survivor requiring an implicated fix joins its failed group and names that prerequisite in Fix failed. A later overlapping fix survives only if independently replayable or re-executable and re-provable on the rebuilt base:

- A Confirmed auto-path fix may be re-executed.
- An ask-approved fix may only replay its approved change set verbatim. If that fails, obtain approval of a fresh diff, list it Awaiting decision while that approval is pending, or bucket it Fix failed (`fix-findings` § *The Gate: Auto vs Ask*).

Re-prove all survivors on the rebuilt final tree. After recording evidence, remove scratch copies and captures under the skill's write-surface rule.

## Approved decisions and changed evidence

Proceed with an unchanged approved diff within agreed boundaries.
When new evidence materially changes a consequential choice or exceeds those boundaries, apply `../../CORE_RULES.md` § *Ask Before Assuming*.
Hold dependent edits until the user decides. Changed ask-routed edits require fresh concrete-diff approval (`fix-findings` § *The Gate: Auto vs Ask*).
A choice still open at report time lists under **Awaiting decision** (`fix-findings` § *Output*).

## Red boundary: comparison, disposition, recovery

First re-prove every deferred finding (`fix-findings` § *Content baseline and immediate outcomes*). A failure takes § *Dependency-safe recovery* with the failed tier as the predicate; a recovery that changes the tree earns a fresh boundary instead of this comparison. Then repeat only failed checks against the immutable concern-batch baseline. Name the targets each boundary invocation resolved on the shared tree; do not re-evaluate its selector against baseline sources (`./execution-recovery.md` § *Evidence lifecycle*). For documentation sweeps, repeat the same link and cross-reference procedure on the resolved deliverables. Exclude targets absent from the baseline. An empty target set makes that comparison inconclusive.

Run this comparison in a coordinator-managed scratch copy, with the dependencies and build state its checks need. Keep the shared tree in place. Reuse or link derived state only when no retained change set affects it; otherwise re-derive it from baseline sources. An unexecutable check or unreconstructable state makes the comparison inconclusive. The comparison is not another full health recipe.

Apply the evidence per failed check; selective isolation requires a green control for that predicate:

- **Matching baseline failure:** retain outcome-proved survivors as **Health uncertifiable**, naming the check, targets, and final-outcome evidence. State that the tree lacks a certifying boundary; direct the user to the skill's re-review next step.
- **Inconclusive comparison:** restore the immutable concern-batch baseline within `fix-findings` § *Content baseline and immediate outcomes*' attribution bound. Bucket every still-retained attempted fix of this concern batch Fix failed, naming why comparison could not run. Retain no changed-work-product survivor.
- **Green baseline control:** use § *Dependency-safe recovery* with the failed checks. Rebuild baseline plus survivors, re-prove their final outcomes, and run a fresh complete health boundary. Take its reference and scope from `fix-findings` § *Integrated health boundary*. Repeat if red. If recovery cannot converge this session, restore the concern-batch baseline within the same attribution bound. Bucket this concern batch's remaining attempts Fix failed with the unresolved-health reason.

Collection rollback preserves earlier concern batches and the Decided, Awaiting decision, Untouched, and earlier immediate-failure buckets. Only recovery earns another health boundary; the happy path keeps one pass per concern batch.

## Delegation mechanics

Launch an **executor** on `native` under `./executor-contract.md` § *Bindings* and `./executor-routing.md` § *Write-mode engine registry*. Use the Confirmed auto-path surface from `fix-findings` § *Execution strategy: every auto-path fix delegates*.

Supply the binding's complete packet: finding verbatim, root cause, chosen option, expected surface, order, dependencies, always-applicable pack guidance verbatim, surface-specific guidance paths, and per-unit checks. Include the binding's edit-surface restriction; staging and commits stay with the coordinator. The executor receives this packet without session history.

Apply `./executor-contract.md` § *Write-mode routing* to every returned report. Reject failed criteria and scope escapes; re-prove immediate outcomes when intake requires it. Only then capture the ordered change set. The coordinator performs final-integrated checks and health.

Record delegation, engine, and parallel batch in the finding's Fixed or Fix failed entry. For an inline exception, announce and record the applicable `./write-mode-posture.md` exception.

**Parallel batches:** apply `./parallel-batch.md` § *Coordinator-side parallel batch*. Surfaces come from the chosen options' stated blast radii and must be pairwise disjoint. Follow the skill's dependency-respecting processing order for incorporation. Keep the shared tree frozen while executors run, check complete content/presence surfaces, and use the ordered merge gates.

After each incorporation, prove that finding's full outcome tier on the integrated tree before recording its delta. A worktree executor's own proof cannot substitute; serial fallbacks use intake. Append the actual content/presence delta against the immediately preceding shared state, with dependencies, to the concern batch's recovery ledger. Those entries feed its final sweep and health boundary; no parallel batch adds a health pass.

**Fallbacks:**

- An unavailable, hung, surface-escaping, or conflicting parallel-batch executor loses its worktree and re-executes serially on the integrated tree under the parallel-batch contract. Do not silently drop the fix.
- A serial delegate's immediate failure restores the pre-fix capture within the skill's attribution bound. Retry inline or bucket it Fix failed and continue independently.
- A merge-position outcome failure restores the exact pre-incorporation capture and buckets the finding Fix failed. It receives no ledger entry.
- Later final-outcome or health failures use the immutable concern-batch baseline and ordered ledger above.

Remove executor worktrees before recovery. Continue only after removing failed fixes and implicated groups from the shared tree.

# Write-Mode Executor Coordination

This file is the coordinator's side of write-mode delegation: segments, intake, proof ownership, and the consumer bindings. The executor it launches works from the companion `./executor-contract.md` and does not read this file.

## Segment launches

A segment contains consecutive units sharing context. Supply all packet items per unit, shared guidance/root/scratch directory/consumer once. Bindings define eligibility/bounds; without bounds, launch singly. Serial segments use the shared root.

End a serial segment at the first unit with a coordinator-owned required check. Complete that unit's intake before launching the remaining units in a fresh packet.

Intake runs per unit in packet order on the segment-final tree (§ *Write-mode routing*). An intake failure stops at that unit: later units remain unrecorded and unchecked. Triage their edits forward under Stop-the-Line; exclude Git unwinding and blind restoration.

After mid-segment executor failure, completed units passing intake stand. Relaunch the failing unit and unreached remainder as a fresh segment on the selected engine (`./executor-routing.md` § *Selection*). Apply the binding's fallback to the failing unit only if that relaunch fails.

## Write-mode routing

Registered `./executor-routing.md` consumers delegate unless an announced, recorded `./write-mode-posture.md` exception applies. Others use `./agent-fanout.md`, except reviews under `./reviewer-contract.md` and the secretary under `./secretary-contract.md`.

**Coordinator-only judgment:** unit framing, health boundaries, report buckets, statuses, intake, and consequential-choice selection under the user's decision.

**Intake.** Read the report before advancing the unit. Require every `./executor-contract.md` § *Evidence report* heading and substantively filled fields where work requires them. Process exit status and the reported `Outcome` do not establish completion. A missing field, inappropriate `None`, failing required check, active blocker, scope concern, or pending choice prevents advancement. `Dependency problems` entries do not prevent advancement; carry them into the coordinator's Noticed block. Apply Fallback for execution failure, asking first before an inline fallback replaces an explicitly selected external engine (`./executor-routing.md` § *External launches and recovery*), and Stop-the-Line for criterion failure. Scope escapes cannot silently retry; failure reports cannot count as passing evidence. A recovered incident permits intake when its successful replacement supplies the required evidence and no active failure remains. When intake of a launch's report ends, or the launch ends with no report, remove its scratch directory under `./agent-scratch.md` § *Cleanup*.

**Coordinator-owned checks.** Run each assigned pending check with its original assertion, passing condition, and packet root. Launch the unit's dependent successor only after its executor-owned and assigned coordinator checks pass. Advance the unit only after every required check passes. If neither party can perform a check, retain its definition and explicitly open state. An open check does not hold the successor. Take the consumer's existing pause (`./implement-task-edges.md` § *An open criterion leg* for implement-task); partial proof cannot close that leg. Ownership grants no additional permission or access.

**Interrupted execution.** After a process or host failure, inspect actual changes against the prelaunch baseline before recovery. A report, its absence, or process exit status cannot prove the tree unchanged. Preserve the consumer's recovery and attribution rules.

**A pending impactful choice is a third outcome**, neither execution failure nor criterion failure. A criterion unmet only because dependent edits were held does not fail the unit. Take `./executor-contract.md` § *Verification and fallback*: ask the user and hold that unit and its dependents. After the decision, resume under the consumer's execution rules: relaunch the unit or its held remainder with the decision in the packet's prior-decisions item and run intake on that relaunch's report. From the report that returned the choice, take only its `Changes` and `Comments added or edited` entries for edits that stayed in the tree; its criterion outcome never counts. While the answer is awaited in this run, neither Stop-the-Line nor the **Blocked** binding's stop and status effects apply; a binding's restore-on-hold rule (`fix-findings` § *Content baseline and immediate outcomes*) still runs at return. A choice still open when the run ends takes the consumer's **Blocked** binding. Record its cause with the `Pending choices` details from `./executor-contract.md` § *Evidence report*.

A pending choice does not excuse an independent failed required check, active blocker, or scope escape.

**Placement decides whose proof counts.** Shared-tree units, serial or segment on any selected engine, supply executor-owned check proof when all four evidence fields (`./executor-contract.md` § *Evidence report*) exist, roots match the packet, and the surface check passes. Accept that proof without rerunning except in the closed set below. Assigned coordinator checks still run before advancement. Worktree proof predates incorporation and requires full integrated re-proof at parallel-batch gate 3.

**Re-prove shared-tree outcomes only when:** an executed check lacks any required field (`./executor-contract.md` § *Evidence report*); its command or procedure differs from its packet definition; its reported status contradicts its output or observations; its root differs; the surface check is unavailable; or this is the run's first delegated unit on its engine. Run the full outcome tier (`./execution-loop.md` § *Two verification tiers*) and record that proof instead. A first delegated unit in a worktree pays this calibration through its integrated re-proof; the subsequent first shared-tree unit on that engine needs no extra calibration. Invisible changes have not landed.

**Surface check.** Use declared paths, else resolve the stated scope to paths before launch; no resolvable paths makes the check unavailable. Capture the shared tree before launch, once per segment:

`node <kit-root>/scripts/worktree-merge.ts baseline <shared-tree> --out <session scratch>/unit-<n>.json`

Resolve `<kit-root>` via `./task-store.md` § *Resolving `<kit-root>`*. Set `<session scratch>` to the shared scratch root (`./agent-scratch.md` § *Session-owned scratch*), outside every assigned directory. On return, inspect `Changes` first; an outside entry takes the failure path before invoking the script. Then run `check <shared-tree> --baseline <that manifest> --surface <each path>` against the segment's surface union. Attribute changes per unit from `Changes`. Exit 0 passes; 1 means escape; 2 or unavailable kit root requires re-proof (`../scripts/worktree-merge.md`). Serial re-execution owes the same check against its own pre-unit capture.

Record proof ownership by check, distinguishing assigned coordinator checks from re-proofs, plus changed file:lines under the consumer binding. Keep pending/open checks explicit; engine and recovery evidence follow `./executor-routing.md` § *External launches and recovery*. Concurrency: `./parallel-batch.md`.

## Bindings

### implement-task

One plan step from a task folder.

- **Unit:** the step, verified against its Verify line.
- **Segment bound:** full-plan segments span consecutive dependency-ordered steps between checkpoints or a plan edge and checkpoint. A single step is a segment of one. Parallel-eligible steps leave the segment for a batch; step-by-step mode launches separately.
- **Packet:** What/Verify text, cited goals in full, edit surface, relevant context, and absolute task-folder path. Include applicable GROUP_CONTEXT sources identified by selected root and root-relative path (`./task-store.md` § *Shared group context*); supply outside-root content verbatim. Domain comes from CONTEXT's Domain header, default engineering.
- **Edit surface:** the `implement-task` entry in `./executor-contract.md` § *Consumers*.
- **Fallback:** inline for serial steps; serial re-execution for batch steps.
- **Merge order:** plan order.

### implement

One session-framed item; no task folder exists.

- **Unit:** the item and criterion framed by implement §1.
- **Packet:** item, criterion, edit surface, original user ask, and session grounding unavailable to the executor. Use the session's inferred domain.
- **Edit surface:** the `implement` entry in `./executor-contract.md` § *Consumers*.
- **Fallback:** inline execution.
- **Merge order:** frame order.

### fix-findings

One selected finding's immediate working-tree fix, delegated once its change is settled: an Auto fix, or an Ask fix after the user picks its option.

- **Unit:** the fix, verified by the reported problem no longer reproducing. § *Write-mode routing* decides immediate proof ownership. The coordinator re-proves the retained findings each concern batch's final sweep selects, plus any deferred finding its boundary did not certify, on its final tree (`fix-findings` § *Content baseline and immediate outcomes*) and owns that batch's health and commit, or its coalesced group's.
- **Packet:** finding verbatim with source severity/file:line, root cause, chosen fix, expected surface from its blast radius, processing order, and dependencies. A picked option takes the same packet as an Auto fix: the picked option is the chosen fix, and the prior-decisions item carries the user's pick. Supply engineering, documentation, or both domain recipes according to the chosen edit surface, not the finding anchor.
- **Edit surface:** the `fix-findings` entry in `./executor-contract.md` § *Consumers*.
- **Picked-option intake:** before recording a picked option's change set, compare the report's `Changes` with the picked option. On a mismatch, restore the pre-fix capture and take the pending-choice path in `fix-findings` § *Content baseline and immediate outcomes*.
- **Fallback:** serial re-execution for batch fixes, inline for serial delegates. Report failed executors, discard their worktrees, and re-execute on the integrated tree. Recovery baselines, captures, restoration, ordered changes, and rebuilds follow `./fix-findings-recovery.md` and fix-findings § *Content baseline and immediate outcomes*. Exclude Git reset, checkout, and reverse-patch recovery. Independent survivors continue after one failure.
- **Merge order:** concern-batch order, then severity within dependency order. Ordered changes document recovery and bound what each batch or group commit stages.

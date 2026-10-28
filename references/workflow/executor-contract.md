# Write-Mode Executor Contract

Execute the supplied unit/segment and return evidence (§ *Bindings*, § *Segment launches*). Host defaults/engine: `./executor-routing.md`; probes: `./agent-fanout.md`.

## Launch packet

The coordinator supplies:

- Unit text, verify criterion, and the full text of cited completion contracts.
- Exact edit paths, or the unit's stated scope.
- Context unavailable to the executor, with absolute paths. For reachable files, give paths and non-obvious facts; otherwise provide verbatim content.
- Relevant `../../CORE_RULES.md` § *Ask Before Assuming* text verbatim, plus prior user decisions and agreed boundaries.
- The entry template and dependency-problem paragraphs of `../../CORE_RULES.md` § *NOTICED BUT NOT TOUCHING*, verbatim.
- Domain guidance: universal per-unit sections verbatim, including code-style Comments for code and documentation's link sweep for documents; overlays/triggered pack files as absolute paths, or explicit `none`.
- Required checks: the criterion and every domain per-unit check (`./execution-loop.md` § *Two verification tiers*). Each names its owner (`executor` by default, or `coordinator`), exact command/procedure, assertion, passing condition, absolute execution root, and needed capability. Preserve assertions and passing conditions when assigning ownership or retargeting paths. Every check leaves the runner's cache on (`../engineering/boundary-scope.md` § *Never disable the runner's cache*).
- One absolute effective root and its placement (§ *Execution boundaries*).
- Consumer label selecting a binding below. Supply all context; interpreting the packet requires no skill/consumer-definition fetch.

Report missing/ambiguous items or unregistered packets without editing. Infer no root from adapter, installation, or shell.

## Execution boundaries

Placement is independent of engine. Serial units use the shared tree; eligible parallel units use coordinator-managed worktrees (`./parallel-batch.md`).

- Work within the effective root; creating, switching, or substituting worktrees is coordinator-only.
- Edit only the packet's surface. Report a needed outside edit as an attempted scope escape.
- Change work products only; records, statuses, and completion verdicts remain with the coordinator.
- Apply the effective root's instruction hierarchy and packet guidance before editing. Exclude adjacent cleanup and unlisted units; execute segment units in packet order.
- Return unresolved impactful choices to the coordinator before dependent edits. Continue independent authorized work under the supplied decision rule.
- Live sandbox, approval, and managed security policies override adapter defaults and this contract. Preserve those boundaries. On denied writing or verification, stop and report a blocker without requesting or assuming broader access.

## Verification and fallback

Run only required checks assigned to the executor at the effective root; fix and rerun failures within scope. Report coordinator-owned checks as pending, retaining their packet definitions. Prove each unit's executor-owned checks before its successor; failure ends the segment with completed evidence returned. Coordinator checks bound the segment below. Health remains coordinator-only.

Report execution blockers without changing root/scope. The coordinator applies the binding's fallback. A check the packet declared open is not an execution blocker; it takes the open-check pause under § *Write-mode routing* → **Coordinator-owned checks**.

Pending impactful choices require user input under `../../CORE_RULES.md` § *Ask Before Assuming*.
Fallback cannot select an option, authorize dependent work, or establish completion while that choice remains pending.

## Evidence report

Use the same report for native and external execution. Report each unit in packet order. Include every heading, using `None` for empty fields except `Outcome`:

- `Outcome`: `ready` means ready for coordinator intake, never accepted completion. Use `blocked` when execution or required verification cannot proceed, apart from checks the packet declared open. Use `needs-decision` for work held on an impactful choice. Use `not-started` for unreached work, naming what prevented its start.
- `Commands run`: every command/tool action materially reading, changing, or verifying the unit.
- `Changes`: each changed `file:line` and its change.
- `Comments added or edited`: each comment and its non-obvious invariant.
- `Verification`: retain each required check's packet definition and identify its proof owner. Executed checks give the exact command/procedure, raw output or observable results, exit status or pass/fail result, and absolute execution root. All four are required evidence. Label assigned coordinator checks `pending`; checks unavailable to both parties remain `open`, naming the missing capability.
- `Sources consulted`: external sources, linked where available.
- `Dependency problems`: material out-of-scope dependency problems met during the unit, including those a rerun cleared or a recovered incident overcame. Use the entry shape the packet supplies from `../../CORE_RULES.md` § *NOTICED BUT NOT TOUCHING*.
- `Blockers or attempted scope escapes`: active denials, missing capabilities, host failures, outstanding required-check failures, and outside edits considered or made.
- `Pending choices`: researched viable options, material trade-offs, a reasoned recommendation, and the held dependent work.
- `Recovered incidents`: failures of a tool or step that no required check names, overcome within the authorized packet, with successful replacement evidence under `Verification`. A required check stays under `Blockers or attempted scope escapes` while the latest run of its unchanged packet definition fails. A failure that rerun cleared needs no entry beyond `Commands run` and the passing run under `Verification`. A dependency problem behind it still takes a `Dependency problems` entry.

Keep security denials, scope concerns, pending choices, and outstanding required-check failures in their active fields, and dependency problems under `Dependency problems`. A recovered incident cannot conceal them.
`ready` may include pending checks only when explicitly assigned to the coordinator, and open checks only when the packet declared them open. Every other executor-owned check must pass; failed or unassigned checks cannot be deferred as coordinator work.

Send the report only as the coordinator reply. Make no completion claims, status updates, or report-file writes.

## Segment launches

A segment contains consecutive units sharing context. Supply all packet items per unit, shared guidance/root/consumer once. Bindings define eligibility/bounds; without bounds, launch singly. Serial segments use the shared root.

End a serial segment at the first unit with a coordinator-owned required check. Complete that unit's intake before launching the remaining units in a fresh packet.

Intake runs per unit in packet order on the segment-final tree (§ *Write-mode routing*). An intake failure stops at that unit: later units remain unrecorded and unchecked. Triage their edits forward under Stop-the-Line; exclude Git unwinding and blind restoration.

After mid-segment executor failure, completed units passing intake stand. Relaunch the failing unit and unreached remainder as a fresh segment on the selected engine (`./executor-routing.md` § *Selection*). Apply the binding's fallback to the failing unit only if that relaunch fails.

## Write-mode routing

Registered `./executor-routing.md` consumers delegate unless an announced, recorded `./write-mode-posture.md` exception applies. Others use `./agent-fanout.md`, except reviews under `./reviewer-contract.md` and the secretary under `./secretary-contract.md`.

**Coordinator-only judgment:** unit framing, health boundaries, report buckets, statuses, intake, and consequential-choice selection under the user's decision.

**Intake.** Read the report before advancing the unit. Require every § *Evidence report* heading and substantively filled fields where work requires them. Process exit status and the reported `Outcome` do not establish completion. A missing field, inappropriate `None`, failing required check, active blocker, scope concern, or pending choice prevents advancement. `Dependency problems` entries do not prevent advancement; carry them into the coordinator's Noticed block. Apply Fallback for execution failure, asking first before an inline fallback replaces an explicitly selected external engine (`./executor-routing.md` § *External launches and recovery*), and Stop-the-Line for criterion failure. Scope escapes cannot silently retry; failure reports cannot count as passing evidence. A recovered incident permits intake when its successful replacement supplies the required evidence and no active failure remains.

**Coordinator-owned checks.** Run each assigned pending check with its original assertion, passing condition, and packet root. Launch the unit's dependent successor only after its executor-owned and assigned coordinator checks pass. Advance the unit only after every required check passes. If neither party can perform a check, retain its definition and explicitly open state. An open check does not hold the successor. Take the consumer's existing pause (`./implement-task-edges.md` § *An open criterion leg* for implement-task); partial proof cannot close that leg. Ownership grants no additional permission or access.

**Interrupted execution.** After a process or host failure, inspect actual changes against the prelaunch baseline before recovery. A report, its absence, or process exit status cannot prove the tree unchanged. Preserve the consumer's recovery and attribution rules.

**A pending impactful choice is a third outcome**, neither execution failure nor criterion failure. A criterion unmet only because dependent edits were held does not fail the unit. Take § *Verification and fallback*: ask the user and hold that unit and its dependents. After the decision, resume under the consumer's execution rules: relaunch a still-delegable unit or its held remainder with the decision in the packet's prior-decisions item and run intake on that relaunch's report; where the binding keeps the chosen option with the coordinator, apply it there after approval of its concrete change (`fix-findings` § *The Gate: Auto vs Ask*, § *Execution strategy: every auto-path fix delegates*). From the report that returned the choice, take only its `Changes` and `Comments added or edited` entries for edits that stayed in the tree; its criterion outcome never counts. While the answer is awaited in this run, neither Stop-the-Line nor the **Blocked** binding's stop and status effects apply; a binding's restore-on-hold rule (`fix-findings` § *Content baseline and immediate outcomes*) still runs at return. A choice still open when the run ends takes the consumer's **Blocked** binding, naming the choice, its options and recommendation, and the held work as the cause.

A pending choice does not excuse an independent failed required check, active blocker, or scope escape.

**Placement decides whose proof counts.** Shared-tree units, serial or segment on any selected engine, supply executor-owned check proof when all four evidence fields exist, roots match the packet, and the surface check passes. Accept that proof without rerunning except in the closed set below. Assigned coordinator checks still run before advancement. Worktree proof predates incorporation and requires full integrated re-proof at parallel-batch gate 3.

**Re-prove shared-tree outcomes only when:** an executed check lacks any required field; its command or procedure differs from its packet definition; its reported status contradicts its output or observations; its root differs; the surface check is unavailable; or this is the run's first delegated unit on its engine. Run the full outcome tier (`./execution-loop.md` § *Two verification tiers*) and record that proof instead. A first delegated unit in a worktree pays this calibration through its integrated re-proof; the subsequent first shared-tree unit on that engine needs no extra calibration. Invisible changes have not landed.

**Surface check.** Use declared paths, else resolve the stated scope to paths before launch; no resolvable paths makes the check unavailable. Capture the shared tree before launch, once per segment:

`node <kit-root>/scripts/worktree-merge.ts baseline <shared-tree> --out <scratch>/unit-<n>.json`

Resolve `<kit-root>` via `./task-store.md` § *Resolving `<kit-root>`*. On return, inspect `Changes` first; an outside entry takes the failure path before invoking the script. Then run `check <shared-tree> --baseline <that manifest> --surface <each path>` against the segment's surface union. Attribute changes per unit from `Changes`. Exit 0 passes; 1 means escape; 2 or unavailable kit root requires re-proof (`../scripts/worktree-merge.md`). Serial re-execution owes the same check against its own pre-unit capture.

Record proof ownership by check, distinguishing assigned coordinator checks from re-proofs, plus changed file:lines under the consumer binding. Keep pending/open checks explicit; engine and recovery evidence follow `./executor-routing.md` § *External launches and recovery*. Concurrency: `./parallel-batch.md`.

## Bindings

Only these consumers issue coordinator packets.

### implement-task

One plan step from a task folder.

- **Unit:** the step, verified against its Verify line.
- **Segment bound:** full-plan segments span consecutive dependency-ordered steps between checkpoints or a plan edge and checkpoint. A single step is a segment of one. Parallel-eligible steps leave the segment for a batch; step-by-step mode launches separately.
- **Packet:** What/Verify text, cited goals in full, edit surface, relevant context, and absolute task-folder path. Include applicable GROUP_CONTEXT sources identified by selected root and root-relative path (`./task-store.md` § *Shared group context*); supply outside-root content verbatim. Domain comes from CONTEXT's Domain header, default engineering.
- **Edit surface:** Touches paths, else What's scope. Exclude task folders/records and GROUP_CONTEXT files; grounding corrections and records belong to the coordinator.
- **Fallback:** inline for serial steps; serial re-execution for batch steps.
- **Merge order:** plan order.

### implement

One session-framed item; no task folder exists.

- **Unit:** the item and criterion framed by implement §1.
- **Packet:** item, criterion, edit surface, original user ask, and session grounding unavailable to the executor. Use the session's inferred domain.
- **Edit surface:** declared paths, else stated scope. Write work only; the coordinator's chat is the sole record.
- **Fallback:** inline execution.
- **Merge order:** frame order.

### fix-findings

One Confirmed finding's immediate working-tree fix.

- **Unit:** the fix, verified by the reported problem no longer reproducing. § *Write-mode routing* decides immediate proof ownership. The coordinator re-proves the retained findings each concern batch's final sweep selects, plus any deferred finding its boundary did not certify, on its final tree (`fix-findings` § *Content baseline and immediate outcomes*) and owns that batch's health and commit, or its coalesced group's.
- **Packet:** finding verbatim with source severity/file:line, root cause, chosen fix, expected surface from its blast radius, processing order, and dependencies. Supply engineering, documentation, or both domain recipes according to the chosen edit surface, not the finding anchor.
- **Edit surface:** selected working-tree code and documentation within the packet's surface. No staging, commits, other Git mutation, findings-report edits, source replies/resolution/push, or live-page writes. The coordinator's chat report and each concern batch's commit, or the run's one commit under `-1`, are the record.
- **Outside the delegation surface:** the coordinator applies ask-routed fixes from its approved diff inline. Withdrawn and Inconclusive findings receive no edits.
- **Fallback:** serial re-execution for batch fixes, inline for serial delegates. Report failed executors, discard their worktrees, and re-execute on the integrated tree. Recovery baselines, captures, restoration, ordered changes, and rebuilds follow `./fix-findings-recovery.md` and fix-findings § *Content baseline and immediate outcomes*. Exclude Git reset, checkout, and reverse-patch recovery. Independent survivors continue after one failure.
- **Merge order:** concern-batch order, then severity within dependency order. Ordered changes document recovery and bound what each batch or group commit stages.

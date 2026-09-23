# Write-Mode Executor Contract

Execute the supplied unit/segment and return evidence (§ *Bindings*, § *Segment launches*). Host defaults/engine: `./executor-routing.md`; probes: `./agent-fanout.md`.

## Launch packet

The coordinator supplies:

- Unit text, verify criterion, and the full text of cited completion contracts.
- Exact edit paths, or the unit's stated scope.
- Context unavailable to the executor, with absolute paths. For reachable files, give paths and non-obvious facts; otherwise provide verbatim content.
- Relevant `../../CORE_RULES.md` § *Ask Before Assuming* text verbatim, plus prior user decisions and agreed boundaries.
- Domain guidance: universal per-unit sections verbatim, including code-style Comments for code and documentation's link sweep for documents; overlays/triggered pack files as absolute paths, or explicit `none`.
- Per-unit checks as commands/procedures beside the criterion (`./execution-loop.md` § *Two verification tiers*), or `none`. Code units check touched comments against the packet and format touched files (`../engineering/verification.md` § *Two verification tiers*).
- One absolute effective root and its placement (`./executor-routing.md` § *Write-mode engine registry*).
- Consumer label selecting a binding below. Supply all context; interpreting the packet requires no skill/consumer-definition fetch.

Report missing/ambiguous items or unregistered packets without editing. Infer no root from adapter, installation, or shell.

## Execution boundaries

- Work within the effective root; creating, switching, or substituting worktrees is coordinator-only.
- Edit only the packet's surface. Report a needed outside edit as an attempted scope escape.
- Change work products only; records, statuses, and completion verdicts remain with the coordinator.
- Apply the effective root's instruction hierarchy and packet guidance before editing. Exclude adjacent cleanup and unlisted units; execute segment units in packet order.
- Return unresolved impactful choices to the coordinator before dependent edits. Continue independent authorized work under the supplied decision rule.
- Live sandbox, approval, and managed security policies override adapter defaults and this contract. Preserve those boundaries. On denied writing or verification, stop and report a blocker without requesting or assuming broader access.

## Verification and fallback

Run only criterion/packet checks at the effective root; fix and rerun failures within scope. Prove each unit before its successor; failure ends the segment with completed evidence returned. Health remains coordinator-only.

Report execution blockers without changing root/scope. The coordinator applies the binding's fallback.

Pending impactful choices require user input under `../../CORE_RULES.md` § *Ask Before Assuming*.
Fallback cannot select an option, authorize dependent work, or establish completion while that choice remains pending.

## Evidence report

Report each unit in packet order; label unreached units `not started`. Include every heading, using `None` for empty fields:

- `Commands run`: every command/tool action materially reading, changing, or verifying the unit.
- `Changes`: each changed `file:line` and its change.
- `Comments added or edited`: each comment and its non-obvious invariant.
- `Verification`: each criterion/check's exact command or procedure, raw output or observable results, exit status or pass/fail result, and absolute execution root. All four are required evidence.
- `Sources consulted`: external sources, linked where available.
- `Blockers or attempted scope escapes`: denials, missing capabilities, host failures, outside edits considered, and pending impactful choices.
  For choices, give researched viable options, material trade-offs, a reasoned recommendation, and the held dependent work.

Send the report only as the coordinator reply. Make no completion claims, status updates, or report-file writes.

## Segment launches

A segment contains consecutive units sharing context. Supply all packet items per unit, shared guidance/root/consumer once. Bindings define eligibility/bounds; without bounds, launch singly. Serial segments use the shared root.

Intake runs per unit in packet order on the segment-final tree (§ *Write-mode routing*). An intake failure stops at that unit: later units remain unrecorded and unchecked. Triage their edits forward under Stop-the-Line; exclude Git unwinding and blind restoration.

After mid-segment executor failure, completed units passing intake stand. Relaunch the failing unit and unreached remainder as a fresh native segment. Apply the binding's fallback to the failing unit only if that relaunch fails.

## Write-mode routing

Registered `./executor-routing.md` consumers delegate unless an announced, recorded `./write-mode-posture.md` exception applies. Others use `./agent-fanout.md`, except reviews under `./reviewer-contract.md`.

**Coordinator-only judgment:** unit framing, health boundaries, report buckets, statuses, intake, and consequential-choice selection under the user's decision.

**Intake.** Read the report before advancing the unit. Require every § *Evidence report* heading and substantively filled fields where work requires them. A missing field, inappropriate `None`, failing check, or blocker/scope-escape entry prevents advancement. Apply Fallback for execution failure and Stop-the-Line for criterion failure. Scope escapes cannot silently retry; failure reports cannot count as passing evidence.

**A pending impactful choice is a third outcome**, neither execution failure nor criterion failure. A criterion unmet only because dependent edits were held does not fail the unit. Take § *Verification and fallback*: ask the user and hold that unit and its dependents. After the decision, resume under the consumer's execution rules: relaunch a still-delegable unit or its held remainder with the decision in the packet's prior-decisions item and run intake on that relaunch's report; where the binding keeps the chosen option with the coordinator, apply it there after approval of its concrete change (`fix-findings` § *The Gate: Auto vs Ask*, § *Execution strategy: every auto-path fix delegates*). From the report that returned the choice, take only its `Changes` and `Comments added or edited` entries for edits that stayed in the tree; its criterion outcome never counts. While the answer is awaited in this run, neither Stop-the-Line nor the **Blocked** binding's stop and status effects apply; a binding's restore-on-hold rule (`fix-findings` § *Content baseline and immediate outcomes*) still runs at return. A choice still open when the run ends takes the consumer's **Blocked** binding, naming the choice, its options and recommendation, and the held work as the cause.

**Placement decides whose proof counts.** Shared-tree native units, serial or segment, supply their outcome proof when all four check fields exist, roots match, and the surface check passes. Accept without rerunning except in the closed set below. Worktree proof predates incorporation and requires full integrated re-proof at parallel-batch gate 3.

**Re-prove shared-tree outcomes only when:** a check lacks any required field; its reported status contradicts its output or observations; its root differs; the surface check is unavailable; or this is the run's first delegated unit. Run the full outcome tier (`./execution-loop.md` § *Two verification tiers*) and record that proof instead. A first delegated unit in a worktree pays this calibration through its integrated re-proof; the subsequent first shared-tree unit needs no extra calibration. Invisible changes have not landed.

**Surface check.** Use declared paths, else resolve the stated scope to paths before launch; no resolvable paths makes the check unavailable. Capture the shared tree before launch, once per segment:

`node <kit-root>/scripts/worktree-merge.ts baseline <shared-tree> --out <scratch>/unit-<n>.json`

Resolve `<kit-root>` via `./task-store.md` § *Resolving `<kit-root>`*. On return, inspect `Changes` first; an outside entry takes the failure path before invoking the script. Then run `check <shared-tree> --baseline <that manifest> --surface <each path>` against the segment's surface union. Attribute changes per unit from `Changes`. Exit 0 passes; 1 means escape; 2 or unavailable kit root requires re-proof (`../scripts/worktree-merge.md`). Serial re-execution owes the same check against its own pre-unit capture.

Record proof ownership, changed file:lines, and engine under the consumer binding; default launches may omit engine. Concurrency: `./parallel-batch.md`.

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

- **Unit:** the fix, verified by the reported problem no longer reproducing. § *Write-mode routing* decides immediate proof ownership. The coordinator rechecks all retained findings on the final tree and owns retained-collection health.
- **Packet:** finding verbatim with source severity/file:line, root cause, chosen fix, expected surface from its blast radius, processing order, and dependencies. Supply engineering, documentation, or both domain recipes according to the chosen edit surface, not the finding anchor.
- **Edit surface:** selected working-tree code and documentation within the packet's surface. No staging, commits, other Git mutation, findings-report edits, source replies/resolution/push, or live-page writes. The coordinator's chat is the sole record.
- **Outside the delegation surface:** the coordinator applies ask-routed fixes from its approved diff inline. Withdrawn and Inconclusive findings receive no edits.
- **Fallback:** serial re-execution for batch fixes, inline for serial delegates. Report failed executors, discard their worktrees, and re-execute on the integrated tree. Recovery baselines, captures, restoration, ordered changes, and rebuilds follow `./fix-findings-recovery.md` and fix-findings § *Content baseline and immediate outcomes*. Exclude Git reset, checkout, and reverse-patch recovery. Independent survivors continue after one failure.
- **Merge order:** severity within dependency order. Ordered changes document recovery, not Git staging or commits.

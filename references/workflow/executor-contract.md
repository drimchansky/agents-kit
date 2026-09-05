# Write-Mode Executor Contract

This is the host-neutral contract for a write-mode executor. An executor carries out exactly one coordinator-supplied unit of work — or, on a **segment launch** (§ *Segment launches*), one packet-supplied ordered list of units — and returns evidence to the coordinator. What a unit is, what the packet carries, and what the executor may edit are per-consumer — the `## Bindings` at the end name them. Host adapters select native model, effort, and permission defaults, then load their installed copy of this contract.

This file carries the whole write-mode side of agent fan-out: the executor-facing contract below, then the routing its satellite `./executor-routing.md` owns — which consumers may launch an executor at all, and the engine they may launch it on. Read-only fan-out is not here — the probe contract and the merge contract are `./agent-fanout.md`.

## Launch packet

Treat the coordinator's launch prompt as the source of truth. It supplies:

- the unit of work's text and its verify criterion, plus the full text of whatever the unit cites as its contract for done;
- the exact edit surface: the paths the unit declares when it declares them, otherwise the scope the unit itself states;
- the context the unit depends on and the executor cannot see for itself, with absolute paths for everything it names. Paths and derived facts, not pre-read file contents: the executor reads the effective root itself, so a file under that root travels as its path plus whatever non-obvious fact the coordinator established about it, and verbatim content is reserved for what the executor cannot reach — session-established decisions, user answers, content outside the effective root;
- the domain guidance governing the unit, delivered two ways: any section the domain applies to every unit of this kind — such as engineering's `code-style.md` → Comments for a code-writing unit — travels verbatim in the packet, its full section text, so what always applies costs the executor no read hop; the active domain's rules overlay and the pack guidance the unit's work triggers travel as absolute paths to the same copies the coordinator loaded. Each binding names how its consumer resolves the domain; a domain with no pack, or none of whose files apply, is named with an explicit `none` — less guidance, never substituted guidance;
- the resolved domain's **per-unit checks** — the rest of the unit-outcome tier beside the criterion (`./execution-loop.md` § *Two verification tiers*) — as commands or procedures the executor runs and reports under `Verification`, or an explicit `none`. For code: validating the comments the unit touched against the packet's `code-style.md` → Comments text, then the project's formatter over the files it touched where one is exposed (`../engineering/verification.md` § *Two verification tiers*);
- one absolute effective working root and the placement the coordinator states for it — placement follows the unit's engine and its batching, which `./executor-routing.md` § *Write-mode engine registry* defines; the executor reads the value the packet names rather than deriving one from how the unit was delegated;
- the consumer the packet is issued under, named explicitly — it selects which binding below governs the packet. The name is a **label**, not a path to read: the packet is self-contained, so an executor fetches nothing of its own — no skill file, no consumer definition — to interpret it.

Each binding below names what fills these for its consumer.

Before editing, confirm every item above is present and unambiguous. If any item is missing or ambiguous, or the prompt is not a coordinator packet from one of the consumers bound below, report that to the coordinator and make no edit.

Do not assume access to the coordinator's conversation or infer a repository location from the adapter, installation path, or current shell directory.

## Execution boundaries

- Work only in the prompt-supplied effective root. In shared-tree placement, edit that tree directly. In worktree placement, edit only that worktree. Never create, switch, or substitute a worktree yourself.
- Edit only the exact surface in the launch packet. If the unit needs a change outside that surface, stop and report the attempted scope escape instead of making it.
- Change nothing but the work itself. Records, statuses, and completion verdicts belong to the coordinator alone; each binding names the record surface its consumer keeps off-limits.
- Follow the instruction hierarchy and constraints that apply at the effective root, and read and apply the packet's domain guidance before editing. Do not broaden the unit into adjacent cleanup or combine it with another unit; on a segment launch the packet's listed units are the whole of the work, executed one at a time in packet order, and nothing else joins them.
- A live parent sandbox, approval setting, or managed security policy always takes precedence over this contract and any adapter default. Never weaken or bypass it. If it denies required writing or verification, stop and report the denial to the coordinator as a blocker; do not request or assume broader access.

## Verification and fallback

Run the unit's stated verify criterion and each per-unit check the packet carries, and nothing else, in the effective root after editing; a check the unit can satisfy inside its edit surface is fixed and re-run. On a segment launch, run each unit's criterion and checks as that unit completes and before starting the next: a failing criterion or unsatisfied check ends the segment there — report the completed units' evidence and the failure; never start a later unit on a failing one. Whose proof counts is § *Write-mode routing*'s call; the integrated-health recipe is the coordinator's either way, at the owning consumer's declared boundary.

If execution cannot proceed because the executor is unavailable, hangs, encounters a host failure, lacks required capability, or is blocked by placement, scope, or security constraints, report the condition without changing placement or scope. The coordinator owns graceful fallback — each binding names its consumer's — and the coordinator-side mechanics of placement, batching, and merge live in `./parallel-batch.md`.

## Evidence report

Return evidence, not a completion verdict. On a segment launch, return one report per unit in packet order, each complete on its own; a unit the segment never reached is reported as not started, not as `None`s. Include every heading, using `None` where empty:

- `Commands run` — each command or tool action that materially read, changed, or verified the unit.
- `Changes` — every changed `file:line` and what changed there.
- `Comments added or edited` — each comment the unit added or edited, with the non-obvious invariant it preserves.
- `Verification` — for the unit's criterion and each per-unit check the packet carried: the exact command or procedure, its unmodified output, its exit status, and the absolute root it ran in. All four, per check: any missing, paraphrased, or unreported makes the report non-evidence, and the coordinator proves the tier itself (§ *Write-mode routing*).
- `Sources consulted` — documentation or other external sources used, with links when available.
- `Blockers or attempted scope escapes` — security denials, unavailable capabilities, host failures, or edits considered outside the allowed surface.

Do not claim that the unit is done, update a status, or write this report anywhere but the reply to the coordinator.

## Segment launches

A **segment launch** hands one executor an ordered list of units in a single packet — consecutive units that share context, so one warm executor replaces several cold ones re-reading the same files and re-receiving the same guidance. Whether a consumer may launch segments, and what bounds one, is its binding's call (§ *Bindings*); a binding that names no segment bound launches units one at a time.

The launch changes nothing about what a unit is. The packet carries every § *Launch packet* item **per unit** — each unit's text and criterion, each declared surface — with the shared items (domain guidance, effective root, consumer label) stated once. The executor executes the units in packet order, proves each unit's criterion and checks before starting the next, and returns one evidence report per unit; a mid-segment failure ends the segment at the failing unit with the remainder reported not started. Placement is the engine's, unchanged: one launch, one effective root — the shared tree for a serial segment.

Coordinator intake is per unit, in packet order, exactly as § *Write-mode routing* requires for any report — but on the segment-final tree, where the segment's edits are already present in full. Within the segment the executor's per-unit pass licenses starting the next unit; intake's per-unit order is a recording order, not a tree state. A unit that fails at intake is Stop-the-Line at that unit: later units in the same report are not recorded or marked done past it, their edits — already present — are triaged forward under the loop's Stop-the-Line, and nothing is unwound by a Git operation or a blind restore. On an executor failure mid-segment, completed units that pass intake stand; the failing unit and the unreached remainder relaunch as a fresh segment on `native`, and only if that relaunch fails does the consumer's **Fallback** take the failing unit.

## Write-mode routing

Write-mode fan-out is limited to the consumers registered in `./executor-routing.md`. The contract above governs executor behavior; each consumer's own skill owns how it frames a unit of work and what verdicts it reaches. Every other fan-out consumer uses the probe contract in `./agent-fanout.md` — except the review skills' delegated pass, which is neither write-mode nor a probe and runs under `./reviewer-contract.md`.

**The posture.** Delegation is the standing posture for every consumer registered in `./executor-routing.md`: each unit goes to an executor. `./write-mode-posture.md` is its single home — that rule, the closed set of three exceptions that keep one unit inline, and what no consumer may state for itself.

**The registry, the authorization, and the engine** are the satellite `./executor-routing.md`: which consumers may launch at all, what a user's invocation authorizes and what an unrequested one does not, and the `native` adapter defaults and their degradation. The default needs none of it — `native`, the coordinator launching the `executor` adapter with the effective root this contract fixes, the adapter then loading its own installed copy — so read that file when a run is unregistered, unrequested, or looking at a failed adapter.

A unit that runs inline is announced and recorded as `./write-mode-posture.md` § *The exceptions* requires, in the shape each skill defines for its own report.

**Judgment never delegates**, under any posture. The coordinator keeps unit framing, the
consumer-declared integrated-health boundary, the report buckets, every status, and the intake below,
which decides whether an executor's evidence proves the unit or is advance evidence a re-proof gates.

**Intake of an executor's report.** Read a returned report before treating the unit as advanced.
Every § *Evidence report* heading must be present; a heading a unit's work should have filled but
that came back `None`, a `Verification` whose output shows the criterion or a packet-carried check
failing, and any entry under `Blockers or attempted scope escapes` each mean the unit has not
advanced — take the consumer's failure path (its **Fallback** for an execution failure,
Stop-the-Line for a failed criterion, and never a silent retry of a scope escape). A report of
failure is never evidence to accept.

**Placement decides whose proof counts.** A **shared-tree** unit — serial or segment on `native` —
verified bytes the coordinator's tree carries, so its `Verification` *is* that unit's outcome tier,
criterion and checks alike: accept it, re-running nothing, once it carries § *Evidence report*'s
four items per check, its root is the shared tree, and the surface check below passes. An earlier
segment unit's pass predates its successors' edits; the checkpoint boundary and acceptance gate
catch one they invalidated. A **worktree-placed** unit is never accepted — its pass predates
incorporation — so its full tier is re-proved at step 3 of `./parallel-batch.md`'s gates.

**Re-prove a shared-tree unit's outcome tier here in exactly these cases and no other:** any of
those four items missing for a check; a non-zero exit status under passing-looking output; a root
other than the shared tree; a surface check that could not run; or the run's **first delegated
unit** — the first unit of the run's first report — whose pass calibrates the rest. Then run that
tier (`./execution-loop.md` § *Two verification tiers*) here and record that evidence, not the
report's. A worktree-placed first delegated unit is re-proved as one, and the run's first
shared-tree unit is then accepted. Either way, a unit whose changes the coordinator cannot see has
not landed.

**The surface check** bounds a unit's delta to its edit surface as paths: those it declares, else
those the coordinator resolves its stated scope to before launch; none resolvable leaves the check
unrunnable. Capture the shared tree before launching — `node <kit-root>/scripts/worktree-merge.ts
baseline <shared-tree> --out <scratch>/unit-<n>.json` (`./task-store.md` § *Resolving
`<kit-root>`*), one capture per segment, checked over the union of its units' surfaces — then on
return run `check <shared-tree> --baseline <that manifest> --surface <each of those paths>`,
attributing the delta per unit by the reports' `Changes` — the check bounds a segment whole, and
`Changes` is its only per-unit bound. Exit 0 passes; exit 1 is a detected escape and takes the
failure path above; exit 2, or no kit root, is a re-run case above (`../scripts/worktree-merge.md`). Read the report first: a `Changes` entry outside the surface takes
that failure path before the script runs. A serially re-executed unit owes the same check against
its own pre-unit capture.

Record per the consumer's **Record** binding: whose evidence proved the outcome, the changed
`file:line` set, and the engine the unit ran on — a report shape may omit the engine when it is the
mode's default launch, the deviations being what the binding owes.

The mechanics of running units concurrently — eligibility, worktree placement, the frozen shared tree, the merge gates, incorporation order, and cleanup — live in `./parallel-batch.md`; read it when a batch qualifies.

## Bindings

Each consumer binds the body above to its own unit: what the unit is, what its packet carries, the surface the executor may edit, the fallback the coordinator takes when the executor fails, and the order a batch merges in. A launch prompt from anywhere else is not a coordinator packet. Coordinator-side orchestration — eligibility, batching, worktree placement, incorporated change sets, merge gates, and health-boundary hand-off — stays with the consuming skill and `./parallel-batch.md`.

### implement-task

One plan step from a task folder.

- **Unit** — one plan step, its verify criterion the step's plan-defined `Verify` line. § *Write-mode routing* decides whose evidence proves the step's tier; the coordinator owns the health boundary.
- **Segment bound** — in full-plan mode, the consecutive steps between two checkpoints (or a plan edge and its nearest checkpoint) form one segment launch (§ *Segment launches*), respecting `Depends on:` ordering; that is the mode's default launch shape, a single step between checkpoints being a segment of one. Steps eligible for the parallel batch leave the segment and batch instead. Step-by-step mode launches per step — a segment would collapse the pauses the mode exists for.
- **Packet** — the step's `What` and `Verify` text, the full text of every cited goal, the edit surface below, and the relevant task context with the absolute task-folder path. Domain guidance resolves from the task's `**Domain:**` header, default `engineering`.
- **Edit surface** — the step's declared `**Touches:**` paths when present, otherwise the scope stated by `What`. Never edit the task folder or its records, including `plan.md`, `goals.md`, `CONTEXT.md`, and `result.md` — the evidence report goes back to the coordinator, never into the folder.
- **Fallback** — inline execution for a serial step, serial re-execution for a parallel-batch step.
- **Merge order** — plan order.

### implement

One item of an ask framed in the session. There is no task folder, so the work is the whole write surface.

- **Unit** — one framed item, its verify criterion the one named for that item when it was framed (`implement` §1). § *Write-mode routing* decides whose evidence proves the item's tier; the coordinator owns the health boundary.
- **Packet** — the framed item's text and its criterion, the edit surface below, and the session-established context the executor cannot see: the ask as the user gave it, plus the grounding facts already established. Domain guidance follows the domain the session inferred from the request.
- **Edit surface** — the item's declared surface when the frame declares one, otherwise the scope the item states. The work itself is the only thing that changes on disk: the executor writes no record of any kind, because this consumer's only record is the coordinator's chat report.
- **Fallback** — inline execution.
- **Merge order** — frame order.

### fix-findings

One **Confirmed** finding's immediate fix application, applied to working-tree code.

- **Unit** — one Confirmed finding's fix application, its verify criterion the problem the finding names no longer reproducing. § *Write-mode routing* decides whose evidence proves that immediate tier; the coordinator re-checks every retained finding on the final integrated tree and owns the retained-collection health boundary.
- **Packet** — the finding verbatim, with its severity and `file:line` as its source left them; its root cause; the chosen fix option; the expected edit surface derived from that option's stated blast radius; and its processing order plus any known dependencies. Domain guidance is `engineering` unconditionally — the pack this consumer's skill loads.
- **Edit surface** — working-tree code and nothing else, bounded by the packet's expected surface. Never stage, never commit, never otherwise mutate Git state, and never write back to the findings' source — no PR reply, no resolved thread, no push. The executor writes no record; the coordinator's chat report is the run's only one.
- **Outside the delegation surface** — ask-routed fixes stay with the coordinator, which authored the approved diff and applies it inline; Withdrawn and Inconclusive findings are never edited at all.
- **Fallback** — serial re-execution for a batch fix, inline execution for a serial delegate; a failed
  executor is reported, its worktree discarded, and the fix re-executed whether the executor was
  unavailable, hung, surface-escaping, or conflicting. The re-execution runs on the integrated tree,
  the placement `native` defines (`./executor-routing.md` § *Write-mode engine registry*). The coordinator-side machinery around it — the immutable run
  baseline, each fix's exact pre-fix capture and its attribution-bounded restoration, the ordered
  incorporated change sets, and the dependency-safe rebuild that never uses a Git reset, checkout, or
  reverse patch — is `./fix-findings-recovery.md` with `fix-findings` § *Content baseline and immediate
  outcomes*. These units are independent, so one failure does not halt independent survivors.
- **Merge order** — severity order within dependency order, this consumer's processing order. Ordered change sets are recovery evidence, never Git staging or commit state.

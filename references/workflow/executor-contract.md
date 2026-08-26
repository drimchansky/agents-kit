# Write-Mode Executor Contract

This is the host-neutral contract for a write-mode executor. An executor carries out exactly one coordinator-supplied unit of work — or, on a **segment launch** (§ *Segment launches*), one packet-supplied ordered list of units — and returns evidence to the coordinator. What a unit is, what the packet carries, and what the executor may edit are per-consumer — the `## Bindings` at the end name them. Host adapters select native model, effort, and permission defaults, then load their installed copy of this contract.

This file carries the whole write-mode side of agent fan-out: the executor-facing contract below, then which consumers may launch an executor at all (§ *Write-mode routing*) and the engines they may launch it on (§ *Write-mode engine registry*). Read-only fan-out is not here — the probe contract and the merge contract are `./agent-fanout.md`.

## Launch packet

Treat the coordinator's launch prompt as the source of truth. It supplies:

- the unit of work's text and its verify criterion, plus the full text of whatever the unit cites as its contract for done;
- the exact edit surface: the paths the unit declares when it declares them, otherwise the scope the unit itself states;
- the context the unit depends on and the executor cannot see for itself, with absolute paths for everything it names. Paths and derived facts, not pre-read file contents: the executor reads the effective root itself, so a file under that root travels as its path plus whatever non-obvious fact the coordinator established about it, and verbatim content is reserved for what the executor cannot reach — session-established decisions, user answers, content outside the effective root;
- the domain guidance governing the unit, delivered two ways: any section the domain applies to every unit of this kind — such as engineering's `code-style.md` → Comments for a code-writing unit — travels verbatim in the packet, its full section text, so what always applies costs the executor no read hop; the active domain's rules overlay and the pack guidance the unit's work triggers travel as absolute paths to the same copies the coordinator loaded. Each binding names how its consumer resolves the domain; a domain with no pack, or none of whose files apply, is named with an explicit `none` — less guidance, never substituted guidance;
- one absolute effective working root and the placement the coordinator states for it — placement follows the unit's engine and its batching, which § *Write-mode engine registry* defines; the executor reads the value the packet names rather than deriving one from how the unit was delegated;
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

Run only the unit's stated verify criterion — its command or procedure — in the effective root after editing. Preserve the relevant output. On a segment launch, run each unit's criterion as that unit completes and before starting the next: a failing criterion ends the segment there — report the completed units' evidence and the failure, and do not start a later unit on top of a failing one. This is local advance evidence only: after incorporation the coordinator re-proves the full unit-outcome tier (`./execution-loop.md` § *Two verification tiers*) on the integrated tree, then runs the integrated-health recipe only at the owning consumer's declared boundary.

If execution cannot proceed because the executor is unavailable, hangs, encounters a host failure, lacks required capability, or is blocked by placement, scope, or security constraints, report the condition without changing placement or scope. The coordinator owns graceful fallback — each binding names its consumer's — and the coordinator-side mechanics of placement, batching, and merge live in `./parallel-batch.md`.

## Evidence report

Return evidence, not a completion verdict. On a segment launch, return one report per unit in packet order, each complete on its own; a unit the segment never reached is reported as not started, not as `None`s. Include every heading, using `None` where empty:

- `Commands run` — each command or tool action that materially read, changed, or verified the unit.
- `Changes` — every changed `file:line` and what changed there.
- `Comments added or edited` — each comment the unit added or edited, with the non-obvious invariant it preserves.
- `Verification` — the command or procedure and its relevant output, including failures.
- `Sources consulted` — documentation or other external sources used, with links when available.
- `Blockers or attempted scope escapes` — security denials, unavailable capabilities, host failures, or edits considered outside the allowed surface.

Do not claim that the unit is done, update a status, or write this report anywhere but the reply to the coordinator.

## Segment launches

A **segment launch** hands one executor an ordered list of units in a single packet — consecutive units that share context, so one warm executor replaces several cold ones re-reading the same files and re-receiving the same guidance. Whether a consumer may launch segments, and what bounds one, is its binding's call (§ *Bindings*); a binding that names no segment bound launches units one at a time.

The launch changes nothing about what a unit is. The packet carries every § *Launch packet* item **per unit** — each unit's text and criterion, each declared surface — with the shared items (domain guidance, effective root, consumer label) stated once. The executor executes the units strictly in packet order, proves each unit's criterion before starting the next, and returns one evidence report per unit; a mid-segment failure ends the segment at the failing unit with the remainder reported not started. Placement is the engine's, unchanged: one launch, one effective root — the shared tree for a `native` serial segment, one coordinator-managed worktree under `cross`.

Coordinator intake is per unit, in packet order, exactly as § *Write-mode routing* requires for any report — but on the segment-final tree: a native segment's edits are already on the shared tree in full, and a worktree-placed segment incorporates first as one gate, its whole-segment delta surface-checked against the union of the units' declared surfaces and brought over atomically. Within the segment the executor's per-unit criterion pass is what licenses starting the next unit; the coordinator's fuller tier is owed at intake, and its per-unit order is a recording order, not a tree state. A unit failing its re-proof is Stop-the-Line at that unit: later units in the same report are not recorded or marked done past it, their edits — already present — are triaged forward under the loop's Stop-the-Line, and nothing is unwound by a Git operation or a blind restore. On an executor failure mid-segment, completed units that pass re-proof stand; the failing unit and the unreached remainder relaunch as a fresh segment on the engine the degrade ladder (§ *Write-mode engine registry*) leaves them on, and only after the ladder does the consumer's **Fallback** take the failing unit.

## Write-mode routing

Write-mode fan-out is limited to the consumers registered here. The contract above governs executor behavior; each consumer's own skill owns how it frames a unit of work and what verdicts it reaches. Every other fan-out consumer uses the probe contract in `./agent-fanout.md`.

**The posture.** Delegation is the standing posture for every consumer registered here: each unit goes to an executor, and `./write-mode-posture.md` owns that rule together with the closed set of three exceptions that keep one unit inline. No consumer states a posture, a packet-cost prior, or a cadence of its own.

**The registry.** Three consumers launch write-mode executors: **`implement-task`**, **`implement`**, and **`fix-findings`**. Each one's unit, packet, edit surface, fallback, merge order, and any restriction on what it may delegate are its binding in § *Bindings* below — `fix-findings`'s delegation surface among them, under that binding's *Outside the delegation surface*.

**Standing authorization.** A user invoking one of these consumers is thereby requesting executor delegation: per-unit delegation *is* the protocol the invoked skill publishes, so an instruction that permits spawning agents when the user asks for them is satisfied by the invocation itself and needs no separate per-session request. This authorizes nothing further: an instruction, sandbox, or permission setting that forbids spawning outright is the posture file's exception 2 — announced, recorded, run inline — never bypassed, and never weakened to get a unit delegated.

Every unit that runs inline is **announced in chat and recorded in that skill's report**, naming which of the posture file's three exceptions applied; that record is what keeps the standing posture from decaying silently into always-inline. The exact record shape is each skill's own.

**Judgment never delegates**, under any posture. The coordinator keeps unit framing, each unit's
outcome re-proof on its own tree, the consumer-declared integrated-health boundary, the report
buckets, and every status. Executor output is advance evidence, never the gate.

**Intake of an executor's report.** A returned report is read before the unit is treated as advanced.
Every § *Evidence report* heading must be present; a heading a unit's work should have filled but that
came back `None`, a `Verification` section whose output does not show the criterion passing, and any
entry under `Blockers or attempted scope escapes` each mean the unit has not advanced — take the
consumer's failure path (its **Fallback** for an execution failure, Stop-the-Line for a failed
criterion, and never a silent retry of a scope escape). Then re-prove the unit's full outcome tier
(`./execution-loop.md` § *Two verification tiers*) on the coordinator's own tree — the executor's
`Verification` output is never that proof, and a unit whose changes the coordinator cannot see on the
tree has not landed. Record the coordinator's own evidence, not the report's, plus the changed
`file:line` set and the engine the unit ran on, per the consumer's **Record** binding — whose report shape may
omit the engine when it is the mode's default launch; the deviations are what the binding owes. Any comment the
report lists under `Comments added or edited` is validated as part of that tier where the domain's
per-unit checks require it.

The mechanics of running units concurrently — eligibility, worktree placement, the frozen shared tree, the merge gates, incorporation order, and cleanup — live in `./parallel-batch.md`; read it when a batch qualifies, and whenever a unit runs on `cross`, whose worktree-always placement routes even a serially delegated unit's seeding, surface check, and removal through that same file.

## Write-mode engine registry

- **`native`** — the unflagged default write-mode engine: Claude Code's native subagents on Claude, and Codex multi-agent on Codex. The coordinator launches the named `executor` adapter on both hosts and supplies its effective root: the shared tree for serial delegation or a coordinator-managed worktree for a parallel batch. The adapter then loads its installed copy of this contract.

  **Adapter defaults.** Claude installs `~/.claude/agents/executor.md`, pinned to `claude-opus-5` at `xhigh` and inheriting the parent permission mode. Codex installs `~/.codex/agents/executor.toml`, pinned to `gpt-5.6-sol` at `xhigh` with `sandbox_mode = "workspace-write"`. These kit-owned defaults select the native model and effort; Codex additionally requests write capability, while the live parent sandbox, approval setting, or managed security policy remains authoritative. The full model pins preserve a stable tier relationship instead of floating with provider aliases; on a host where a pin does not resolve or the current coordinator is already at or below it, retune the installed definition and remove its sibling `.agents-kit-executor` marker, or the next `setup.ts` run restores the kit copy.

  **Degradation.** If the named adapter, its configured model, or native subagent support is unavailable, report the failure. The coordinator-owned fallback above applies unchanged and symmetrically on either host; adapter availability never changes placement or scope.

- **`cross`** — the cross-vendor engine, opt-in per run via `-x` (`./skill-conventions.md` § *Current members*): the *other* vendor's CLI run headless — `codex` when the host is Claude Code, `claude` when the host is Codex — the write-mode counterparts of the read-only entries in `./probe-engines-cross-vendor.md`. `native` stays the unflagged default; without `-x` no unit leaves the host. Everything a cross run holds to is `./executor-engines-cross-vendor.md` — the launch recipes and their sandbox policies, the two preflights that precede a launch — presence-and-auth, and the capability probe that asks whether the engine's sandbox can run the unit's verify criterion — how each host's launch carries the model pin out of its installed adapter definition, and the run's own rules: worktree-always placement, the retargeted verify criterion, the once-per-run statement of what leaves the machine, cleanup, and the degrade ladder whose last rung is the consumer's **Fallback** in § *Bindings*. Read it when a cross launch is imminent; nothing in it is restated here. Codex CLI has no agent selector. Claude CLI does, but a cross launch deliberately selects no installed adapter: the receiving vendor's install may have drifted, so the packet carries the adapter's responsibilities and remains the executor's only coordinator instruction — the pointer an adapter would have supplied included. A cross packet therefore **names this contract by absolute path**, and the path it names is **the copy the coordinator itself loaded**, never the receiving vendor's install. A machine with both CLIs carries two installed copies and both resolve, so naming the coordinator's keeps contract and domain guidance on one install — the rule § *Launch packet* already states for the guidance — and a drifted second install cannot hand a foreign executor a stale contract. Naming it forks nothing, so the rule below holds unweakened: a path to one host-neutral contract names no engine, and a native packet may carry it harmlessly beside the adapter that already loaded it.

  **The packet is engine-agnostic.** One packet shape serves both engines. § *Launch packet* already assumes an executor that infers nothing for itself, so the coordinator supplies enough context for either engine to execute the unit, and no packet field names, branches on, or is reserved for an engine. Forking the packet per vendor would make a unit's contract depend on where it happened to run.

## Bindings

Each consumer binds the body above to its own unit: what the unit is, what its packet carries, the surface the executor may edit, the fallback the coordinator takes when the executor fails, and the order a batch merges in. A launch prompt from anywhere else is not a coordinator packet. Coordinator-side orchestration — eligibility, batching, worktree placement, incorporated change sets, merge gates, and health-boundary hand-off — stays with the consuming skill and `./parallel-batch.md`.

### implement-task

One plan step from a task folder.

- **Unit** — one plan step, its verify criterion the step's plan-defined `Verify` line. The executor proves that criterion only; the coordinator re-proves the full unit-outcome tier on the integrated tree and owns the health boundary.
- **Segment bound** — in full-plan mode, the consecutive steps between two checkpoints (or a plan edge and its nearest checkpoint) form one segment launch (§ *Segment launches*), respecting `Depends on:` ordering; that is the mode's default launch shape, a single step between checkpoints being a segment of one. Steps eligible for the parallel batch leave the segment and batch instead. Step-by-step mode launches per step — a segment would collapse the pauses the mode exists for.
- **Packet** — the step's `What` and `Verify` text, the full text of every cited goal, the edit surface below, and the relevant task context with the absolute task-folder path. Domain guidance resolves from the task's `**Domain:**` header, default `engineering`.
- **Edit surface** — the step's declared `**Touches:**` paths when present, otherwise the scope stated by `What`. Never edit the task folder or its records, including `plan.md`, `goals.md`, `CONTEXT.md`, `diagram.md`, and `result.md` — the evidence report goes back to the coordinator, never into the folder.
- **Fallback** — inline execution for a serial step, serial re-execution for a parallel-batch step.
- **Merge order** — plan order.

### implement

One item of an ask framed in the session. There is no task folder, so the work is the whole write surface.

- **Unit** — one framed item, its verify criterion the one named for that item when it was framed (`implement` §1). The executor proves that criterion only; the coordinator re-proves the full unit-outcome tier on the integrated tree and owns the health boundary.
- **Packet** — the framed item's text and its criterion, the edit surface below, and the session-established context the executor cannot see: the ask as the user gave it, plus the grounding facts already established. Domain guidance follows the domain the session inferred from the request.
- **Edit surface** — the item's declared surface when the frame declares one, otherwise the scope the item states. The work itself is the only thing that changes on disk: the executor writes no record of any kind, because this consumer's only record is the coordinator's chat report.
- **Fallback** — inline execution.
- **Merge order** — frame order.

### fix-findings

One **Confirmed** finding's immediate fix application, applied to working-tree code.

- **Unit** — one Confirmed finding's fix application, its verify criterion the problem the finding names no longer reproducing. The executor proves that criterion only; the coordinator re-checks the full unit-outcome tier on the integrated tree and owns the retained-collection health boundary.
- **Packet** — the finding verbatim, with its severity and `file:line` as its source left them; its root cause; the chosen fix option; the expected edit surface derived from that option's stated blast radius; and its processing order plus any known dependencies. Domain guidance is `engineering` unconditionally — the pack this consumer's skill loads.
- **Edit surface** — working-tree code and nothing else, bounded by the packet's expected surface. Never stage, never commit, never otherwise mutate Git state, and never write back to the findings' source — no PR reply, no resolved thread, no push. The executor writes no record; the coordinator's chat report is the run's only one.
- **Outside the delegation surface** — ask-routed fixes stay with the coordinator, which authored the approved diff and applies it inline; Withdrawn and Inconclusive findings are never edited at all.
- **Fallback** — serial re-execution for a batch fix, inline execution for a serial delegate; a failed
  executor is reported, its worktree discarded, and the fix re-executed whether the executor was
  unavailable, hung, surface-escaping, or conflicting. This is the ladder's **last rung**: the engine a
  failure degrades to before reaching it, and the placement that engine defines for the re-execution,
  are § *Write-mode engine registry*'s. The coordinator-side machinery around it — the immutable run
  baseline, each fix's exact pre-fix capture and its attribution-bounded restoration, the ordered
  incorporated change sets, and the dependency-safe rebuild that never uses a Git reset, checkout, or
  reverse patch — is `./fix-findings-recovery.md` with `fix-findings` § *Content baseline and immediate
  outcomes*. These units are independent, so one failure does not halt independent survivors.
- **Merge order** — severity order within dependency order, this consumer's processing order. Ordered change sets are recovery evidence, never Git staging or commit state.

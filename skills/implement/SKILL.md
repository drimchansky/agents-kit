---
name: implement
description: Use when asked to implement, build, fix, or change something directly — described in the session or pointing at a file, issue, or diff — with no task folder or plan.
argument-hint: '[what to implement] [-x (cross-vendor executor)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: take the task's `**Domain:**` (default `engineering`; infer from the request when there's no `CONTEXT.md`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`execution.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so.

This skill carries out a change directly, with no task folder: you frame what's being built, run it through the shared execution loop, and report in chat. It is `implement-task`'s ad-hoc counterpart — the same loop, the same verification tiers, the same Stop-the-Line discipline, read from the same file (`./references/workflow/execution-loop.md`).

**CRITICAL**: This skill writes no task-folder file and no status. The work itself is the only thing it changes on disk. Work that wants a durable record — a plan, a result file, an acceptance gate against written goals — belongs in `plan-task` → `implement-task`.

## Flags

- `-x` — Cross-vendor executor: run this skill's write-mode fan-out on the cross-vendor engine rather than the native one — a write-mode executor, not a probe — under the coordinator's unchanged gates, per `./references/workflow/executor-contract.md` § *Write-mode engine registry*, whose `cross` entry selects the engine and hands its rules — the worktree-always placement, the once-per-run statement of what leaves the machine, the cleanup, and the announced degrade ladder, whose last rung is this skill's binding **Fallback** — to `./references/workflow/executor-engines-cross-vendor.md` along with the launch recipes. Off by default, and it moves no posture step and no default: it reroutes exactly the items §3's posture procedure already comes out `delegate` for, which on this skill is every item clearing that procedure's first two steps with items still remaining — the inline default decides the last one, flagged or not. The engine a delegated item ran on goes in the §5 report's existing `Executed` bullet, never a new one. Two limits are worth knowing before typing it. **A single-item ask delegates nothing**: the inline default takes the last remaining item, so a one-item `/implement -x` run makes no cross launch, seeds no worktree, and never reaches the statement of what leaves the machine — owed only before a first cross launch — and with everything inline the `Executed` bullet is omitted too, leaving nothing in the report either. That is the flag behaving as specified on a skill whose default is inline, not a bug. **And a delegated item costs the coordinator more under `-x` than under `native`** — seed a worktree, snapshot a baseline, run the surface check, incorporate, remove, where a native serial delegate just runs on the shared tree. `-x` accepts that worse cost ratio in exchange for cross-vendor execution. <!-- cold -->

## References

Before working, read `./references/workflow/execution-loop.md` — the loop, its two verification tiers, and its failure discipline, with the six parameters §3 below binds for this skill — stated there in full, so this skill needs nothing from the cross-consumer index. Then load the resolved domain's pack: `execution.md` (how to carry out the work) and `verification.md` (what its two tiers run), plus any per-surface checklists that apply. When the domain is code, that's `./references/engineering/`, and the checklists matter most here since this is a skill that produces the actual work product.

## When to Use

**Use when** the change is small enough that a plan would be overhead — the resolved domain's `planning.md` owns the test (for code, `./references/engineering/planning.md` § *When a code change warrants a plan*, its **Skip when** list).

**Skip when:**

- A task folder or plan already covers the work — use `implement-task`, which records progress against it
- The work spans multiple modules, has several viable approaches worth comparing, or has requirements ambiguous enough to need decomposition — suggest `plan-task` first
- The user wants the work assessed rather than done — that's `review-commit` or `review-pr`

Default to this skill when the change looks like one or two files with an approach that's already clear, because a plan would cost more than the work; escalate the moment framing or the work itself says otherwise.

## Process

### 1. Frame the Ask

Restate what's being built and what "done" means, as a short list — one line per item, each with the criterion that will prove it. This is what the loop's **Source** binding points at: with no `plan.md` and no `goals.md`, this framing *is* both contracts.

- **Name each item's verify criterion here, before implementing it.** A criterion written afterwards describes what you built rather than what was asked, which leaves the step gate nothing to gate on.
- **An item may declare its edit surface** — the files or directories it's expected to edit, mirroring a plan step's `**Touches:**`. Optional: declare one only where parallel execution is plausible and the surfaces are genuinely separate; an item without one runs inline or serially-delegated, which is the safe default. §3's execution strategy is what a declaration buys.
- Keep the frame to what the user asked for. Adjacent work you notice goes in the report under `**Noticed but not touching:**` (`./AGENTS.md`), not into the frame.
- If the request is ambiguous in a way that changes the work, ask before framing; if it's ambiguous in a way that doesn't, state the reading you're taking and proceed.
- Show the frame to the user before starting when the work is more than a single obvious change; otherwise state it and go.

**Escalate instead of framing** when the frame comes out spanning several modules, needing an approach comparison, or running past a handful of items — say so and suggest `plan-task`. Those are the conditions the domain's `planning.md` lists as warranting a plan, and discovering them here is exactly when to stop.

### 2. Ground Truth

Establish what you're acting on and where the authoritative information lives, per `./references/workflow/execution-loop.md` § *Ground truth before work* — the resolved domain's `execution.md` carries the recipe. This skill produces the actual work product, so stale or invented facts ship.

### 3. Run the Loop

Run the loop in `./references/workflow/execution-loop.md` — the five beats, its two verification tiers, Stop-the-Line when required evidence fails — plus the scope-change rules in `./references/workflow/execution-recovery.md`. Read them before the first item. **This skill's bindings:**

- **Source** — one item of the framed ask; its criterion is the one named when §1 framed it, never written afterwards to match what was built.
- **Record** — the §5 chat report. **This skill writes no task-folder file and no status** — work wanting a durable record belongs in `plan-task` → `implement-task`.
- **Blocked** — report what failed, what was tried, and what's needed, then stop; don't skip ahead to another item. There is no status to set.
- **Acceptance** — the framed ask, verified live and reported in chat; a gap is Stop-the-Line, not a caveat.
- **Health boundaries** — the end-of-run assertion gate before acceptance; each mid-run pause before the user inspects the tree; and once after a fully merged parallel batch before a dependent item runs on top of it. A tail batch shares the end-of-run boundary. At each boundary, run the integrated recipe (`./references/engineering/verification.md` for code) on the current shared tree. Between boundaries, an item proves its own outcome tier — its criterion plus the per-unit checks the resolved domain's `verification.md` adds, per `./references/workflow/execution-loop.md` § *Two verification tiers* — and may progress when that tier passes.
- **Integration assertions** — one at the end of the run, before acceptance: exercise the ask's end-to-end outcome whole. A run wanting more gates than that is a sign the work wanted `plan-task`.

The two tiers answer different questions: an item's criterion proves that item's outcome and permits the next one; the end-of-run boundary proves nothing else regressed. A passing criterion is never the second.

Take the items in whatever order their dependencies require. Pause between them when the user asked to inspect as you go; otherwise run through and report once at the end.

When Stop-the-Line can't be cleared this session — the failure won't resolve, or the work waits on someone or something external — report what failed, what was tried, and what's needed (or what's awaited), then stop; don't skip ahead to another item. There is no status to set: the chat report is this skill's only record.

#### Execution strategy: inline by default

Default to executing each framed item **inline**, in this session: this skill's packet-cost prior for the shared posture procedure is high — an item framed in session has no packet on disk, so one must be reconstructed from context. Run that procedure — `./references/workflow/write-mode-posture.md`, which sets its own cadence — and **delegate** the items it comes out that way for.

A delegated item goes out under `./references/workflow/executor-contract.md`, whose `implement` binding (§ *Bindings*) governs what the packet carries, what the edit surface is, and what the fallback is — the executor sees that packet and nothing of this session. That contract's § *Write-mode engine registry* names the engine an item runs on: unflagged that is `native`, which puts a serially delegated item on the shared tree; with `-x` it is the registry's `cross` entry instead, for exactly the items the posture procedure above already came out `delegate` for — an item it came out `inline` for still runs here, flag or no flag. The worktree-always placement in the cross-run rules that entry points at covers **every** delegated item under `-x`, one that declared no §1 surface included: a declaration decides batch eligibility, never placement, so a serially delegated `-x` item runs in a coordinator-managed worktree rather than on the shared tree. Announce the delegation in chat as it happens, naming which items go out and why the procedure came out delegate, and record it in the §5 report's `Executed` bullet; that record is what keeps the default from drifting silently into always- or never-delegate.

**Parallel batches.** Eligible independent items may run concurrently. Eligibility and every merge gate are `./references/workflow/parallel-batch.md` § *Coordinator-side parallel batch*'s — work from there, not from a copy. What's this skill's own: an item's declared surface is the optional per-item declaration in the §1 frame, an item with no declared surface runs inline or serially-delegated, and a batch merges in **frame order**, this skill's unit order. A run has one assertion gate — the ask's end-to-end outcome exercised whole at §4, before its acceptance verdict — so the end of the run is a tail batch's natural bound. A batch a later item depends on bounds before that item instead; after its ordered merges and integrated outcome re-proofs, run one boundary before the dependent. No full health runs per merged item. <!-- cold -->

**Judgment stays here.** The §1 framing, both verification tiers, and the §5 report are the coordinator's whether or not an item was delegated. Re-prove the item's full outcome tier yourself on your own tree after an executor reports, the executor having run the criterion alone — its pass is advance evidence, never the gate — and run every health boundary yourself.

**Fallback is inline execution.** A failed, hung, or unavailable executor is reported and its item run inline — but under `-x` the registry's ladder comes first (`./references/workflow/executor-contract.md` § *Write-mode engine registry*): the item degrades to `native`, and only a `native` failure reaches this binding's inline **Fallback**. A surface escape or a merge conflict discards that worktree per the cited merge gates, and the item re-runs inline or serially-delegated.

Coordinator-managed worktrees don't dent the **CRITICAL** invariant above. They're transient scratch — created for a batch or for a serial `-x` item, merged, removed — so the work in the shared tree stays the only durable on-disk change: still no task-folder file, still no status, and no record written by an executor.

### 4. Confirm the Ask Is Met

Before reporting, close the run at its end-of-run gate, in this order: **exercise the ask's end-to-end outcome whole** (the §3 **Integration assertions** binding), then **run the integrated health recipe over the current shared tree** (its **Health boundaries** binding — `./references/workflow/execution-loop.md` § *Health boundaries*; for code the recipe is `./references/engineering/verification.md`), then run the acceptance discipline in `./references/workflow/execution-acceptance.md` against the §1 frame: re-read each item as it was framed and verify it against live behavior rather than your memory of doing the work. The assertion and the boundary answer different questions and are recorded separately (§5).

An item that isn't met is Stop-the-Line, not a caveat in the report. Close it, or surface the gap and stop — don't ship a report that quietly reframes what was asked.

### 5. Report

Lists, never tables. Chat only — nothing written to disk beyond the work itself.

- **Shipped** — `file:line` (or the domain's equivalent) per change, with what changed
- **Verified** — how each framed item was proven: command output, test name, behavior observed
- **Asserted** — the ask's end-to-end outcome exercised whole at §4's gate, and how it was exercised; recorded separately from **Health** below, which never substitutes for it
- **Health** — the end-of-run boundary's integrated recipe result on the final tree, plus any mid-run boundary that ran; the end-of-run boundary runs at §4's assertion gate, before the acceptance verdict
- **Executed** — deviations from the inline default only: which items were delegated, why the procedure came out delegate, and which executor engine each one actually ran on, and for a batched item that it ran in a parallel batch merged in frame order; omit when everything ran inline
- **Sources** — official-doc URLs grounding any framework-specific work, plus any pattern shipped without an authoritative source and why; omit when none
- **Deviations** — anything that differs from the §1 frame, and why; omit when none
- **Follow-ups** — what's left or worth watching; omit when none

Close with `**Noticed but not touching:**` when applicable (`./AGENTS.md`), and point at the natural next step — `/review-commit` before committing, or `/plan-task` if the work outgrew this skill.

## Verification

Confirm the protocol invariants before finishing:

- [ ] The ask was framed with each item's verify criterion stated **before** that item was implemented
- [ ] Every framed item: its full unit-outcome tier actually run and passed — the criterion named when it was framed plus the per-unit checks the resolved domain's `verification.md` adds (touched-comment validation for code) — nothing reported done over a failing outcome
- [ ] Integrated health established at every boundary the binding declares — the end-of-run assertion gate, each inspection pause, and once after each batch before dependent work — with a tail batch sharing the end-of-run boundary, and current against the final unchanged tree
- [ ] Acceptance ran against the §1 frame and live behavior, not against the report; no gap downgraded to a caveat
- [ ] Any delegation announced in chat and recorded in the report's `Executed` bullet, naming the engine it ran on; batched items ran only over declared pairwise-disjoint surfaces and came back through the cited merge gates, merged in frame order
- [ ] Framing, both verification tiers, and the report stayed with the coordinator; no executor wrote a record of any kind
- [ ] No task-folder file and no status written; the work itself is the only durable on-disk change, every coordinator-managed worktree removed after merge — a serial `-x` item's included
- [ ] Domain pre-presentation checks run over the full changed surface — for code, the consumer grep when exports or shared code changed; framework work grounded in cited sources, any ungrounded pattern stopped or recorded. Health is consumed from the final current boundary rather than re-run for presentation's sake

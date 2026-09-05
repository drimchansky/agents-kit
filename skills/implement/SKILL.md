---
name: implement
description: Use when asked to implement, build, fix, or change something directly — described in the session or pointing at a file, issue, or diff — with no task folder or plan.
argument-hint: '[what to implement]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: take the task's `**Domain:**` (default `engineering`; infer from the request when there's no `CONTEXT.md`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`execution.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so.

This skill carries out a change directly, with no task folder: you frame what's being built, run it through the shared execution loop, and report in chat. It is `implement-task`'s ad-hoc counterpart — the same loop, the same verification tiers, the same Stop-the-Line discipline, read from the same file (`./references/workflow/execution-loop.md`).

**CRITICAL**: This skill writes no task-folder file and no status. The work itself is the only thing it changes on disk. Work that wants a durable record — a plan, a result file, an acceptance gate against written goals — belongs in `plan-task` → `implement-task`.

## References

Before working, read `./references/workflow/execution-loop.md` — the loop, its two verification tiers, and its failure discipline, with the six parameters §3 below binds for this skill — stated there in full, so this skill needs nothing from the cross-consumer index. Then load the resolved domain's pack: `execution.md` (how to carry out the work) and `verification.md` (what its two tiers run), plus any per-surface checklists that apply. When the domain is code, that's `./references/engineering/`, and the checklists matter most here since this is a skill that produces the actual work product.

## When to Use

**Use when** the change is small enough that a plan would be overhead — the resolved domain's `planning.md` owns the test (for code, `./references/engineering/planning.md` § *When a code change warrants a plan*, its **Skip when** list).

**Skip when:**

- A task folder or plan already covers the work — use `implement-task`, which records progress against it
- The work spans multiple modules, has several viable approaches worth comparing, or has requirements ambiguous enough to need decomposition — suggest `plan-task` first
- The user wants the work assessed rather than done — that's `review-pr`

Default to this skill when the change looks like one or two files with an approach that's already clear, because a plan would cost more than the work; escalate the moment framing or the work itself says otherwise.

## Process

### 1. Frame the Ask

Restate what's being built and what "done" means, as a short list — one line per item, each with the criterion that will prove it. This is what the loop's **Source** binding points at: with no `plan.md` and no `goals.md`, this framing *is* both contracts.

- **Name each item's verify criterion here, before implementing it.** A criterion written afterwards describes what you built rather than what was asked, which leaves the step gate nothing to gate on.
- **An item may declare its edit surface** — the files or directories it's expected to edit, mirroring a plan step's `**Touches:**`. Optional: declare one only where parallel execution is plausible and the surfaces are genuinely separate; an item without one is serially delegated, which is the safe default. §3's execution strategy is what a declaration buys.
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
- **Blocked** — stop on the item rather than skipping ahead to another one, saying what failed, what was tried, and what is needed to clear it. There is no status to set.
- **Acceptance** — the framed ask, verified live and reported in chat; a gap is Stop-the-Line, not a caveat.
- **Health boundaries** — the end-of-run assertion gate before acceptance; each mid-run pause before the user inspects the tree; and once after a fully merged parallel batch before a dependent item runs on top of it. A tail batch shares the end-of-run boundary. At each boundary, run the integrated recipe (`./references/engineering/verification.md` for code) at the scope it resolves for that boundary. Between boundaries, an item proves its own outcome tier — its criterion plus the per-unit checks the resolved domain's `verification.md` adds, per `./references/workflow/execution-loop.md` § *Two verification tiers* — and may progress when that tier passes.
- **Integration assertions** — one at the end of the run, before acceptance: exercise the ask's end-to-end outcome whole. A run wanting more gates than that is a sign the work wanted `plan-task`.

The two tiers answer different questions: an item's criterion proves that item's outcome and permits the next one; the end-of-run boundary proves nothing else regressed. A passing criterion is never the second.

Take the items in whatever order their dependencies require. Pause between them when the user asked to inspect as you go; otherwise run through and report once at the end.

When Stop-the-Line can't be cleared this session — the failure won't resolve, or the work waits on someone or something external — report what failed, what was tried, and what's needed (or what's awaited), then stop; don't skip ahead to another item. There is no status to set: the chat report is this skill's only record.

#### Execution strategy: every item delegates

Delegation is the standing posture, not a judgment call: **every framed item goes to an executor**, whatever its size and wherever it sits in the run, and `./references/workflow/write-mode-posture.md` — read it before the first item — owns that rule and the only three exceptions that keep an item in this session. Because the frame, not a durable artifact, is this skill's contract, the packet has to be assembled from what the session established: do that work rather than keep the item. Confirm every packet item is filled before launching — the ask as the user gave it, the item's text and criterion, the grounding facts already established, the edit surface — and close a gap by reading, searching, or asking; only a gap that can be closed *solely by running the item* is an exception.

A delegated item goes out under `./references/workflow/executor-contract.md`, whose `implement` binding (§ *Bindings*) governs what the packet carries, what the edit surface is, and what the fallback is — the executor sees that packet and nothing of this session. `./references/workflow/executor-routing.md` § *Write-mode engine registry* names the engine an item runs on: `native`, which puts a serially delegated item on the shared tree. Announce any item that stays in this session as it happens, naming which posture exception applied, and record it in the §5 report's `Executed` bullet — that bullet is this skill's shape for the record the posture file requires.

**Parallel batches.** Eligible independent items may run concurrently. Eligibility and every merge gate are `./references/workflow/parallel-batch.md` § *Coordinator-side parallel batch*'s — work from there, not from a copy. What's this skill's own: an item's declared surface is the optional per-item declaration in the §1 frame, an item with no declared surface is serially delegated, and a batch merges in **frame order**, this skill's unit order. A run has one assertion gate — the ask's end-to-end outcome exercised whole at §4, before its acceptance verdict — so the end of the run is a tail batch's natural bound. A batch a later item depends on bounds before that item instead; after its ordered merges and the re-proofs those gates require, run one boundary before the dependent. No boundary per merged item. <!-- cold -->

**Judgment stays here.** The §1 framing, what each tier's evidence has to satisfy, and the §5 report are the coordinator's whether or not an item was delegated. Capture the shared tree before each launch — the pre-launch `baseline` the intake's surface check compares the return against. Take each executor's report through the intake in `./references/workflow/executor-contract.md` § *Write-mode routing* — every heading read, a failed criterion or a scope escape routed to the failure path rather than accepted — which decides whether the item's outcome tier is proved again here, and run every health boundary yourself.

**Fallback is inline execution.** A failed, hung, or unavailable executor is reported and its item run inline. A surface escape or a merge conflict discards that worktree per the cited merge gates, and the item re-runs inline or serially-delegated.

Coordinator-managed worktrees don't dent the **CRITICAL** invariant above. They're transient scratch — created for a batch, merged, removed — so the work in the shared tree stays the only durable on-disk change: still no task-folder file, still no status, and no record written by an executor.

### 4. Confirm the Ask Is Met

Before reporting, close the run at its end-of-run gate, in this order: **exercise the ask's end-to-end outcome whole** (the §3 **Integration assertions** binding), then **run the integrated health recipe at the scope it resolves for that boundary** (its **Health boundaries** binding — `./references/workflow/execution-loop.md` § *Health boundaries*; for code the recipe is `./references/engineering/verification.md`), then run the acceptance discipline in `./references/workflow/execution-acceptance.md` against the §1 frame: re-read each item as it was framed and verify it against live behavior rather than your memory of doing the work. The assertion and the boundary answer different questions and are recorded separately (§5).

An item that isn't met is Stop-the-Line, not a caveat in the report. Close it, or surface the gap and stop — don't ship a report that quietly reframes what was asked.

### 5. Report

Lists, never tables. Chat only — nothing written to disk beyond the work itself.

- **Shipped** — `file:line` (or the domain's equivalent) per change, with what changed
- **Verified** — per item, whose evidence proved it (`executor`, or `coordinator` with the re-run case where one fired) and how: command output, test name, behavior observed
- **Asserted** — the ask's end-to-end outcome exercised whole at §4's gate, and how it was exercised; recorded separately from **Health** below, which never substitutes for it
- **Health** — per boundary (the end-of-run one, plus any mid-run that ran), recorded to the shape the resolved domain fixes (`./references/engineering/verification.md` § *What a boundary records* for code); the end-of-run boundary runs at §4's assertion gate, before the acceptance verdict
- **Executed** — per item, whatever deviated from serial delegation on `native`: which executor engine a delegated item ran on, that a batched item ran in a parallel batch merged in frame order, and for an item that stayed in this session which posture exception applied and why; omit when every item was serially delegated on `native`
- **Sources** — official-doc URLs grounding any framework-specific work, plus any pattern shipped without an authoritative source and why; omit when none
- **Deviations** — anything that differs from the §1 frame, and why; omit when none
- **Follow-ups** — what's left or worth watching; omit when none

Close with `**Noticed but not touching:**` when applicable (`./AGENTS.md`), and point at the natural next step — `/commit` to commit the change and `/review-pr` to review it before merge, or `/plan-task` if the work outgrew this skill.

## Verification

Confirm the protocol invariants before finishing:

- [ ] The ask was framed with each item's verify criterion stated **before** that item was implemented
- [ ] Every framed item: its full unit-outcome tier passed on the evidence the intake accepted or re-proved (`./references/workflow/executor-contract.md` § *Write-mode routing*), the `Verified` bullet naming which; nothing reported done over a failing outcome
- [ ] Integrated health established at every boundary the binding declares — the end-of-run assertion gate, each inspection pause, and once after each batch before dependent work — each at the scope the domain recipe resolves, recorded per §5's `Health` field, with a tail batch sharing the end-of-run boundary, and current against the final unchanged tree
- [ ] Acceptance ran against the §1 frame and live behavior, not against the report; no gap downgraded to a caveat
- [ ] Every item delegated, with any item that stayed in this session announced in chat and recorded in the report's `Executed` bullet naming which posture exception applied, and every deviation from serial delegation on `native` recorded there with its engine; batched items ran only over declared pairwise-disjoint surfaces and came back through the cited merge gates, merged in frame order
- [ ] Framing, the intake's proof decision, every health boundary, and the report stayed with the coordinator; no executor wrote a record of any kind
- [ ] No task-folder file and no status written; the work itself is the only durable on-disk change, every coordinator-managed worktree removed after merge
- [ ] Domain pre-presentation checks run over the full changed surface — for code, the consumer grep when exports or shared code changed; framework work grounded in cited sources, any ungrounded pattern stopped or recorded. The health this report presents is what `./references/workflow/execution-acceptance.md` § *Before presenting* fixes

---
name: implement
description: Use when asked to implement, build, fix, or change something directly — described in the session or pointing at a file, issue, or diff — with no task folder or plan.
argument-hint: '[what to implement]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: take the task's `**Domain:**` (default `engineering`; infer from the request when there's no `CONTEXT.md`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`execution.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so.

Carries out the framed change and reports in chat. The work product is the only durable disk change: write no task-folder files or statuses. Durable plans/results belong to `plan-task` followed by `implement-task`.

## References

Apply `./references/workflow/execution-loop.md`, the resolved domain's execution.md and verification.md, and relevant surface checklists. Engineering work uses `./references/engineering/`.

## When to Use

Use when a plan would cost more than a clear, small change; apply the domain's planning.md test (`./references/engineering/planning.md` § *When a code change warrants a plan* for code).

An existing task uses `implement-task`. Multiple modules, competing approaches, or requirements needing decomposition use `plan-task`. Assessment without implementation uses `review-code`.

## Process

### 1. Frame the Ask

State each requested item and its verify criterion before implementation. The frame supplies both execution and acceptance contracts.

- Optionally declare per-item file/directory surfaces when independent parallel work is plausible. Undeclared items delegate serially.
- Keep adjacent work under Noticed but not touching (`./AGENTS.md`).
- Ask about ambiguity affecting scope; otherwise state the interpretation. Show the frame before work beyond one obvious change.
- Escalate to plan-task when framing spans several modules, requires approach comparison, or exceeds a handful of items.

### 2. Ground Truth

Establish target and authoritative sources under `./references/workflow/execution-loop.md` § *Ground truth before work* and the domain's execution.md recipe. Record framework sources and unresolved sourcing in §5.

### 3. Run the Loop

Apply `./references/workflow/execution-loop.md` and `./references/workflow/execution-recovery.md` before the first item. Bindings:

- **Source:** one framed item and its predeclared criterion.
- **Record:** §5's chat report; no task file or status.
- **Blocked:** stop at the failed item without skipping ahead; report failure, attempts, and what is needed or awaited.
- **Acceptance:** verify the frame live in chat. Gaps trigger Stop-the-Line, not caveats.
- **Health boundaries:** end-of-run assertion gate before acceptance, every inspection pause, and after a merged batch before dependent work. A tail batch shares the final boundary. Run the domain's integrated recipe at its resolved scope (`./references/engineering/verification.md` for code). Between boundaries, prove each item's full outcome tier, including domain per-unit checks (`./references/workflow/execution-loop.md` § *Two verification tiers*).
- **Integration assertions:** exercise the whole ask end to end once before acceptance. Work needing more gates belongs in plan-task.

Respect dependencies. Pause when the user requested inspection between items; otherwise finish and report once. A passed item criterion does not establish integrated health.

#### Execution strategy: every item delegates

Apply `./references/workflow/write-mode-posture.md`: every item delegates unless its stated exception applies. Fill packets with the original ask, item/criterion, established grounding, edit surface, and required contract fields before launch. Close gaps by reading, searching, or asking; only gaps discoverable solely through execution qualify for that exception.

Launch under `./references/workflow/executor-contract.md` § *Bindings*, implement binding; native serial items use the shared tree (`./references/workflow/executor-routing.md` § *Write-mode engine registry*). Announce inline exceptions and record them under Executed.

**Parallel batches.** Apply `./references/workflow/parallel-batch.md` § *Coordinator-side parallel batch*. Require declared, pairwise-disjoint surfaces and independent items; undeclared items remain serial. Merge in frame order. Bound a tail batch at §4; otherwise finish merges and required re-proofs before one boundary preceding dependent work. Do not run health per merged item. <!-- cold -->

**Judgment stays here.** Keep framing, evidence decisions, all health boundaries, and reporting with the coordinator. Capture a pre-launch baseline, then apply `./references/workflow/executor-contract.md` § *Write-mode routing* intake to every return. Read every evidence heading; route failures and escapes to failure handling. Re-prove outcomes when intake requires it.

**Fallback is inline execution.** Report failed, hung, or unavailable executors and execute their items inline. Surface escapes or merge conflicts discard the worktree under the merge gates, then rerun inline or serially. Remove all coordinator-managed worktrees after incorporation; no executor writes a record or status.

### 4. Confirm the Ask Is Met

In order: exercise the whole end-to-end outcome, run the integrated-health boundary at the domain's resolved scope, then apply `./references/workflow/execution-acceptance.md` to each framed item against live behavior. Record assertion and health separately. Close gaps or stop explicitly; do not reframe the ask to claim completion.

### 5. Report

Use chat lists; apply `./references/workflow/execution-acceptance.md` § *Before presenting* and domain checks on the full changed surface. Health must cover final unchanged bytes. For code, check shared/export consumers and cite framework grounding; stop or record ungrounded patterns under the domain's rules.

- **Shipped:** `file:line` (or the domain's equivalent) per change, with what changed.
- **Verified:** per item, executor or coordinator evidence, any re-run case, and command/test/observed behavior.
- **Asserted:** whole-ask outcome and how exercised, separate from Health.
- **Health:** every boundary under the domain's format (`./references/engineering/verification.md` § *What a boundary records*).
- **Executed:** deviations from native serial delegation, with engine, frame-ordered parallel merges, or inline exception/reason; omit when none.
- **Sources:** framework URLs and unsourced patterns with reasons; omit when none.
- **Deviations:** changes from the frame and reasons; omit when none.
- **Follow-ups:** remaining work; omit when none.

Append Noticed but not touching where material. Point to `/commit`, `/review-code`, or `/plan-task` as appropriate.

---
name: implement-task
description: Use when asked to implement, execute, run, or carry out a task's plan from a task folder (canonically under `.agents/tasks/`) — by task folder path, or the current task if one is already in context.
argument-hint: '[task folder path]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`execution.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so.

Executes a task folder's `plan.md`: implements each step, records it in `result.md` as it goes, marks the step done in the plan with a link to that record, and runs an acceptance gate against `goals.md` before flipping the plan to `done`.

This skill mutates the plan and the result file freely, and the grounding surfaces (`CONTEXT.md`, `goals.md`, `ticket.md`, an inherited `GROUP_CONTEXT.md`) only as § *Correcting Grounding Where It's Wrong* licenses. The sole exception is the loader's proven identifier repair in `CONTEXT.md` and `goals.md`, which changes no meaning (`./references/workflow/task-authorship.md` § *Files*). It authors a doc task's deliverable as the plan directs and never writes a deliverable's `**Published:**` line. Its Git writes are the task's own branch and worktree (§1, §3, §8), the branch-scoped `git fetch origin <default-branch>` the **merged** predicate runs, and checkpoint commits only under the sanction §2 establishes. Nothing is pushed or amended. Its one write outside the task folder and the work product is the repository's own `AGENTS.md` / `CLAUDE.md`, for the branch convention a creation-path run proposes, **only on the user's explicit confirmation** and stated when written: `./references/workflow/task-delivery-edges.md` § *Proposing an observed branch convention*. <!-- cold -->

Per-file authorship is `./references/workflow/task-authorship.md` § *Files*; the plan changes only by checkbox flips, appended result links, `**Status:**`, and §6 revisions.

## Inputs

In the resolved task folder, load structural repair before opening content in the order §1 fixes: `ticket.md` (optional), `CONTEXT.md`, `goals.md` (the acceptance contract, §7), `plan.md`, and `result.md` (this run's record, §3 and §5). The first three are semantically correctable only under § *Correcting Grounding Where It's Wrong*. A goal with edited acceptance wording is graded in a later run; a completed identifier-only repair does not defer grading.

Read `./references/workflow/execution-loop.md` before working; §4 and §7 bind its six parameters. Then read the pack files Core Rules 2 names and any per-surface checklist the work touches.

## When to Use

**Use when** the user asks to implement, execute, run, carry out, or resume a task or its plan, by task folder, by `plan.md`, or by a task already established in this session. **Skip when** no task folder exists yet (`plan-task`), the work is too small for a plan (`implement`), or the plan is still being iterated on. A plan whose `**Status:**` is `skipped` runs only after the user confirms reviving it; never silently run an abandoned plan. On confirmation, §3 takes the registered `skipped → executing` revive (`./references/workflow/task-lifecycle.md`).

## Process

### 0. Prepare Against Authoritative Sources

Establish ground truth per `./references/workflow/execution-loop.md` § *Ground truth before work*; the domain's `execution.md` carries the recipe. Record the sources you ground the work on, and any pattern you couldn't ground, in the result file's `**Sources:**` field (§5), never in code comments.

### 1. Locate and Load the Task

**Resolve the folder** per the **resolve-current-or-ask** rules in `./references/workflow/task-layout.md`. A folder under `Backlog/` takes the activation offer in `./references/workflow/implement-task-edges.md` § *Activating a backlogged task*. <!-- cold -->

**Then load it** in the order `./references/workflow/task-layout.md` § *Reading a resolved folder* fixes:

- Report the loader's `applied`, `mappings`, and `unresolved` before relying on its returned `state`. A null `state` with no readable plan goes to `plan-task`; a failed repair stops execution. Unresolved structure cannot count as complete goal coverage.
- `goals.md` missing: stop and tell the user. Never invent goals.
- `CONTEXT.md`: its header for `**Domain:**`; its prose when a step's packet (§4) turns on it.
- Read shared grounding from the folder's current location on every invocation. Resolve material contradictions before dependent steps or acceptance under § *Correcting Grounding Where It's Wrong*. Record both statements and sources. Unresolved material contradictions or impactful choices take `./AGENTS.md` § *Ask Before Assuming* before dependent writes.
- `ticket.md` is the product-facing ask; the gate runs against `goals.md`, not the ticket.
- A `currentState` block or any checked step means a prior session got partway: pick up there, never redoing completed steps. Then branch on the plan status (`./references/workflow/task-lifecycle.md`):
    - `blocked`: read the result's `**Blocked:**` section; resume only once the blocker has cleared, flipping the plan back to `executing` first.
    - `in-review`: read the result's `**In review:**` section. When implementation is complete, including any unchecked step whose only remainder is an explicitly open verification leg, take `./references/workflow/implement-task-edges.md` § *Verification-only continuation* before worktree re-entry. Do not re-run completed steps. On that path, re-gate `(external)` goals against available confirmation, each engineering check through `./references/engineering/acceptance-gate.md`, and a goal named by `**Grounding corrected:**` against live behavior on its new wording, then §8. Actual unimplemented work returns to `executing` and §4 after the normal re-entry decision.

**A branch in `**Pointers:**` identifies delivery work**: after the verification-only decision above, resolve it for implementation per `./references/workflow/implement-task-edges.md` § *Task worktree*. A removed-branch marker remains a delivery pointer, not a worktree to recreate. <!-- cold -->

### 2. Decide Execution Mode

Ask the user, or infer from the request:

- **Step-by-step**: one step, update both files, pause. Default for risky or large plans.
- **Full plan**: every step end-to-end, then one combined result (§5). Default for plans of three steps or fewer, or an explicit "run the whole thing".

Step-by-step pauses after each step's unit outcome and health boundary (§4). Automatic parallel batches remain full-plan only. Establish checkpoint-commit authorization under `./references/workflow/task-delivery.md` § *Checkpoint commits*, independently of execution mode or requested step range. <!-- cold -->

### 3. Initialize Execution State

**Create the task branch and worktree first**, unless §1 re-entered one, when the resolved `**Domain:**` is `engineering` and the resolved repository holds at least one path a plan step names. Creation is announced, and `**Pointers:**` carries the branch. A doc or bureaucratic task, or one for which no root resolves, skips creation silently. Every other run follows `./references/workflow/task-delivery.md` § *Branch and worktree creation* for **Which repository**, the naming, the sanction, the degrade, and the one skip that announces itself. <!-- cold -->

Create `<task-dir>/result.md` when absent, from the header and `## Current state` block of `./references/templates/result.md`, dated today; it carries no `**Status:**` header of its own.

When current guidance cites a pre-result decision under a dated context or plan heading, add a Decision log pointer to that original anchor on result creation (`./references/workflow/task-authorship.md`).

When §2 granted checkpoint commits, capture and inspect the shared tree's existing staged and unstaged changes before the first step, per `./references/workflow/task-delivery.md` § *Checkpoint commits*. <!-- cold -->

`## Current state` is rewritten **in place** on the contract in `./references/workflow/task-authorship.md`; everything below its closing `---` is the append-only log.

Then point the plan's `**Result:**` line at `./result.md` and flip its `**Status:**` from `to-do` to `executing`.

**Reviving a `skipped` plan**, only after the confirmation *Skip when* requires: `./references/workflow/implement-task-edges.md` § *Reviving a skipped plan*. Reload with structural repair after the plan leaves `skipped` and before executing a step. <!-- cold -->

### 4. Execute Steps

Run the loop in `./references/workflow/execution-loop.md`: the five beats, the two verification tiers, Stop-the-Line when required evidence fails.

**This skill's bindings:**

- **Source**: one unit is one plan step; its criterion is that step's `Verify` line. Stay inside the plan's scope; respect `Depends on:` ordering in both modes.
- **Inherited grounding**: the group sources §1 loaded travel with the step, identified by root and path, per the `implement-task` binding in `./references/workflow/executor-contract.md` § *Bindings*. A step whose grounding contradicts it does not launch until §1 has ruled. None of those files is ever on an executor's edit surface; a grounding correction is the coordinator's, never delegated.
- **Record**: append a result section (§5) once the step's outcome and, where it carries one, its health boundary have run.
- **Mark done**: flip `- [ ]` to `- [x]` and append the result-section link:

    ```
    - [x] **What:** <unchanged> ([result](./result.md#step-1--add-csv-writer))
    ```

- **Pause or continue**: step-by-step stops after each step and reports; full-plan continues.
- **Blocked**: a Stop-the-Line that can't clear this session. Set the plan's `**Status:**` to `blocked`; write a `**Blocked:**` section in the result file naming what failed, what was tried, what's needed or awaited, and the last health boundary that passed with what it covered (`none` where none did); rewrite `## Current state` naming the blocker; stop. Never skip ahead.
- **Health boundaries**: every step-by-step pause, after the step's outcome proof and before its result section is appended; every authored checkpoint after its assertions; each natural batch bound before dependent work; the full-plan tail before acceptance; and every later-run `in-review → done` finalization, as a fresh boundary recorded in §8's dated section. A batch bounded by a checkpoint or by the tail shares that one health pass. Between boundaries a step proves only its own outcome tier (`./references/workflow/execution-loop.md` § *Two verification tiers*); the integrated recipe (`./references/engineering/verification.md` for code) runs only at the places above, and health is current only when its last boundary ran on the final unchanged tree. A failed finalization boundary takes the registered `in-review → executing` edge, then **Blocked**.
- **Integration assertions**: the plan's `### Checkpoint after Step N` headings, each mandatory after marking step N done. A checkpoint is not a step, carries no `- [ ]`, and is never flipped. Run its assertions, then its health boundary. When §2 granted checkpoint commits, the coordinator then applies `./references/workflow/task-delivery.md` § *Checkpoint commits* from the shared tree, never an executor worktree, running `commit` as that section directs. Append the checkpoint section (§5) after any authorized commit attempt. Then pause in step-by-step mode. <!-- cold -->

#### Execution strategy: every step delegates

Execute each step through an **executor** per `./references/workflow/executor-contract.md` and its `implement-task` binding, whose **Segment bound** fixes the launch shape; engine `native` places a serially delegated step or segment on the shared tree.

**Every step goes to an executor** per `./references/workflow/write-mode-posture.md`, which fixes what a launch packet owes and the three exceptions that keep a step here. Capture the `baseline` manifest of the shared tree before launching, one per segment. **Deviation is measured against the mode's default launch on `native`**, which is what `**Executed:**` (§5) records. While an executor is in flight the coordinator waits, with no step of its own and no shared-tree edit (`./references/workflow/delegated-waiting.md` § *How to wait*). Then take each report through the contract's § *Write-mode routing* intake, which decides whether the outcome tier is re-proved here, and record the step (§5); a failure there is Stop-the-Line at that step, and a pending impactful choice takes the contract's third outcome: ask, hold the step and its dependents, and keep the plan `executing` while the answer arrives in this run. A choice still open when the run ends takes this binding's **Blocked** (`./references/workflow/execution-bindings.md`): the plan enters `blocked` and `**Blocked:**` records the choice, its options and recommendation, and the held step, so §1's resume branch finds it.

**Inline is an exception, announced and recorded** in `**Executed:**` (§5), on one of the posture file's three exceptions. A failed or hung executor is reported and takes the binding's **Fallback**; on a segment, § *Segment launches* governs what stands and what relaunches. <!-- cold -->

#### Automatic parallel batch (full-plan mode)

Eligible independent steps run concurrently through the same contract and binding. Eligibility, launch, merge, and the checkpoint hand-off are `./references/workflow/implement-task-edges.md` § *Automatic parallel batch*, read when steps declare `**Touches:**` surfaces in full-plan mode. No `**Touches:**` line, or `**Touches:** none`, means serially delegated. <!-- cold -->

### 5. Result File: Sections

Copy the applicable sections from `./references/templates/result.md`: per-step or bounded Full Run records, the checkpoint block, the `## Decision log` line, §7's `## Acceptance`, and its `## Live verification` record for engineering work.

Each new Step or Full Run section fits `RECORD_MAX_KB` (`./references/workflow/task-layout.md` § *One task, one flat folder*). Summarize the accepted executor report or coordinator re-proof: changed outcome, decisive check and status, material deviation or failure, and a stable evidence path, anchor, or short diagnostic. `**Verified:**` opens with `executor` / `coordinator` and its re-run case. Keep command results, not output tails or request/response transcripts; the executor's full return contract stays in `./references/workflow/executor-contract.md` § *Evidence report*.

`**Health:**` records the boundary to the domain's shape (`./references/engineering/verification.md` § *What a boundary records* for code); it is omitted on a step merged from a parallel batch and on one that ended at an authored checkpoint, whose section carries it.

`**Executed:**` is omitted for a step that ran the mode's default launch on `native`: per-step serial in step-by-step, its checkpoint-bounded segment in full-plan. Otherwise it names the deviation: "parallel batch (<engine>), merged in plan order at/before <the §4 merge point>", "serial delegation (<engine>)", or "inline (<not specifiable / delegation unavailable / executor failed> — <detail>)". The full-run variant prefixes each entry `Step N`, as does `**Grounding corrected:**`, and writes "Steps M–N segment (<engine>)" for a relaunched segment.

In full-plan mode, use one combined Full Run section for serial steps when it fits `RECORD_MAX_KB`; every folded step links to its `#full-run--<date>` anchor (double hyphen). If it cannot fit while naming each outcome and its evidence, write per-step sections and link each step to its own anchor. Merged parallel-batch steps always keep their per-step sections. Preserve existing anchors and history; do not compact old records as part of writing new ones (`./references/workflow/reconciliation-compaction.md`).

Keep shared health evidence once in the boundary's owning step, checkpoint, or Full Run section, with the reference, delta, command outcomes, and manifest evidence `./references/engineering/verification.md` requires. A failed step or checkpoint records the decisive failure, what was tried, and the next unblock action without a transcript. A deployment check records environment, target, expected and observed release, observation time, outcome, and supporting evidence; unresolved access or release identity stays pending (`./references/engineering/acceptance-gate.md`). Record passed and not-applicable live checks in the result's `## Live verification`; a pending check stays in In review until it passes.

A failed assertion or health boundary records the `**Asserted:**` and `**Health:**` results that ran (or `not run`), `**Outcome:** failed`, `**Commit:** not run — checkpoint failed` when commits were granted, and the failure details, then follows Stop-the-Line. A checkpoint commit failure records `**Commit:** failed — <reason>` and blocks later steps. A successful commit records its SHA; no task changes records `none — no task changes`. Do not move on until a sanctioned checkpoint has a successful or no-change commit result. On resume, settle a pending checkpoint commit before later steps and do not repeat one already recorded as successful.

**At every plan `**Status:**` flip and at run end**, finalize included, rewrite `## Current state` on its contract, never claiming a stronger state than the plan's `**Status:**`, and carrying any commit watermark entry forward untouched, never advanced, dropped, or created here (`./references/workflow/reconciliation-commits.md` § *The watermark*). **When a step records a decision**, append the template's dated one-liner to `## Decision log`, creating that section directly below `## Current state`'s closing `---` when absent: a pointer to where the decision is recorded, never the decision text.

### 6. Plan Revisions Mid-Execution

When implementation reveals the plan is wrong (a step infeasible, scope wrong, a step missing or too large for one slice), apply `./references/workflow/execution-recovery.md` § *Scope changes mid-execution*. The in-place plan update, the `**Deviations from plan:**` record, and the abandon flow are `./references/workflow/implement-task-edges.md` § *Plan revisions*. <!-- cold -->

### 7. Acceptance Gate

After the last step is marked done and **before** the plan flips to `done`, run the gate against `goals.md` per `./references/workflow/execution-acceptance.md`: every `G<n>` goal gated against live behavior, the verdict in a single `## Acceptance` section of the result file copied from the template, one line per goal with its tag and the evidence, caveat, or awaited confirmation. For engineering, also resolve and run every applicable deployment/browser check in `./references/engineering/acceptance-gate.md`, even when the plan's `## Live verification`, a goal, or a repository declaration omitted it. Scope deferral does not waive this gate for affected delivered work.

**Tag each goal** `met`, `met with caveats`, `unmet`, `out of scope`, or `pending external`. `out of scope` **only when the plan's `## Scope` lists that goal ID in its deferred partition**; a goal that isn't there drifted in after planning, so surface it rather than dropping it. `pending external` **only for a goal carrying the `(external)` marker** whose verification you can't perform in-session, recording what's awaited and who verifies it; undone agent-verifiable work is `unmet`.

**Any goal `unmet`: do not finalize.** Apply Stop-the-Line: localize the gap, then either revise the plan and return to execution, or surface a goals misunderstanding for the user to edit and re-run the gate.

**Any goal `met with caveats`: secure explicit user acknowledgement before finalizing**, and record it in that goal's `## Acceptance` entry. An unacknowledged caveat is treated as `unmet`.

**Any goal `pending external` or engineering live check awaiting downstream verification: park at `in-review`**, once every other goal is `met`, acknowledged, or `out of scope` and no observed live failure remains. Then take §8's `in-review` branch. Record each pending check per `./references/workflow/task-lifecycle.md` § *Companion result file*. Failed behavior or a wrong healthy release is unmet work and returns to execution.

### 8. Finalize

"Acknowledged" below means the §7 acknowledgement for every `met with caveats` and `out of scope` goal.

**Park at `in-review`** when local implementation and agent-verifiable goals are satisfied but downstream verification remains:

- The plan's `**Status:**` to `in-review`
- An `**In review:**` section in the shape `./references/workflow/task-lifecycle.md` § *Companion result file* gives; **no** `**Completed:**` line
- The shared loop's *Before presenting* step (`./references/workflow/execution-acceptance.md` § *Before presenting*); the summary names which goals are `met` and what external verification is outstanding

**Finalize to `done`** only once every goal is `met` or acknowledged, none is `pending external`, and every applicable engineering live check passed or has a supported `not applicable` disposition:

- The plan's `**Status:**` to `done`
- A closing `**Completed:** YYYY-MM-DD` line in the result file, written only at `done`
- The shared loop's *Before presenting* step (`./references/workflow/execution-acceptance.md` § *Before presenting*)
- The task worktree and branch removed **after** that step and last of the four, per `./references/workflow/task-delivery-edges.md` § *Removal*: merged PR and clean tree, else refused with the reason, never forced. Checkpoint authorization adds no tail or final commit. Refusal is recorded and never blocks the finalize. <!-- cold -->

In **both** branches, rewrite `## Current state` last, after the removal, so `**Pointers:**` records whether the branch survived; at `in-review` its `**Next:**` names the awaited verification.

**Reaching `done` from `in-review`** on a later run: `./references/workflow/implement-task-edges.md` § *Reaching done from in-review*. <!-- cold -->

### 9. Hand Off

Close each completed run with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*), composed after §8's *Before presenting* summary. A step-by-step pause and a **Blocked** stop close with it too.

- **Done:** the steps and checkpoints this run completed and the plan status reached, each pointing at its `result.md` section.
- **Know:** goals short of `met` and verification still outstanding, pointing at `## Acceptance` or `**In review:**`. Name the task branch and worktree, checkpoint commits, uncommitted changes, and a refused removal's reason. Name each surface a grounding correction changed.
- **Awaiting you:** what the result's `**Blocked:**` section needs or awaits, pointing at it and repeating none of its options or recommendation.
- **Next:** `/implement-task <token>` continues after a pause or an `executing` stop, resumes once a blocker clears, and re-gates an `in-review` plan once its awaited verification is reported. Once implementation is complete (`in-review` or `done`) and the task branch is unmerged, `/commit` takes staged changes and `/review-code` reviews the branch once committed. A `done` plan whose work merged takes `/archive-task <token>`.

## Correcting Grounding Where It's Wrong

When execution disproves a factual claim, correct its owning surface: `CONTEXT.md`, `goals.md`, `ticket.md`, or an applicable `GROUP_CONTEXT.md`.
Apply `./references/workflow/reconciliation.md` § *Grounding docs change on evidence, never silently* and § *The upstream ask is writable, and never rewritten quietly*.

Before a correction requiring an unresolved impactful choice, apply `./AGENTS.md` § *Ask Before Assuming* and hold dependent writes.
A discrepancy proves no new requirement. Evidence-settled facts and settled prior decisions keep their correction route.

**A correction is bounded by what the run learned.** Rewrite the statement the work disproved and nothing adjacent; reshaping untested grounding is `plan-task`'s.

**Record every correction in the result file** as it lands: a `**Grounding corrected:**` field on the step's entry, or its own dated line when no step owns it, carrying the surface, the prior wording, the new wording, and the evidence. A group file or `ticket.md` is named by its path from the selected root.

**The gate never grades work against acceptance wording this run rewrote.** A run that semantically edits `goals.md` does not finalize: it applies the edit, records it, finishes its steps, and stops at `executing` with `## Acceptance` unwritten, naming the edited `G<n>` as what holds finalizing; the next run gates against the new wording. A completed identifier-only loader repair preserves that wording and does not defer grading. Never retire a goal because it failed, never soften a `**Verify:**` line because the step tripped on it, and never edit `ticket.md` toward what was built; what the ticket means is the requester's to say. A goal that fails is `unmet` (§7); an ask that turns out to be wrong is `plan-task`'s to re-derive. On the `in-review` re-run the plan stays `in-review`, since `## Acceptance` is append-only: record a semantic correction as its own dated line, add the edited `G<n>` to `**In review:**`, and stop; the next run re-gates it beside the pending externals.

**Announce corrections in the run's closing summary**, grouped by surface.

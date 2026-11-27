---
name: implement-task
description: Use when asked to implement, execute, run, or carry out a task's plan from a task folder (canonically under `.agents/tasks/`) — by task folder path, or the current task if one is already in context.
argument-hint: "[task slug or path; defaults to the session's task] [-e native|codex|claude]"
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`execution.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so.

Execute `plan.md`, record outcomes in `result.md`, and link checked steps to their evidence. Gate `goals.md` before setting `done`.

Apply `./references/workflow/task-writes.md` to task edits and `./references/workflow/task-progress.md` to every progress marker, including downward repairs. Correct grounding (`CONTEXT.md`, `goals.md`, `ticket.md`, an inherited `GROUP_CONTEXT.md`) under § *Correcting Grounding Where It's Wrong*. The sole exception is the loader's proven identifier repair in `CONTEXT.md` and `goals.md`, which changes no meaning (`./references/workflow/task-authorship.md` § *Files*). The skill authors a doc task's deliverable as the plan directs and never writes a deliverable's `**Published:**` line. Its Git writes are the task's own branch and worktree (§1, §3, §8), the branch-scoped `git fetch origin <default-branch>` the **merged** predicate runs, and checkpoint and final commits under the sanction §2 establishes. Nothing is pushed or amended. Each step runs through a delegated write-mode executor (`./references/workflow/executor-routing.md` § *The registry and its authorization*). Its one write outside the task folder and the work product is the repository's own `AGENTS.md` / `CLAUDE.md`, for the branch convention a creation-path run proposes, **only on the user's explicit confirmation** and stated when written: `./references/workflow/task-delivery-edges.md` § *Proposing an observed branch convention*. <!-- cold -->

Per-file authorship is `./references/workflow/task-authorship.md` § *Files*; the plan changes only by checkbox and result-link updates, `**Status:**`, and §6 revisions.

## Flags

- `-e native|codex|claude`: executor for this run's steps, selected through `./references/workflow/executor-routing.md` § *Selection*.

## Inputs

Apply §1's structural loading before task content: optional `ticket.md`, `CONTEXT.md`, `goals.md` (§7's acceptance), `plan.md`, and `result.md` (§§3/5). Semantic grounding edits require § *Correcting Grounding Where It's Wrong* and defer grading edited goals; completed identifier-only repairs do not.

Read `./references/workflow/execution-loop.md` before working; §4 and §7 bind its six parameters. Then read the pack files Core Rules 2 names and any per-surface checklist the work touches.

## When to Use

**Use when** the user asks to implement, execute, run, carry out, or resume a task or its plan, by task folder, by `plan.md`, or by a task already established in this session. **Skip when** no task folder exists yet (`plan-task`), the work is too small for a plan (`implement`), or the plan is still being iterated on. A plan whose `**Status:**` is `skipped` runs only after the user confirms reviving it; never silently run an abandoned plan. On confirmation, §3 takes the registered `skipped → executing` revive (`./references/workflow/task-lifecycle.md`).

## Process

### 0. Prepare Against Authoritative Sources

Establish ground truth per `./references/workflow/execution-loop.md` § *Ground truth before work*; the domain's `execution.md` carries the recipe. Record the sources you ground the work on, and any pattern you couldn't ground, in the result file's `**Sources:**` field (§5), never in code comments.

### 1. Locate and Load the Task

**Resolve the folder** per the **resolve-current-or-ask** rules in `./references/workflow/task-layout.md`, and announce the resolved folder before this run's first write. A folder under `Backlog/` takes the activation offer in `./references/workflow/implement-task-edges.md` § *Activating a backlogged task*. <!-- cold -->

**Then load it** in the order `./references/workflow/task-layout.md` § *Reading a resolved folder* fixes:

- Report the loader's `applied`, `mappings`, and `unresolved` before relying on its returned `state`. A null `state` with no readable plan routes by any `approaches.md` decision and open approach-wait entry under `./references/workflow/task-approaches.md` § *Other readers and writers*, else to `plan-task`. A failed repair stops execution. Unresolved structure cannot count as complete goal coverage.
- `approaches.md`, when present: read its `**Decision:**` line and any plan `## Open Questions` entry citing it. When it reads `selected`, also read the decision anchor its `## Current decision` cites and the plan's `## Approach` citation. Also read each approach-wait entry in the task's `CONTEXT.md` `## Open Questions` and test whether it is open (`./references/workflow/task-approaches.md` § *Approach-wait entries*). Launch no step that `./references/workflow/task-approaches.md` § *Other readers and writers* holds. Stop before a held step and close with §9's Handoff block, pointing at what the hold awaits. The block's Next is `/plan-task` for that section's approach-citation stop, else `/choose-approach`. When it is the first step this run would launch, stop before any status flip or worktree re-entry. The sole exception is a confirmed `skipped` revival: take only §3's revival and reload, then apply this hold.
- `goals.md` missing: stop and tell the user. Never invent goals.
- `CONTEXT.md`: its header for `**Domain:**`; the approach-wait entries the bullet above reads; its prose when a step's packet (§4) turns on it.
- Read shared grounding from the folder's current location on every invocation. Resolve material contradictions before dependent steps or acceptance under § *Correcting Grounding Where It's Wrong*. Record both statements and sources. Unresolved material contradictions or impactful choices take `../../CORE_RULES.md` § *Ask Before Assuming* before dependent writes.
- `ticket.md` is the product-facing ask; the gate runs against `goals.md`, not the ticket.
- A `currentState` block or any checked step means a prior session got partway: pick up there, never redoing completed steps. Then branch on the plan status (`./references/workflow/task-lifecycle.md`):
    - `blocked`: read the result's `## Blocked` section. For a sibling citation, apply the pre-write check below before flipping the plan back to `executing`. Once the blocker clears, return the plan to `executing` and remove `## Blocked` before resuming.
    - `in-review`: read the result's active `## In review` section (`./references/workflow/task-lifecycle.md` § *Companion result file*). When implementation is complete, including any unchecked step whose only remainder is an explicitly open verification leg, take `./references/workflow/implement-task-edges.md` § *Verification-only continuation* before worktree re-entry. Do not re-run completed steps. On that path, re-gate `(external)` goals against available confirmation, each engineering check through `./references/engineering/acceptance-gate.md`, and a goal named by `**Grounding corrected:**` against live behavior on its new wording, then §8. Actual unimplemented work returns to `executing` and §4 after the normal re-entry decision.

**A `to-do` or `blocked` plan checks sibling citations before any status flip or worktree re-entry.** Check the sibling citations on the `**Depends on:**` line of the first step this run would launch, as §4's **Source** binding does. Apply `./references/workflow/task-siblings.md`. When one is unmet, stop and close with §9's hand-off naming the current wait, even if the recorded wait differs. For a `to-do` plan, create no branch, worktree, or `result.md`, leave the plan at `to-do`, and write no `## Blocked` section. For a `blocked` plan, leave it `blocked`, write no new `## Blocked` section, and do not rewrite `## Current state`.

**A branch in `**Pointers:**` identifies delivery work**: after the verification-only decision above, resolve it for implementation per `./references/workflow/implement-task-edges.md` § *Task worktree*. A removed-branch marker remains a delivery pointer, not a worktree to recreate. <!-- cold -->

### 2. Decide Execution Mode

Ask the user, or infer from the request:

- **Step-by-step**: one step, update both files, pause. Default for risky or large plans.
- **Full plan**: every step end-to-end, recording each outcome (§5). Default for plans of three steps or fewer, or an explicit "run the whole thing".

Step-by-step pauses after each step's unit outcome and health boundary (§4). Automatic parallel batches remain full-plan only. Establish authorization for checkpoint and final commits under `./references/workflow/task-delivery.md` § *Checkpoint and final commits*, independently of execution mode or requested step range. Propose any missing commit grant here, before §3's capture, or leave those commits off. <!-- cold -->

### 3. Initialize Execution State

**Create the task branch and worktree first**, unless §1 re-entered one, when the resolved `**Domain:**` is `engineering` and the resolved repository holds at least one path a plan step names. Creation is announced, and `**Pointers:**` carries the branch. A doc or bureaucratic task, or one for which no root resolves, skips creation silently. Every other run follows `./references/workflow/task-delivery.md` § *Branch and worktree creation* for **Which repository**, the naming, the sanction, the degrade, and the one skip that announces itself. <!-- cold -->

Create `<task-dir>/result.md` when absent, from the header and `## Current state` block of `./references/templates/result.md`, dated today; it carries no `**Status:**` header of its own.

Use `./references/workflow/task-result.md` for the header and all current records.

When §2 granted implementation commits, capture and inspect the shared tree's existing staged and unstaged changes before the first step, per `./references/workflow/task-delivery.md` § *Checkpoint and final commits*. <!-- cold -->

Keep the task's settled decisions at their live homes. Append their full records under `./references/workflow/task-history.md`.

Then point the plan's `**Result:**` line at `./result.md` and flip its `**Status:**` from `to-do` to `executing`.

**Reviving a `skipped` plan**, only after the confirmation *Skip when* requires: `./references/workflow/implement-task-edges.md` § *Reviving a skipped plan*. Reload with structural repair after the plan leaves `skipped`. After reloading, apply any §1 approach hold before proceeding to worktree re-entry or step execution. <!-- cold -->

### 4. Execute Steps

Run the loop in `./references/workflow/execution-loop.md`: the five beats, the two verification tiers, Stop-the-Line when required evidence fails.

**This skill's bindings:**

- **Source**: one unit is one plan step; its criterion is that step's `Verify` line. Stay inside the plan's scope; respect `Depends on:` ordering in both modes. Before launching a step whose `**Depends on:**` line cites a sibling task or one of its steps, check each such citation under `./references/workflow/task-siblings.md`. When one is unmet, stop under **Blocked** and name that sibling task or step as what the step awaits. When that rule leaves it unmet awaiting merge of the sibling's branch, also name that branch as awaiting merge. When that rule awaits merge of a commit, also name commit `<sha>` as awaiting merge. When that rule leaves a citation unmet awaiting the sibling task's final commit, also name that sibling task as awaiting its final commit. When it leaves a citation unmet awaiting commit of the cited step, also name that sibling step as awaiting its commit. For either commit blocker, tell the user to update the applicable record in the sibling's `result.md` if the work was committed by hand. Name the record and `**Commit:**` line under `./references/workflow/task-siblings.md`. When the sibling proof finds no commit to establish coverage, also name revising this plan's `**Depends on:**` line through `plan-task` as the user's action if the cited work produced no commit. When that rule leaves a step citation unmet because the cited step is missing from, or unchecked in, the sibling's `done` plan, name that sibling step as what the step awaits, with that outcome. Name revising this plan's `**Depends on:**` line as the user's action. When that rule leaves it unmet awaiting update of the local default branch, name updating the local default branch as the user's action. When it awaits update of the local base branch `<base>` instead, name updating that branch as the user's action. When it instead awaits a PR head that is not available locally, also name that PR head as missing locally. Name fetching `refs/pull/<n>/head` under that rule as the user's action. When it instead awaits updating the task's own branch, name updating that branch from the default branch or `<base>`, as that rule names, as the user's action. When it awaits update of the current checkout, name updating the current checkout as the user's action.
- **Inherited grounding**: the group sources §1 loaded travel with the step, identified by root and path, per the `implement-task` binding in `./references/workflow/executor-coordinator.md` § *Bindings*. A step whose grounding contradicts it does not launch until §1 has ruled. None of those files is ever on an executor's edit surface; a grounding correction is the coordinator's, never delegated.
- **Record**: write or update the step's own record (§5) once the step's outcome and, where it carries one, its health boundary have run.
- **Mark done**: flip `- [ ]` to `- [x]` and append the result-section link:

    ```
    - [x] **What:** <unchanged> ([result](./result.md#step-1--add-csv-writer))
    ```

- **Pause or continue**: step-by-step stops after each step and reports; full-plan continues. Finish any authored checkpoint and, once local implementation is complete, §7's final commit gate before pausing.
- **Blocked**: a Stop-the-Line that can't clear this session. Set the plan's `**Status:**` to `blocked`; write a `## Blocked` section in the result file naming what failed, what was tried, what's needed or awaited, and the last health boundary that passed with what it covered (`none` where none did); rewrite `## Current state` naming the blocker; stop. Never skip ahead.
- **Health boundaries**: every step-by-step pause, after the step's outcome proof and before recording the result; every authored checkpoint after its assertions; each natural batch bound before dependent work; the final implementation boundary before acceptance in either mode; and every later-run `in-review → done` finalization, as a fresh boundary recorded in Acceptance's `**Health:**` field. A final-step pause, checkpoint, or batch bound shares the final health pass when it covers the unchanged final implementation tree. Between boundaries a step proves only its own outcome tier (`./references/workflow/execution-loop.md` § *Two verification tiers*); the integrated recipe (`./references/engineering/verification.md` for code) runs only at the places above, and health is current only when its last boundary ran on the final unchanged tree. A failed finalization boundary takes the registered `in-review → executing` edge, then **Blocked**.
- **Integration assertions**: the plan's `### Checkpoint after Step N` headings, each mandatory after marking step N done. A checkpoint is not a step, carries no `- [ ]`, and is never flipped. Run its assertions, then its health boundary. When §2 granted checkpoint commits, the coordinator then applies `./references/workflow/task-delivery.md` § *Checkpoint and final commits* from the shared tree, never an executor worktree, running `commit` as that section directs. Update the checkpoint record (§5) after any authorized commit attempt. Then take **Pause or continue** above. <!-- cold -->

#### Execution strategy: every step delegates

Execute each step through the selected engine in `./references/workflow/executor-routing.md`, under `./references/workflow/executor-contract.md` and the `implement-task` binding in `./references/workflow/executor-coordinator.md` § *Bindings*. Its **Segment bound** fixes the launch shape; serial steps and segments use the shared tree.

**Every step goes to an executor** per `./references/workflow/write-mode-posture.md`, which fixes what a launch packet owes and the three exceptions that keep a step here. Capture the `baseline` manifest of the shared tree before launching, one per segment. **Deviation is measured against the mode's default launch on `native`**; `**Executed:**` (§5) records it and any explicit selection. While an executor is in flight the coordinator waits, with no step of its own and no shared-tree edit (`./references/workflow/delegated-waiting.md` § *How to wait*). Then take each report through `./references/workflow/executor-coordinator.md` § *Write-mode routing* intake, which decides whether the outcome tier is re-proved here, and record the step (§5); a failure there is Stop-the-Line at that step, and a pending impactful choice takes that section's third outcome: ask, hold the step and its dependents, and keep the plan `executing` while the answer arrives in this run. A choice still open when the run ends takes this binding's **Blocked** (`./references/workflow/execution-bindings.md`): the plan enters `blocked`. Its `## Blocked` section retains the `Pending choices` details from `./references/workflow/executor-contract.md` § *Evidence report*, naming the held step, so §1's resume branch finds it.

**Inline is an exception, announced and recorded** in `**Executed:**` (§5), on one of the posture file's three exceptions. A failed or hung executor is reported and takes the binding's **Fallback**; on a segment, `./references/workflow/executor-coordinator.md` § *Segment launches* governs what stands and what relaunches. <!-- cold -->

#### Automatic parallel batch (full-plan mode)

Eligible independent steps run concurrently through the same contract and binding. Eligibility, launch, merge, and the checkpoint hand-off are `./references/workflow/implement-task-edges.md` § *Automatic parallel batch*, read when steps declare `**Touches:**` surfaces in full-plan mode. No `**Touches:**` line, or `**Touches:** none`, means serially delegated. <!-- cold -->

### 5. Result File: Sections

Use the keyed sections of `./references/workflow/task-result.md` and the fields in `./references/templates/result.md`. In both modes, write each step under its own stable heading in plan order. Update that section in place on a retry or verification-only run.

Each step record fits `RECORD_MAX_KB` (`./references/workflow/task-layout.md` § *One task, one flat folder*). Summarize the accepted evidence: changed outcome, required checks and statuses, material deviation or failure, and a stable evidence path, anchor, or short diagnostic. `**Verified:**` names `executor` / `coordinator` per check, distinguishing assigned coordinator checks from re-proofs and retaining pending/open checks. Keep command results, not output tails or request/response transcripts; check definitions and proof follow `./references/workflow/executor-contract.md` § *Evidence report* and `./references/workflow/executor-coordinator.md` § *Write-mode routing*.

`**Health:**` records the boundary to the domain's shape (`./references/engineering/verification.md` § *What a boundary records* for code); omit it when a checkpoint owns the boundary.

`**Executed:**` records explicit selection, external launch evidence, and announced fallback under `./references/workflow/executor-routing.md` § *External launches and recovery*. Omit it only when `native` was selected by default and ran the mode's unchanged default launch: per-step serial in step-by-step, its checkpoint-bounded segment in full-plan. Otherwise name the engine and launch form: "parallel batch (<engine>), merged in plan order at/before <the §4 merge point>", "serial delegation (<engine>)", or "inline (<not specifiable / delegation unavailable / executor failed> — <detail>)". For a relaunched segment, name its step range and engine on each affected step.

Record shared health evidence once at its owning step or checkpoint. At a natural batch bound without a checkpoint, use the last merged step and link the shared evidence from the other steps. Use the reference, delta, command outcomes, and manifest evidence required by `./references/engineering/verification.md`. For a failed step or checkpoint, record the decisive failure, what was tried, and the action needed to unblock it.

Update the applicable `## Live verification` entry under `./references/engineering/acceptance-gate.md`. Record unresolved downstream checks in `## In review` while parked.

A failed checkpoint records the `**Asserted:**` and `**Health:**` results that ran (or `not run`), `**Outcome:** failed`, `**Commit:** not run — checkpoint failed` when commits were granted, and the failure details, then follows Stop-the-Line. Record checkpoint and final commit outcomes, including failure and resume settlement, per `./references/workflow/task-delivery.md` § *Checkpoint and final commits*. The Final implementation commit block points at the final health boundary's owning section; keep that evidence once.

Refresh `## Current state` after each unit, Status change, and run. Update outstanding items in `## Open findings` under `./references/workflow/task-writes.md`. Keep only the wait section for the current Status and remove it when that wait ends.

### 6. Plan Revisions Mid-Execution

When implementation reveals the plan is wrong (a step infeasible, scope wrong, a step missing or too large for one slice), apply `./references/workflow/execution-recovery.md` § *Scope changes mid-execution*. The in-place plan update, the `**Deviations from plan:**` record, and the abandon flow are `./references/workflow/implement-task-edges.md` § *Plan revisions*. <!-- cold -->

### 7. Acceptance Gate

In step-by-step and full-plan modes, once local implementation is complete, require a green final implementation health boundary (§4). When §2 authorized it, run the final commit gate under `./references/workflow/task-delivery.md` § *Checkpoint and final commits*. Before acceptance, settle any pending final commit even when all implementation steps are checked. A verification-only continuation takes §1's observation path instead.

After local implementation is complete, including when only explicitly open verification legs remain, and **before** the plan flips to `done`, run the gate against `goals.md` per `./references/workflow/execution-acceptance.md`: every `G<n>` goal gated against live behavior, the verdict in a single `## Acceptance` section of the result file copied from the template, one line per goal with its tag and the evidence, caveat, or awaited confirmation. For engineering, also resolve and run every applicable deployment/browser check in `./references/engineering/acceptance-gate.md`, even when the plan's `## Live verification`, a goal, or a repository declaration omitted it. Scope deferral does not waive this gate for affected delivered work.

**Tag each goal** `met`, `met with caveats`, `unmet`, `out of scope`, or `pending external`. `out of scope` **only when the plan's `## Scope` lists that goal ID in its deferred partition**; a goal that isn't there drifted in after planning, so surface it rather than dropping it. `pending external` **only for a goal carrying the `(external)` marker** whose verification you can't perform in-session, recording what's awaited and who verifies it; undone agent-verifiable work is `unmet`.

**Any goal `unmet`: do not finalize.** Apply Stop-the-Line: localize the gap, then either revise the plan and return to execution, or surface a goals misunderstanding for the user to edit and re-run the gate.

**Any goal `met with caveats`: secure explicit user acknowledgement before finalizing**, and record it in that goal's `## Acceptance` entry. An unacknowledged caveat is treated as `unmet`.

**Any goal `pending external` or engineering live check awaiting downstream verification: park at `in-review`**, once every other goal is `met`, acknowledged, or `out of scope` and no observed live failure remains. Then take §8's `in-review` branch. Record each pending check per `./references/workflow/task-lifecycle.md` § *Companion result file*. Failed behavior or a wrong healthy release is unmet work and returns to execution.

### 8. Finalize

"Acknowledged" below means the §7 acknowledgement for every `met with caveats` and `out of scope` goal.

**Park at `in-review`** when local implementation and agent-verifiable goals are satisfied but downstream verification remains:

- The plan's `**Status:**` to `in-review`
- One `## In review` section with each pending goal, check, and verifier under `./references/workflow/task-result.md`; **no** `**Completed:**` line
- The shared loop's *Before presenting* step (`./references/workflow/execution-acceptance.md` § *Before presenting*); the summary names which goals are `met` and what external verification is outstanding

**Finalize to `done`** only once every goal is `met` or acknowledged, none is `pending external`, and every applicable engineering live check passed or has a supported `not applicable` disposition:

- The plan's `**Status:**` to `done`
- A closing `**Completed:** YYYY-MM-DD` line in the result file, written only at `done`
- The shared loop's *Before presenting* step (`./references/workflow/execution-acceptance.md` § *Before presenting*)
- The task worktree and branch removed **after** that step and last of the four, per `./references/workflow/task-delivery-edges.md` § *Removal*: merged PR and clean tree, else refused with the reason, never forced. Refusal is recorded and never blocks the finalize. <!-- cold -->

Write finalization health or its owning-section link in Acceptance. In **both** branches, rewrite `## Current state` last, after the removal, so `**Pointers:**` records whether the branch survived; at `in-review` its `**Next:**` names the awaited verification.

**Reaching `done` from `in-review`** on a later run: `./references/workflow/implement-task-edges.md` § *Reaching done from in-review*. <!-- cold -->

### 9. Hand Off

Close each completed run with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*), composed after §8's *Before presenting* summary. A step-by-step pause, a **Blocked** stop, §1's sibling-citation stop, and §1's approach hold close with it too.

- **Done:** the steps and checkpoints this run completed and the plan status reached, each pointing at its `result.md` section.
- **Know:** goals short of `met` and verification still outstanding, pointing at `## Acceptance` or `## In review`. Name the task's handoff token, the task branch and worktree, checkpoint and final commits, uncommitted changes, and a refused removal's reason. Name each surface a grounding correction changed.
- **Awaiting you:** what the result's `## Blocked` section needs or awaits, pointing at it and repeating none of its choice details. After §1's sibling-citation stop, what the first step awaits and any user action, named as in §4's **Source** binding. Include §4's manual commit-record action for awaiting-commit stops. After §1's approach hold, what that hold awaits: the pending approach choice, the gating `## Open Questions` entry, the open approach-wait entry, or the plan revision the approach-citation stop needs.
- **Next:** `/implement-task` continues after a pause or an `executing` stop, resumes once a blocker clears or §1's awaited citation is met, and re-gates an `in-review` plan once its awaited verification is reported. Once implementation is complete (`in-review` or `done`) and the task branch is unmerged, `/review-code` reviews committed work. When automatic commits were off, `/commit` takes staged changes first. A `done` plan whose work merged takes `/archive-task`. After §1's approach hold, `/choose-approach` takes a pending comparison, a gating `## Open Questions` entry, or an open approach-wait entry, and `/plan-task` takes the approach-citation stop.

## Correcting Grounding Where It's Wrong

When execution disproves a factual claim, correct its owning surface: `CONTEXT.md`, `goals.md`, `ticket.md`, or an applicable `GROUP_CONTEXT.md`.
Apply the grounding, ticket, and group correction rules of `./references/workflow/task-writes.md`. Record a step's correction in its `**Grounding corrected:**` field. Keep the current rule and reason at the owning surface and append the decision under `./references/workflow/task-history.md`.

After a semantic goal edit, finish authorized steps and leave the edited goal for a subsequent run under `./references/workflow/task-progress.md`. At executing, name the goal and its pending verification in Open findings. At in-review, include it in the active wait. A goal that fails §7 stays unmet. Route a newly uncovered requirement or a changed ask requiring redesign to `plan-task`.

Announce corrections in the run's closing summary, grouped by surface.

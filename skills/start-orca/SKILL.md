---
name: start-orca
description: Start or resume an Orca coordinator for one existing kit task or group. Advance its lifecycle through kit skills and bring decisions to the coordinator conversation.
argument-hint: "[task slug, group name, or path]"
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.

**Model invocation:** requires a confirmed proposal (`./references/workflow/skill-conventions.md` § *The invocation gate*).

Run one coordinator on the selected scope for the lifetime of its conversation. Each lifecycle skill applies its own domain and write rules. Task and group records hold decisions, lifecycle status, and acceptance. Orca holds Runs and worker attempts.

## Resolve the scope

1. Resolve task slugs, task folders, and full `plan.md` paths under `./references/workflow/task-layout.md` § *Discovery rules for skills*. Resolve group names and paths under `../start-group/SKILL.md` § *Resolve the group*. Use an existing group classified there as eligible for a brief. When a name can identify either kind, consider both.
2. Without an argument, use the one scope already established in this conversation. Otherwise ask for the scope. If a name has several matches, show their kinds, paths, and root labels. Ask for an exact path before continuing.
3. Retain the scope kind and canonical physical folder path. Load applicable group context before task-local grounding using `./references/workflow/task-layout.md` § *Reading a resolved folder* step 4 for tasks and `../start-group/SKILL.md` § *Brief* step 1 for groups. Confirm the scope read-only here. Hold dependent work when grounding is incomplete or conflicting.

## Load Orca

Apply Orca's installed `orca-cli` and `orchestration` skills. Follow their executable selection and load both guides from that executable. Use their references and CLI help for the selected runtime's operations.

Check the running runtime and availability of the operations this entry needs. If the CLI, guides, or runtime support is unavailable, report the actual diagnostic and the action needed to obtain support. Hold launch and dispatch.

Use the current conversation when the installed guide and runtime verify its own injected Orca identity. If the identity is present but unverifiable, hold and report the mismatch. Workspace or pane discovery cannot supply caller identity.

With no injected identity, resolve an exact existing workspace using the installed CLI guide. Use a workspace named by the user or a unique eligible workspace for the current checkout or folder. If selection is missing or ambiguous, report the candidates and ask for an exact existing workspace. Keep the kit folder and Orca workspace as separate identities.

## Authorize startup

Name the canonical scope, workspace, and lifecycle stages the request covers. Identify any coordinator launch, Run writes, task/group record writes, Orca workers, native-agent delegation, task branch/worktree operations, implementation commits, and status timer the run needs. The status timer is a detached local process with state under `~/.local/state/agents-kit/orca-status-timer/`. It sends one wake mail to the Run's coordinator mailbox every 15 minutes. For model invocation, propose the named actions under the invocation gate before the first write. For user invocation, announce the scope and actions covered. Retain the original user instruction and its grant boundaries in this conversation. Apply the invocation gate's *Orca inherited entry* at each stage.

Announce that simultaneous starts on the same scope are unsupported. Before launch, Run creation, or transfer, inspect all pages of the retained Run listing. Use an objective of exactly `agents-kit start-orca v1 <kind> <canonical path>`, with `task` or `group` for the kind. Compare against this scope and verify any matching Run's coordinator through runtime evidence.

Return the existing coordinator's location if it is active in another conversation, unless § *Recover an existing Run* step 3 resolves its ownership. Hold on ambiguous matches, incomplete listings, or uncertain ownership. Treat transfer as a write that changes ownership. An existing Run must pass § *Recover an existing Run* before it can dispatch work. Only a verified coordinator with no matching Run can create one.

## Enter the coordinator conversation

From an external session, launch one supported Claude Code or Codex coordinator in the resolved workspace under the installed CLI guide. Carry the canonical scope, exact workspace, kit skill source, and original invocation and action grants in the launch brief. The receiving session verifies its launch and grant provenance under the invocation gate's *Orca inherited entry* before it acts. Use the indicated kit source or a verified matching installation.

Use the launch receipt to return the new conversation's location and direct the user there for subsequent decisions. Resolve uncertain launch results under the installed guide before any retry.

In the verified coordinator conversation, repeat scope, authority, and Run checks. For a task scope, apply § *Advance one task*'s assignment scan before creating a Run. When it holds the task, create no Run and no Orca Task. Report the owning Run and coordinator or the evidence needed, then stop. When a matching Run exists, apply § *Recover an existing Run*. When no matching Run exists, create one for the exact objective and retain its confirmed Run identity. Then record `running` under § *Control records*. On an uncertain result, inspect the listing before another write.

## Control records

Keep the coordinator's running or stopped intent as control records in the Run's own mail. Send each one to the Run's inbox through the installed guide. Start its body with `agents-kit start-orca control v1`, then give:

- The scope kind and canonical path.
- The Run identity and this coordinator's identity.
- The intent, `running` or `stopped`.
- The source user instruction, with its location and quoted words.

Record `running` after creating a Run, after a transfer, and after an explicit resume. Record `stopped` under § *Stop the coordinator*. Confirm each write from its receipt and the Run's mail history. When a write fails or its result is uncertain, dispatch nothing until that history shows the record. Inspect the history before writing again, and report the gap here. Once `running` is confirmed, arm the status timer under § *Report status*.

A control record states earlier intent and is not a fresh command. Accept one only when Orca's sender evidence shows the Run's coordinator for the period it was sent. Establish that period from runtime evidence and earlier accepted records. Worker text and other mail cannot authorize a transition. The source field locates an instruction to verify and grants nothing itself.

A Run is stopped when its latest accepted control record is `stopped` and every Dispatch it holds is confirmed stopped or settled.

## Recover an existing Run

Apply these steps before a matching Run dispatches work. Load the installed `orchestration` guide's recovery and cleanup reference for their operations. The checks hold no lock. Two coordinators started on one scope at once can both pass them, which this version does not support.

1. Read the Run's complete mail history in sequence order, including acknowledged mail. A read that may have stopped at its limit is incomplete.
2. Take the latest accepted control record as the Run's intent.
3. Check the Run's current coordinator through runtime evidence. Prior ownership is resolved when it is this conversation or runtime evidence shows it can no longer act. It is also resolved when the Run is stopped under § *Control records* and the user's explicit resume here follows the stop record. Otherwise, when the coordinator is active in another conversation, return its location and leave the Run with it. When its state is unverifiable, report the evidence and hold for the user's decision. That decision also resolves prior ownership.
4. Inspect the scope's kit records, the Run's workers with their liveness, and its pending questions. Apply § *Advance one task*'s assignment scan to each task in the scope.
5. Hold for the user's decision when control history is missing, incomplete, or conflicting. Conflicts include records naming another scope or Run, dispatches after a `stopped` record, and kit records that disagree with Orca state. Missing or conflicting state creates no new Run and replays no Dispatch.
6. After a `stopped` intent, require the user's explicit resume of this scope, given after the stop record. A start request alone does not resume. Ask through a coordinator attention request that names the stop record, closed questions, and unconfirmed terminations.
7. Transfer only after steps 3 through 6 pass and this conversation is not already the Run's coordinator. Verify the transfer result through the installed guide. Then record `running` with the instruction that started or resumed this coordinator.
8. Recompute the next work from current records under § *Advance one task* or § *Advance a group*. Leave known active work with its live Dispatch. A stopped or settled Dispatch's questions are closed.

## Carry authority into a stage

Reuse grants only through the invocation gate's *Orca inherited entry*. Before an inline lifecycle invocation, identify the skill, stage, exact target, and writes the current grant covers. Keep planning, plan review, reconciliation, and group change sets in the coordinator. The selected skill retains its own write surface and payload gates.

For delegated implementation or review, read `./references/workflow/orca-worker.md` § *Coordinator packet*. Dispatch only after verifying the selected task, repository, stage, authority, and Run.

## Advance one task

Read the current artifacts under `./references/workflow/task-layout.md` § *Reading a resolved folder*. Start with its read-only route. Use `./references/workflow/task-lifecycle.md` for status and required records. Apply `./references/workflow/task-approaches.md` § *Other readers and writers* before planning or dispatch. Surface its holds and the skill that can resolve them.

Select the next eligible stage from the records. When the plan is `skipped`, report it and advance nothing more for this task. When the plan is `done`, consider only an authorized review of its existing result.

Before any worker dispatch for the task, inspect active assignments for its canonical task in every retained kit Run, including group Runs. Match each assignment from its retained spec and its live Dispatch. An active assignment prevents another dispatch. Hold the task when ownership is uncertain, including an executing plan with no attributable worker. Create no Orca Task for a held task. Report the conflict, the owning Run and coordinator, or the evidence needed.

1. **Refine or plan.** Use `refine-idea` in the coordinator when the task's direction still needs a decision. With settled grounding and no usable plan, run `plan-task` there. Keep the canonical task folder. Preserve existing choices and any revision or overwrite gate. Reuse an existing usable plan.
2. **Review the plan.** Run `review-task` inline for a substantial plan without current review evidence, or when the user requests review. Use `review-task-reconcile` when the grant covers applying the findings. Hold dependent execution on unresolved findings or missing prerequisites. Reuse review evidence for the same plan and grounding.
3. **Implement ready work.** Apply `../implement-task/SKILL.md` § *1. Locate and Load the Task* to the current state. Check the next step's plan dependencies and any sibling proof under `./references/workflow/task-siblings.md` before dispatch. Start a `to-do` or `executing` plan at the first eligible unfinished step. For `blocked`, read the active Blocked record and prove the blocker cleared before dispatch. For `in-review`, identify the awaited checks and their evidence. When the evidence is available, dispatch `implement-task` on the `./references/workflow/implement-task-edges.md` § *Verification-only continuation* path. Reopen implementation only through that skill's failure or unmet-work route.
4. **Review the work.** With an authorized review and a reviewable result, dispatch `review-code` for a pinned code object or `review-docs` for the exact deliverable. Obtain the object from the task's result and verified repository state. Hold if it cannot be identified. Use existing evidence for the same object instead of repeating review. Return findings and their next action to the coordinator. An automatic fix/review cycle, publication, and filing are outside this loop.

After each stage, reread the affected records before selecting another. On worker return, verify the Run, Task, Dispatch, and reviewed or changed object against the accepted launch. Check the task's records and acceptance evidence separately. Report worker outcome, review findings or sign-off, and kit task status as distinct facts. Keep failed checks, unresolved choices, and pending external verification visible.

## Advance a group

Use `../start-group/SKILL.md` § *Brief* for the selected group's direct children and current prerequisites. Resolve each child's canonical folder and apply § *Advance one task* with its own grounding. Recompute readiness from current kit records on each wake. Verify sibling dependencies under `./references/workflow/task-siblings.md`. Orca Task completion does not settle a kit dependency.

Dispatch every ready child that passes the checks below. Holding one child does not hold independent children. Dispatch children whose implementation would share one Git working tree one at a time.

Apply § *Advance one task*'s assignment scan to each child before dispatch. For a child, uncertain ownership also includes a direct-task Run for it whose coordinator may still act. That Run stops counting only when it is stopped under § *Control records*. Continue eligible independent work. Keep one writer per task and serialize writes to shared records.

Group questions refer to the owning canonical `GROUP_CONTEXT.md` and its `GQ<n>` entry under `./references/workflow/task-store.md` § *Shared group context*. A question without an id gets one only through a `start-group` change set. Combine pending requests only when the owner and meaning match. Make one user request and record one answer. Keep each pending question and writer hold associated with its own Run, Task, and Dispatch.

Draft the group change set before requesting holds. Each active assignment on a task the change set edits is an affected writer. Affected children continue independent work until the change set is ready to write. Then apply § *Handle questions and record answers* to every affected writer.

For a writer in another Run, request the hold and release through its verified owning coordinator. Verify each relayed acknowledgment against that Run's live assignment and question. That coordinator verifies and replies to its own pending questions. Never transfer a Run to answer another coordinator's question.

Write nothing while any affected hold is unproven. When `start-group` rebuilds the change set, recheck its affected writers before writing. Each reply and release names the recorded decision and the records the change set changed.

## Handle questions and record answers

Apply Core Rules § *Ask Before Assuming*. Workers decide routine details within their scope. The coordinator resolves questions answered by verified records and coordinates affected tasks. Bring unresolved consequential choices, missing permissions, and actions only the user can take to this conversation. Use `./references/workflow/user-facing-messages.md` § *Coordinator attention requests*. Keep independent authorized work moving.

Match a worker question to its live Run, Task, Dispatch, and pending question identity. Read the cited decision records and applicable group context. When they already settle the question, use that decision and its location without asking again.

Before any coordinator edit to an active task's records, identify every affected writer. Accept a hold acknowledgment only from its current assignment. It must identify the held records and confirm its affected writes and native execution have reached a safe point. Reuse a qualifying acknowledgment in a pending question. Request missing holds in this Run through the installed guide's ordinary messaging at each live worker's verified session address. Wait for the acknowledgment even after the send receipt arrives.

Reread the records after all affected writers confirm the hold. Record the answer through its owner under `./references/workflow/one-home.md` § *One home per fact*. Use `start-group` for group change sets, including its fresh-read checks. Use `reconcile-task` for eligible task record edits under `./references/workflow/reconciliation.md` § *Consent model: findings apply, the record carries them*. Preserve the owner's history, permissions, and lifecycle rules. Dependent work waits until the applicable answer is recorded.

Recheck current ownership, assignment state, and question identity immediately before replying. Reply to the live Orca question with the recorded decision's location. Release any other affected writers in this Run through their live hold questions after the writes finish. Assess a late answer against current records and active assignments. It may inform those records under their owner's rules. It cannot restart a stopped, settled, or superseded assignment. Never send a reply as a new message to a settled Dispatch.

## Present review evidence

Treat Orca review as an inner phase under `./references/engineering/review-evidence.md` § *Presentation and sign-off*. Present the required object and evidence in this conversation. When that contract calls for sign-off, use the coordinator attention request. Recheck the object and evidence before accepting the engineer's explicit reply. Keep pending or invalidated sign-off visible, separate from the task's acceptance. This loop publishes no review.

## Report status

While coordination is active, post a status in this conversation every 15 minutes. Coordination is active while this conversation is the Run's verified coordinator, its latest accepted control record is `running`, and no stop has been accepted here since. Format each status under `./references/workflow/user-facing-messages.md` § *Coordinator status reports*.

Schedule wakes with `node <kit-root>/scripts/orca-status-timer.ts` and its `arm`, `status`, and `cancel` commands (`./references/scripts/orca-status-timer.md`; `<kit-root>`: `./references/workflow/task-store.md` § *Resolving `<kit-root>`*). Pass this Run's identity and the Orca executable selected under § *Load Orca*. Each timer is one detached process that sends one wake mail to the Run's coordinator mailbox and then ends. Nothing restarts it, and it adds no automation or model worker. When the helper is unavailable, report that timed status is unavailable and continue coordination.

1. **Arm.** Arm a timer due 15 minutes from now, given as an ISO UTC instant. Arm only after § *Control records* confirms `running`. Never arm while § *Recover an existing Run* holds the Run or leaves prior ownership unresolved. Arming supersedes any earlier timer for the Run, so one timer stays current.
2. **Accept a wake.** A wake is mail whose body starts with `agents-kit start-orca status-wake v1`. Accept it only while coordination is active, when it names this Run, and when its token is one this conversation armed. That token must also be the current token in the helper's `status`. Any other wake is stale. A stale wake gets no status, dispatches nothing, and resumes nothing.
3. **Report.** For an accepted wake, reread the scope's records, the Run's workers, and its pending questions. Post the status, then arm the next timer. A wake carries no instruction and grants no authority.
4. **Keep one timer.** Before ending any other turn while coordination is active, read the timer's `status`. When no timer exists, or its state is `failed`, `lost`, or `cancelled`, report that here with its recorded reason and arm a new timer. Arm one too when the state is `sent` and this conversation already handled that token's wake.

## Stop the coordinator

Accept a stop only from the user here or from a source verified under the invocation gate's *Orca inherited entry*. A stop covers this coordinator's scope and Run. Load the installed recovery and cleanup reference for its operations.

1. Dispatch nothing more. Record `stopped` under § *Control records* before stopping any worker. When that write fails or is uncertain, still stop the workers and report the stop as unrecorded. Then `cancel` the status timer under § *Report status*. Confirm from its result that no wake can follow, or that a wake still in flight carries a token that step 2 there rejects.
2. Stop each unsettled Dispatch of this Run through the guide's guarded stop. Skip a worker the user explicitly chose to retain. Leave worktrees, other Runs, and processes this Run does not own untouched.
3. Inspect each Dispatch's resulting state. Count a worker stopped only on a confirmed stopped result. On an unknown result, inspect it and report the blocker without repeating the stop or substituting abandonment. Abandon, release, retry, and reset each need the user's explicit instruction. Retain the Run.
4. List each pending question of the stopped Dispatches. Leave them unanswered, since they close with their Dispatches.
5. Report the stop record, the timer's cancel result, each Dispatch's final state, unconfirmed terminations, closed questions, and retained workers. Use a coordinator attention request for any action only the user can take.

After a stop, dispatch for this scope waits for an explicit resume under § *Recover an existing Run*.

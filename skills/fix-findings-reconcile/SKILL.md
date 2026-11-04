---
name: fix-findings-reconcile
description: Use when asked to fix findings on a task's work and record the outcome in that task. Runs fix-findings, then reconcile-task against the session's task, behind one proposal and with one Handoff. Commits each concern batch through the commit skill, or the whole run as one commit under -1; never pushes or replies to sources.
argument-hint: '[source] [-e native|codex|claude] [-1 (one health boundary and one commit for the whole run)] — passed through to the fix phase'
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.

**Model invocation:** requires a confirmed proposal (`./references/workflow/skill-conventions.md` § *The invocation gate*).

Fix findings through `fix-findings`, then record the fixes, your picks, and the findings left open in the session's task through `reconcile-task`.

Phase 1 runs `../fix-findings/SKILL.md`'s full protocol; Phase 2 runs `../reconcile-task/SKILL.md`'s full protocol. Seven overrides apply pipeline-wide:

- **Core Rules blocks**: this block stands for both phases, so neither inner skill rereads `AGENTS.md` or `CLAUDE.md`. `fix-findings`' per-fix pack loads and `reconcile-task`'s domain-pack step still run.
- **Task resolution first**: resolve the folder under `../reconcile-task/SKILL.md` § *1. Resolve the Task Folder* before Phase 1 starts. Announce it before the run's first write. With no active task, stop before any edit and point at `/fix-findings`. Resolution only reads; the loader's identifier repair (`../reconcile-task/SKILL.md` § *2. Load Artifacts*) waits for Phase 2. Resolution still checks the plan's Status before loading (`./references/workflow/task-layout.md` § *Reading a resolved folder*, step 1). On a `skipped` plan, stop before any edit and point at `/fix-findings`. Phase 2 reuses the resolved folder.
- **Invocation gate**: this skill's proposal (§ *Phase 1 — Fix*) replaces `fix-findings`' model-invoked proposal (`../fix-findings/SKILL.md` § *The Gate: Auto vs Ask*). A typed command or a confirmed proposal makes both phases user-invoked. Phase 1 takes its batch commits (`../fix-findings/SKILL.md` § *Batch commits*) and executor delegation (`./references/workflow/executor-routing.md` § *The registry and its authorization*) from that invocation. Phase 2 takes its settled corrections from it (`./references/workflow/reconciliation.md` § *Consent model: findings apply, the record carries them*). A write holds only when the proposal named it. A proposal that left the corrections unnamed makes Phase 2 ask before each correction.
- **Phase boundary**: Phase 2 starts only after Phase 1 prints its Output. A Phase 1 stop that renders no Output (`./references/workflow/user-facing-messages.md` § *Blocks*), such as no findings, staged content, or a rejected flag, ends the run with no task-doc write.
- **Phase 2 stop**: a Phase 2 stop before any task-doc write, such as a loader exit 2 whose `recovery` is `none` or `restored` (`./references/workflow/task-layout.md` § *Reading a resolved folder*), ends the run with Phase 1's Output and commits standing. § *Output* states how the **Reconcile** section and the Handoff report the stop.
- **Chat display**: Phase 1's Output prints in full, except its Handoff, before Phase 2 starts.
- **Handoff**: neither inner Handoff prints; this skill's Output composes one block for both phases.

A phase departs from its skill only where these overrides or its section below say so.

Phase 1 edits working-tree fixes through delegated write-mode executors and commits them through `commit`, within the limits `fix-findings` sets. Phase 2 writes task docs within `./references/workflow/reconciliation-session-to-docs.md` § *Write surface*. The run makes no push, source reply, thread resolution, live-page write, or other Git mutation.

**Sanctioned writes.** Invocation sanctions three writes: executor delegation for every applied fix, a commit per concern batch or one commit under `-1`, and the settled corrections Phase 2 applies to the resolved folder. A proposal or Next line for this skill names all three (`./references/workflow/user-facing-messages.md` § *Blocks* → **The proposal line**).

## Flags

`-e native|codex|claude` and `-1` pass through to `../fix-findings/SKILL.md` unchanged, as its § *Flags* defines them. Neither changes Phase 2.

## When to Use

**Use when** you fix findings on the session's task's work and want its task docs to record the fixes, the options you picked, and the findings left open.

**Route from a review** to this skill only when the session has an established task and the reviewed work is provably that task's. Proof is one of three forms:

- a reviewed branch or PR that matches the task's `result.md` Pointers;
- a review started on the task folder;
- a reviewed document that is the task's deliverable or a path its plan names.

With an established task but no proof, offer this skill and `/fix-findings`, preferring `/fix-findings` of the two. That preference leaves the Handoff's overall recommendation open. Without an established task, propose `/fix-findings` alone.

`/fix-findings-reconcile` takes no task argument; its one positional argument is the findings source. A Handoff prints it bare, and a cold reader appends no handoff token. A cold session picks the task from the active list, as `../reconcile-task/SKILL.md` § *1. Resolve the Task Folder* does when no task is established.

**Skip when** no task applies, or the task's plan is `skipped` → `/fix-findings`; nothing needs fixing and only the session's findings need recording → `/reconcile-task`.

## Phase 1 — Fix

Execute `../fix-findings/SKILL.md` end to end, passing the source argument and the flags through unchanged.

After task resolution and once `fix-findings`' classification stands, a model-invoked run asks one proposal. It comes before any edit, executor launch, staging, commit, or task-doc write. It names the task folder, the findings, and the Auto fixes applied unasked. It names the executors for those fixes and for each option the Ask round approves. It names a commit per concern batch, or one commit under `-1`, and the settled corrections Phase 2 applies to the folder. The `Pre-existing` question and the Ask round still run through either door.

`fix-findings`' **Record** binding still holds, so Phase 1 makes no task bookkeeping (`../fix-findings/SKILL.md` § *Applying Fixes*).

## Phase 2 — Reconcile

Execute `../reconcile-task/SKILL.md` end to end against the folder resolved before Phase 1, with Phase 1's Output as session evidence. Phase 1's buckets add these rows to its session mapping (`./references/workflow/reconciliation-session-to-docs.md` § *`reconcile-task` — session findings*):

- **Commits** and **Fixed** take the session-narrative row. The Reconciliation entry names each landed SHA, each fixed finding, and the label of each option the user picked.
- **Fix failed**, **Retained, failing**, and **Health uncertifiable** findings go under Not reconciled as Needs work rows. So do **Decided** findings the user deferred, **Untouched** findings the run's selection excluded, and **Untouched** findings listed `not attempted`. Their owner is `/fix-findings-reconcile`, or `/plan-task` when the finding needs redesign.
- **Untouched** Inconclusive findings, triage `verify` entries, and `anchor moved` entries go under Not reconciled as Needs work rows, owner `/verify-issue`.
- **Untouched** external-page fixes held back by the working-tree write limit go under Not reconciled as Needs work rows, owner the user.
- Each Needs work row names its bucket and its reason.
- **Decided** findings the user rejected or skipped, and excluded `Pre-existing` findings, take the session-narrative row with their reason. So do **Untouched** Withdrawn findings, resolved threads, triage `addressed` entries, and `not actionable` complaints. None of them gets a Not reconciled row.
- Phase 1's **Awaiting decision** findings go under Not reconciled as Awaiting decision rows with their options and recommendation, owner `/fix-findings-reconcile`.
- **No result owed**: when the task has no result and is owed none (`./references/workflow/reconciliation.md` § *The record*), the printed change list and dated headings in the context or plan carry the record. Phase 2 creates no result solely to log the fixes.

Phase 1's health boundaries do not satisfy Phase 2's gate for status advances (`./references/workflow/reconciliation.md` § *Strengthen only on verified evidence*).

## Output

Lists, never tables.

- **Fix**: Phase 1's Output as `fix-findings` specs it, printed before Phase 2 starts, without its Handoff.
- **Reconcile**: Phase 2's findings report, **References**, and **Reconciliation applied**, as `reconcile-task` specs them, without its Handoff. After a Phase 2 stop, this section carries Phase 2's stop report instead.

Close with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*):

- **Done:** the landed commits and fixed findings, pointing at **Commits** and **Fixed**, and the reconciled task docs, pointing at **Reconciliation applied**. After a Phase 2 stop, Done drops the **Reconciliation applied** pointer.
- **Know:** the task's handoff token, and that the landed fixes are unreviewed. Point at **Delivery** for pending checks, and at `block` and `warn` rows under **References** and **Yours to apply** rows. Point at **Health uncertifiable**, **Retained, failing**, or **Fix failed** when they hold entries. With mixed code and documentation fixes, name the second review: `/review-docs` on each changed document. Name any compaction trigger Phase 2 left untested. Name fixes left uncommitted and what stopped them. Pushes, source replies, thread resolution, and live-page updates stay with the user. After a Phase 2 stop, state that no task record was written and why. When the loader's `recovery` is `partial`, name the `unrecovered` paths and their `recoveryErrors` instead.
- **Awaiting you:** point at Phase 1's **Awaiting decision** bucket and the **Awaiting decision** rows under **Not reconciled:**. Name any compaction proposal Phase 2 left awaiting your confirmation.
- **Next:** a review of the landed fixes, as `../fix-findings/SKILL.md` § *Output* names it: `/review-code` or `/review-code-triage-verify` over `<start>..HEAD`, or `/review-docs` for documentation-only fixes. Uncommitted fixes take the `/commit` route that `../fix-findings/SKILL.md` § *Output* names. Route each **Needs work** row under **Not reconciled:** to the skill or other owner it names, such as `/plan-task` or `/verify-issue`.

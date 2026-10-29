---
name: reconcile-task
description: Use when asked to reconcile, sync, capture, or write back important session findings into a task folder. Applies settled corrections, presents unresolved impactful choices, and re-checks cited tickets, PRs, and docs.
argument-hint: "[task slug or path; defaults to the session's task]"
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus `verification.md` — this skill re-verifies before it records any progress. If the domain has no pack, run the neutral methodology and say so.

Reconcile this session against task docs under `./references/workflow/reconciliation.md` and `./references/workflow/reconciliation-session-to-docs.md`.

Apply the shared consent, verified-progress, grounding, and upstream-ask rules. Use the direction contract's § *Write surface* and the shared § *Never-annotated surfaces* for writable files and protected surfaces. Produce task-doc edits and a chat change list only: no code, Git mutation, external updates, or scratch artifact.

## When to Use

**Use when** a session produced decisions, constraints, references, answered or new questions, or verified work the task docs do not yet reflect; a cited ticket, PR, or spec may have moved (this skill checks, the reporting skills do not); or you are wrapping up and the folder should be a faithful handoff.

**Skip when** no task folder exists → `refine-idea` or `plan-task`; the docs overstate reality (stale statuses, vanished shipped claims) → the other direction, `resume-task-reconcile` or `review-task-reconcile`; the next planned step should run → `implement-task`; the plan is `skipped` → report it as abandoned per § *Skipped plans are exempt*. Work merely discussed, not done, is surfaced, not recorded.

## Process

### 1. Resolve the Task Folder

Resolve per the **resolve-current-or-ask** rules in `./references/workflow/task-layout.md` § *Discovery rules for skills*; a full `plan.md` path is taken directly. Announce the resolved folder before this run's first write.

### 2. Load Artifacts

Open the folder per `./references/workflow/task-layout.md` § *Reading a resolved folder*, report structural repair, then read it in full; the repaired state is the baseline the session is diffed against. An explicit read-only request suppresses repair and all reconciliation writes. Do not treat unresolved structure as complete coverage:

- **The inherited group chain**: every applicable `GROUP_CONTEXT.md`, root to task. A constraint the session changed, or one the docs contradict, is a finding. Name the selected root and cite each file by its path from it; a correction whose home is a group file is a judged edit under § *The upstream ask is writable, and never rewritten quietly*.
- `goals.md`: the `## Goals` list by `G<n>` and the highest ID in use.
- `CONTEXT.md`: the exact wording of its prose sections; compare, do not paraphrase.
- `plan.md`: every step's **What** / **Verify** wording and the `## Scope` partition.
- `ticket.md` (when present): the ask and its criteria, wording noted exactly; writable on the added terms above.
- `observations.md` (when present): the previous sweep's ledger, read-only input to Step 4, which rewrites it per `./references/workflow/reconciliation-sweep.md` § *Ledger*.
- **The deliverable** (doc tasks; resolved per `./references/workflow/doc-task-files.md` without the plan's optional `**Deliverable:**` header): a read-only baseline whose `**Published:**` line Step 4 sweeps. Never written here; findings on it route by `./references/workflow/reconciliation-session-to-docs.md` § *`reconcile-task` — session findings*. <!-- cold -->
- `result.md`: the `currentState` block for orientation, then the latest step or full-run section and any `**Blocked:**`, `**In review:**`, or `## Acceptance` block. The plan holds the only lifecycle status (`./references/workflow/task-lifecycle.md` § *`result.md` — no status field*). A missing result is noted; work recorded this session may create it (that file's § *Companion result file*).

A `skipped` plan stops here per `./references/workflow/reconciliation.md` § *Skipped plans are exempt*. A plan with no `goals.md` is a gap to surface; never fabricate goals.

### 3. Review the Session Against the Docs

Collect everything material the docs do not carry and classify each item by target file and route:

- **Decisions and direction** contradicting or extending `CONTEXT.md`'s prose: a chosen approach, a rejected alternative, a scope change, a new constraint.
- **New or refined goals** the session committed to.
- **References** mentioned in chat and absent from `## References`.
- **Answered or new open questions.**
- **Verified progress**: a step or goal completed *and* confirmable now (Step 5). Work merely discussed is surfaced only.
- **Plan changes**: a step whose scope, verify criterion, or ordering changed.
- **A changed ask**: the requirement shifted from what `ticket.md` states; the *Changed ask* row in `./references/workflow/reconciliation-session-to-docs.md` § *`reconcile-task` — session findings*.
- **A shared constraint changed or contradicted**: the row of that name in the same section, which takes both the task-local consequence and the group file's correction as judged edits, each written where the fact lives.

Group findings by target file: the four core artifacts, then `ticket.md` and the applicable group file, whose edits land last with the external-surface line their rule requires. A doc task's deliverable stays outside the surface: its content is *Needs work* via `implement-task`, its `**Published:**` line the one *Yours to apply* line under "Not reconciled".

### 4. Check the Cited External References

Run the reference sweep in `./references/workflow/reconciliation-sweep.md`, its scope script and unavailable-script fallback included. A `warn` or `block` on a never-annotated surface routes by `./references/workflow/reconciliation.md` § *Never-annotated surfaces*. Its findings join Step 3's as one set; Step 6's mapping routes each tag.

### 5. Verify Before Recording State

Any finding that would advance state (check a step, mark a goal `met`, flip a status upward) passes the acceptance gate first: re-verify the step's full unit-outcome tier (its `**Verify:**` criterion plus the domain `verification.md`'s per-unit checks) or the goal's acceptance behavior now, in this session. Surface what you cannot verify rather than recording it. An advance claiming the work complete (`executing → done`, `in-review → done`, `executing → in-review`) also waits on the integrated-health precondition.

The rule is `./references/workflow/reconciliation.md` § *Strengthen only on verified evidence*, its one `(external)` exception included. What each gated finding writes when it passes or fails: `./references/workflow/reconciliation-session-to-docs.md` § *`reconcile-task` — session findings*.

### 6. Reconcile the Docs

Apply the findings per `./references/workflow/reconciliation.md` (the append-only `## Reconciliation` record, § *The record*, included) and `./references/workflow/reconciliation-session-to-docs.md` § *`reconcile-task` — session findings*, whose route values are the shared file's § *The mapping legend*; **verify** means Step 5's gate. Every edit maps to a Step 3 or Step 4 finding. A **verify** row waits on Step 5 passing. Every **judged** row follows the shared § *Consent model: findings apply, the record carries them* and retains its required record.

Refresh an existing or otherwise owed result's `## Current state` under the shared § *Current state refresh*. Create no result solely for structural repair.

For an existing result, run `node <kit-root>/scripts/task-state.ts --compaction-plan <task folder>` and read its JSON (`./references/scripts/task-state.md`; root resolution: `./references/workflow/task-store.md` § *Resolving `<kit-root>`*). Report an unavailable helper as an untested trigger, never as under the trigger.

Only on `due`, read `./references/workflow/reconciliation-compaction.md` § *Compaction (size trigger)* and propose its separately confirmed compaction. Raise any `maintain` `oversized-task` or `oversized-record` finding alongside it; trim only on the same confirmation, narrative never evidence. <!-- cold -->

## Output Template

Print the findings report **first**, from pre-reconcile state, never regenerated after edits:

```markdown
# Reconcile: <task title>

**Task dir:** `<resolved task folder path>`
**Plan:** `plan.md` (Status: <status>)
**Result:** `result.md` — or "not yet started"

## Session findings not yet in the docs

### CONTEXT.md
- [auto] Reference — <label> (<url>) mentioned in session; absent from References
- [judged] Direction — session chose <X> over <Y>; Recommended Direction still says <old>
- [auto] Open question "<q>" answered: <answer>

### goals.md
- [judged] New goal — "<outcome>" committed this session; not in goals.md (would be G<next>)

### plan.md
- [verify] Step 3 — completed this session; pending re-verification of its Verify criterion
- [judged] Step 5 — scope changed to <…> in session
- [judged] Step 4 — session settled that `EU` holds; the step still names `US`, against `product/backend/GROUP_CONTEXT.md` (root `Tasks/`)

### result.md
- [auto] Session narrative — <what was explored / decided / tried>

### ticket.md / GROUP_CONTEXT.md (external surfaces)
- [judged] Changed ask — the requester restated <criterion> on <date>; `ticket.md` § Acceptance criteria still says <old>

## References

- [info] [Jira CRM-123](https://example.atlassian.net/browse/CRM-123) — "Add CSV export" — Status: In Progress (unchanged since last observed)
- [warn] [PR #482](https://github.com/org/repo/pull/482) — merged 2026-05-20; Step 3's blocker no longer applies
- [block] [Original spec doc](https://docs.google.com/document/d/...) — 404 (moved or deleted); CONTEXT.md cites a now-broken link

(or, when none in scope: `No external references in sweep scope.` — this heading always renders)

## Not reconciled
- Needs work — <finding> — via `/implement-task`
- Yours to apply — <finding> — a deliverable's `**Published:**` line; proposed text: <…>
- Awaiting decision — <finding> — <researched options, material trade-offs, recommendation, and held edits>

(Or, when the session and the reference check both add nothing beyond the docs: `Nothing to reconcile.`)
```

Then run Step 5 and Step 6 (independent settled edits first, then choices), and close with the change list in `./references/workflow/reconciliation.md`'s format:

```markdown
## Reconciliation applied

- `result.md` / `plan.md` / `CONTEXT.md` / `goals.md` — <edit> (finding: <item>), one row per edit
- `ticket.md` / `<path>/GROUP_CONTEXT.md` — <edit> (finding: <item>) — external surface

**Not reconciled:**

- <Needs work | Yours to apply | Awaiting decision> — <finding> — <skill, proposed text, or researched options>
```

(or, when nothing was actionable: `Nothing to reconcile.`, with no file beyond the sweep's `observations.md` rewrite written)

After the change list or `Nothing to reconcile.`, close with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*):

- **Done:** the reconciled task docs, by file, and any external-surface edit, pointing at **Reconciliation applied**.
- **Know:** the task's handoff token, `block` and `warn` rows under **References**, **Yours to apply** rows awaiting the user's paste, and a compaction trigger left untested.
- **Awaiting you:** point at the **Awaiting decision** rows under **Not reconciled:**, and name a compaction proposal awaiting confirmation.
- **Next:** the skill each **Needs work** row names, such as `/implement-task`.

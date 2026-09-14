---
name: reconcile-task
description: Use when asked to reconcile, sync, capture, or write back into a task folder the important information that emerged in the current session — decisions, constraints, references, answered questions, and verified progress — that never made it into `CONTEXT.md`, `goals.md`, `plan.md`, or `result.md`. Also re-checks the folder's cited tickets, PRs, and docs against their live state.
argument-hint: '[task folder path]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus `verification.md` — this skill re-verifies before it records any progress. If the domain has no pack, run the neutral methodology and say so.

Review **this session against the task docs** and write the missing information back: the enriching direction of reconciliation. Shared mechanics: `./references/workflow/reconciliation.md`. This direction's rules and mapping: `./references/workflow/reconciliation-session-to-docs.md`.

This skill writes the task docs and asks nothing mid-run, except the compaction proposal and the trim raised with it (`./references/workflow/reconciliation-compaction.md` § *Compaction (size trigger)*). Which fixes land unprompted and which land as judged edits carrying their record: `./references/workflow/reconciliation.md` § *Consent model: findings apply, the record carries them*. Four rules bound it:

- **Strengthen only on verified evidence.** Progress is recorded only on evidence re-verified this session, never a chat claim (`./references/workflow/reconciliation.md` § *Strengthen only on verified evidence*).
- **Grounding docs change on evidence.** Anything redefining scope or acceptance is a judged edit whose record carries the prior wording and the readings passed over (`./references/workflow/reconciliation.md` § *Grounding docs change on evidence, never silently*).
- **The upstream ask is writable, never quietly.** An edit to `ticket.md` or an applicable `GROUP_CONTEXT.md` owes its record the added terms in `./references/workflow/reconciliation.md` § *The upstream ask is writable, and never rewritten quietly*, and never rewrites the ask to match what was built.
- **Docs, not the world.** No source code written, no git state mutated, no external system updated (`./references/workflow/reconciliation.md` § *Docs, not the world*). The writable files are `./references/workflow/reconciliation-session-to-docs.md` § *Write surface*; a `warn` or `block` on a read-only surface routes by `./references/workflow/reconciliation.md` § *Never-annotated surfaces*. Output is those files plus a chat change list, no scratch artifact.

## When to Use

**Use when** a session produced decisions, constraints, references, answered or new questions, or verified work the task docs do not yet reflect; a cited ticket, PR, or spec may have moved (this skill checks, the reporting skills do not); or you are wrapping up and the folder should be a faithful handoff.

**Skip when** no task folder exists → `refine-idea` or `plan-task`; the docs overstate reality (stale statuses, vanished shipped claims) → the other direction, `resume-task-reconcile` or `review-task-reconcile`; the next planned step should run → `implement-task`; the plan is `skipped` → report it as abandoned per § *Skipped plans are exempt*. Work merely discussed, not done, is surfaced, not recorded.

## Process

### 1. Resolve the Task Folder

Resolve per the **resolve-current-or-ask** rules in `./references/workflow/task-layout.md` § *Discovery rules for skills*; a full `plan.md` path is taken directly.

### 2. Load Artifacts

Open the folder per `./references/workflow/task-layout.md` § *Reading a resolved folder* and read it in full; it is the baseline the session is diffed against:

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

Apply the findings per `./references/workflow/reconciliation.md` (the append-only `## Reconciliation` record, § *The record*, included) and `./references/workflow/reconciliation-session-to-docs.md` § *`reconcile-task` — session findings*, whose route values are the shared file's § *The mapping legend*; **verify** means Step 5's gate. Every edit maps to a Step 3 or Step 4 finding. A **verify** row waits on Step 5 passing; a **judged** row lands only with the record its route owes, the alternatives declined and, for `ticket.md` or a group file, the external-surface line.

End every run by refreshing the result's `## Current state` per the shared file's § *Current state refresh*. Then test the size trigger with `node <kit-root>/scripts/task-state.ts --compaction-plan <task folder>` and read the verdict off its JSON (`./references/scripts/task-state.md`; `<kit-root>` per `./references/workflow/task-store.md` § *Resolving `<kit-root>`*). On `due`, raise the compaction proposal per `./references/workflow/reconciliation-compaction.md` § *Compaction (size trigger)*, which owns its consent and what may collapse; read it only then. When the script is unavailable, say the trigger went untested; never report it as under the trigger. A `maintain` `oversized-task` or `oversized-record` finding is raised alongside the proposal and cut only on the same confirmation, narrative never evidence. <!-- cold -->

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
- Needs work — <finding> — via `/implement-task <slug>`
- Yours to apply — <finding> — a deliverable's `**Published:**` line; proposed text: <…>

(Or, when the session and the reference check both add nothing beyond the docs: `Nothing to reconcile.`)
```

Then run Step 5 and Step 6 (auto enrichments first, then the `[judged]` edits with their records), and close with the change list in `./references/workflow/reconciliation.md`'s format:

```markdown
## Reconciliation applied

- `result.md` / `plan.md` / `CONTEXT.md` / `goals.md` — <edit> (finding: <item>), one row per edit
- `ticket.md` / `<path>/GROUP_CONTEXT.md` — <edit> (finding: <item>) — external surface

**Not reconciled:**

- <Needs work | Yours to apply> — <finding> — <skill, or the proposed text>
```

(or, when nothing was actionable: `Nothing to reconcile.`, with no file beyond the sweep's `observations.md` rewrite written)

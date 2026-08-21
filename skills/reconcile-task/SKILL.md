---
name: reconcile-task
description: Use when asked to reconcile, sync, capture, or write back into a task folder the important information that emerged in the current session — decisions, constraints, references, answered questions, and verified progress — that never made it into `CONTEXT.md`, `goals.md`, `plan.md`, or `result.md`. Also re-checks the folder's cited tickets, PRs, and docs against their live state.
argument-hint: '[task folder path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus `verification.md` — this skill re-verifies before it records any progress. If the domain has no pack, run the neutral methodology and say so.

This skill closes the gap a working or design session opens: things get decided, discovered, answered, or actually built in the conversation, but the task folder still reflects the state from before it. `reconcile-task` reviews **this session against the task docs** and writes the missing information back — the *enriching* direction of reconciliation. The shared mechanics live in `./references/workflow/reconciliation.md`; this direction's own rules and mapping live in `./references/workflow/reconciliation-session-to-docs.md`.

**CRITICAL**: This skill writes to the task docs by design. Consent — which fixes apply unprompted versus go to the batched round — is fixed by `./references/workflow/reconciliation.md` § *Consent model: obvious fixes only, ask for the rest*. It stays inside two guardrails and one boundary:

- **Strengthen only on verified evidence** — progress is recorded only on evidence re-verified in this session, never on a chat claim (`./references/workflow/reconciliation-session-to-docs.md` § *Strengthen only on verified evidence*).
- **Grounding docs change by confirmation** — anything redefining scope or acceptance goes through the batched confirmation round, never an auto-apply (`./references/workflow/reconciliation-session-to-docs.md` § *Grounding docs change by confirmation, never silently*).
- **Docs, not the world** — no source code is written, no git state is mutated, and no external system is updated (`./references/workflow/reconciliation.md` § *Docs, not the world*). Which files this direction may write, and which stay read-only, is `./references/workflow/reconciliation-session-to-docs.md` § *Write surface*; a `warn` or `block` on one of the read-only surfaces routes by `./references/workflow/reconciliation.md` § *External reference check*'s never-annotated rule. Output is those files plus a chat change list — no scratch artifact.

## When to Use

**Use when:**

- A session produced decisions, constraints, or a chosen direction the task docs don't yet reflect
- References, specs, or tickets surfaced in chat and should be captured in `CONTEXT.md`
- An open question was answered (or a new one raised) during the session
- A cited ticket, PR, or spec may have moved since it was written down — this is the skill that checks; the reporting skills don't
- Work was actually done and verified in-session outside a formal `implement-task` run, and the plan/result should record it
- You're wrapping up a session and want the folder to be a faithful handoff for the next one

**Skip when:**

- No task folder exists yet → suggest `refine-idea` or `plan-task`
- The docs already overstate reality (stale statuses, vanished shipped claims) → that's the other direction; use `resume-task-reconcile` or `review-task-reconcile`
- You want to execute the next planned step → use `implement-task`, which records its own work
- The session only discussed work that wasn't done — there's nothing verified to record; the skill will surface it, not check it
- The plan is `skipped` (terminal) → report it as abandoned, per the contract's § *Skipped plans are exempt*

## Process

### 1. Resolve the Task Folder

Resolve a task folder per the **resolve-current-or-ask** discovery rules in `./references/workflow/task-layout.md` § *Discovery rules for skills* — cite it, don't restate it; a full `plan.md` path is taken directly.

The in-session task is the common case.

### 2. Load Artifacts

Read all four core artifacts — plus `ticket.md`, `diagram.md`, `observations.md`, and a doc task's deliverable when present — they are the baseline you diff the session against, so don't diff against a skim:

- `ticket.md` (when present) — the product-facing ask and its acceptance criteria; a read-only baseline, the ask being user-owned.
- `CONTEXT.md` — the static grounding context (problem statement, recommended direction, key assumptions, MVP scope, not-doing, open questions, references). Note the exact wording of prose sections; you compare, you don't paraphrase.
- `goals.md` — capture the full `## Goals` list by `G<n>` ID, and the highest ID in use (a new goal takes the next free number).
- `plan.md` — its `**Status:**`, its steps and their `- [ ]` / `- [x]` markers, each step's **What** / **Verify** / **Goal** / **Depends on**, and the `## Scope` partition.
- `diagram.md` (when present) — the target-state shape and its dated `**Reflects:**` line; a read-only baseline — structure the session changed that it doesn't show becomes a flag-only finding, never a repaint.
- `observations.md` (when present) — the previous sweep's dated ledger of the folder's cited references; read-only input to Step 4, which reads, diffs against, and rewrites it per `./references/workflow/reconciliation.md` § *External reference check*.
- **The deliverable** (doc tasks only — `adr.md`, `rfc.md`, …; resolved per `./references/workflow/doc-task-files.md`, which fixes it without depending on the plan's optional `**Deliverable:**` header) — a read-only baseline: its content is the work product the session may have changed, and its `**Published:**` line is a swept citation Step 4 needs. <!-- cold -->
  Never written here: findings on it route by the mapping rows in `./references/workflow/reconciliation-session-to-docs.md` § *`reconcile-task` — session findings*.
- `result.md` — read `## Current state` first for orientation (derived metadata, not ground truth); then its `**Status:**`, the latest per-step / full-run section, any `**Blocked:**` block, any `**In review:**` block, any `## Acceptance` section. If none exists, note it: work recorded this session may create it (per the pairing rule in `./references/workflow/task-lifecycle.md` § *Pairing rule*).

A `skipped` plan is terminal — handle it per `./references/workflow/reconciliation.md` § *Skipped plans are exempt* and stop there. A plan with no sibling `goals.md` is a gap — surface it (`plan-task` is expected to produce one) rather than fabricating goals.

### 3. Review the Session Against the Docs

Walk the current session and collect everything material the docs don't already carry, then classify each item by where it belongs and how it may be written. Look for:

- **Decisions and direction** — a chosen approach, a rejected alternative, a scope change, a new constraint, a "we're not doing X" — that contradicts or extends `CONTEXT.md`'s prose.
- **New goals or refined goals** — an outcome the session committed to that `goals.md` doesn't list, or a goal the session sharpened.
- **References** — links, specs, tickets, docs mentioned in chat that aren't in `## References`.
- **Answered / new open questions** — a question in `CONTEXT.md` or the plan that the session resolved, or a new one it raised.
- **Verified progress** — a step or goal the session actually completed *and* whose result you can confirm now (Step 5), plus work merely discussed but not done (surface only).
- **Plan changes** — a step whose scope, verify criterion, or ordering the session changed.
- **A changed ask** — the session revealed the product requirement itself shifted from what `ticket.md` states; it routes by the *Changed ask* row in `./references/workflow/reconciliation-session-to-docs.md` § *`reconcile-task` — session findings*.

Group findings by target file (`CONTEXT.md` / `goals.md` / `plan.md` / `result.md`) — the ticket and a doc task's deliverable are read-only, so a changed ask lands under "Not reconciled" for the user, and a finding on the deliverable lands there too — its `**Published:**` line for the user, its content for `implement-task`.

### 4. Check the Cited External References

Run the **External reference check** in `./references/workflow/reconciliation.md` § *External reference check* — cite it, don't restate it. This skill is where it lands for a task you're actively working; the reporting skills sweep none.

Its findings join Step 3's as one set — different provenance, same handling; Step 6's mapping routes each tag.

### 5. Verify Before Recording State

Any finding that would **advance state** — check a step, mark a goal `met`, flip a status upward — passes through the acceptance gate first: re-verify the step's full unit-outcome tier (its `**Verify:**` criterion plus the per-unit checks the resolved domain's `verification.md` adds) or the goal's acceptance behavior *now*, in this session, the way `implement-task` would, and surface anything you cannot verify rather than recording it. Any advance claiming the work complete — `executing → done`, `in-review → done`, or `executing → in-review` — also waits on that rule's integrated-health precondition.

The rule is `./references/workflow/reconciliation-session-to-docs.md` § *Strengthen only on verified evidence*, its one sanctioned `(external)` exception included. Which findings the gate covers, and what each one writes when it passes or fails (the two-outcome shape, the skeleton-`result.md` / `to-do → executing` flow, the full-gate requirement for `done` and its `in-review` fallback), are the mapping rows in that file's § *`reconcile-task` — session findings*.

### 6. Reconcile the Docs

Apply the findings per `./references/workflow/reconciliation.md` and its session → docs direction file `./references/workflow/reconciliation-session-to-docs.md` — read both before editing: the shared file's mechanics, the append-only `## Reconciliation` record (§ *The record*) included, and the direction file's rules plus, in its § *`reconcile-task` — session findings*, this skill's finding-type → edit mapping with its three-way legend (**auto** / **verify** = only after Step 5's gate / **ask** = the batched confirmation round). Every edit maps to a finding from Step 3 or Step 4; anything the mapping routes to **verify** or **ask** is never auto-applied.

End every run by refreshing the result's `## Current state` block per the shared file's § *Current state refresh*, and add its compaction proposal to the batched confirmation round when the size trigger fires, per that file's § *Compaction (size trigger)*.

## Output Template

Print the findings report **first** — a faithful snapshot of what the session holds that the docs don't, from **pre-reconcile** state, never regenerated after edits:

```markdown
# Reconcile: <task title>

**Task dir:** `<resolved task folder path>`
**Plan:** `plan.md` (Status: <status>)
**Result:** `result.md` (Status: <status>) — or "not yet started"

## Session findings not yet in the docs

### CONTEXT.md
- [auto] Reference — <label> (<url>) mentioned in session; absent from References
- [ask] Direction — session chose <X> over <Y>; Recommended Direction still says <old>
- [auto] Open question "<q>" answered: <answer>

### goals.md
- [ask] New goal — "<outcome>" committed this session; not in goals.md (would be G<next>)

### plan.md
- [verify] Step 3 — completed this session; pending re-verification of its Verify criterion
- [ask] Step 5 — scope changed to <…> in session

### result.md
- [auto] Session narrative — <what was explored / decided / tried>

## References

- [info] [Jira CRM-123](https://example.atlassian.net/browse/CRM-123) — "Add CSV export" — Status: In Progress (unchanged since last observed)
- [warn] [PR #482](https://github.com/org/repo/pull/482) — merged 2026-05-20; Step 3's blocker no longer applies
- [block] [Original spec doc](https://docs.google.com/document/d/...) — 404 (moved or deleted); CONTEXT.md cites a now-broken link

(or, when none in scope: `No external references in sweep scope.` — this heading always renders)

## Not reconciled
- <finding> — <needs real work via implement-task / unverifiable this session>

(or, when the session and the reference check both add nothing beyond the docs: `Nothing to reconcile.`)
```

Then run Step 5 (verify) and Step 6 (auto-apply enrichments, then the batched confirmation round for the `[ask]` items), and close with the change list — reusing the format in `./references/workflow/reconciliation.md`:

```markdown
## Reconciliation applied

- `result.md` / `plan.md` / `CONTEXT.md` / `goals.md` — <edit> (finding: <item>, or: answer to Q<n>), one row per edit

**Not reconciled:**

- <finding> — <needs real work via implement-task / awaiting answer / unverifiable this session>
```

(or, when nothing was actionable: `Nothing to reconcile.` — and no file beyond the sweep's `observations.md` rewrite was written)

## Don't Rationalize

- "It surfaced in the session, so I can just write it" — Every temptation to record unverified progress, auto-add a goal, rewrite grounding prose, renumber IDs, or tidy beyond a finding is already answered by the shared contract and this skill's mapping in `./references/workflow/reconciliation.md`. Follow them, not your judgment.
- "I'll run the next step while I'm here" — This skill records work; it doesn't execute the plan. Hand off to `implement-task`.
- "The session is long; I'll summarize what I remember" — Diff the session against the actual docs, don't summarize from memory; capture what's genuinely missing and point to the source.

## Verification

Confirm the protocol invariants before finishing. Each item names the section of `./references/workflow/reconciliation.md`, or of its direction file `./references/workflow/reconciliation-session-to-docs.md`, that defines it — check the behavior against that section, not against this list:

- [ ] Task folder resolved (in-session task, or asked — never guessed); all four core artifacts read (plus `ticket.md`, `diagram.md`, `observations.md`, and a doc task's deliverable when present)
- [ ] A `skipped` plan handled per § *Skipped plans are exempt* — nothing swept, nothing written
- [ ] The run followed § *Sequence and output*: findings report printed first from pre-reconcile state, every edit after it, closing change list printed
- [ ] The reference sweep run before any edit and its results scoped, tagged, rendered under `## References`, and ledgered into `observations.md` per § *External reference check*
- [ ] State advanced only per the direction file's § *Strengthen only on verified evidence* — Step 5's gate, its integrated-health precondition before any advance claiming the work complete, the evidence recorded in `result.md`; grounding docs (`goals.md`, `CONTEXT.md` prose, a step's scope) changed only per its § *Grounding docs change by confirmation, never silently*
- [ ] Every edit made falls inside the direction file's § *Write surface* and maps to a printed finding or an answer to one, with no code, git, or external-system mutation per § *Docs, not the world*; no scratch artifact written
- [ ] `## Current state` refreshed at the end of the run per § *Current state refresh*, its `done`-result freeze included; the compaction proposal raised as an ask item when § *Compaction (size trigger)*'s trigger fired

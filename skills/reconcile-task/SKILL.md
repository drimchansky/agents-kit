---
name: reconcile-task
description: Use when asked to reconcile, sync, capture, or write back into a task folder the important information that emerged in the current session — decisions, constraints, references, answered questions, and verified progress — that never made it into `CONTEXT.md`, `goals.md`, `plan.md`, or `result.md`. Also re-checks the folder's cited tickets, PRs, and docs against their live state.
argument-hint: '[task folder path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus `verification.md` — this skill re-verifies before it records any progress. If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill closes the gap a working or design session opens: things get decided, discovered, answered, or actually built in the conversation, but the task folder still reflects the state from before the session. `reconcile-task` reviews **this session against the task docs** and writes the missing information back — the *enriching* direction of reconciliation. It is the counterpart to the docs → reality composites `resume-task-reconcile` / `review-task-reconcile`, which reconcile the other way (docs that overstate reality, weakened down to match). The shared contract for both directions lives in `./references/workflow/reconciliation.md`.

**CRITICAL**: This skill writes to the task docs by design — that is its purpose, so there is no opt-in flag; invoking it *is* the consent (see the shared contract's consent model). But it stays inside two guardrails and one boundary:

- **Strengthen only on verified evidence.** It may record progress (check a step, mark a goal `met`, advance status) **only after re-verifying it this session** the way the acceptance gate would (the resolved domain's `verification.md`). A claim it cannot verify is surfaced, never recorded. "Done" means verified, not asserted in chat.
- **Grounding docs change by confirmation.** Writing `goals.md`, `CONTEXT.md` prose, or a step's scope — anything that redefines scope or acceptance — goes through **one batched confirmation round** first; it is never auto-applied. Pure enrichment (references, answered questions, session narrative) auto-applies.
- **Docs, not the world.** No source code is written, no git state is mutated (no add, commit, checkout, stash), and no external system is updated — the reference check reads them, never posting, commenting, or transitioning anything. Verification in this skill *runs* checks read-only to back a state change — it changes nothing outside the four core task files, and never `diagram.md`: repainting is authoring, so diagram drift is flagged for `implement-task`'s gate re-check, never repaired here (the shared contract). The upstream `ticket.md`, when present, is **read-only input**: a changed *ask* is surfaced for the user to update, never rewritten here. Output is those files plus a chat change list — no scratch artifact.

## When to Use

**Use when:**

- A session produced decisions, constraints, or a chosen direction the task docs don't yet reflect
- References, specs, or tickets surfaced in chat and should be captured in `CONTEXT.md`
- An open question was answered (or a new one raised) during the session
- A cited ticket, PR, or spec may have moved since it was written down — this is the skill that checks, since the reporting skills don't
- Work was actually done and verified in-session outside a formal `implement-task` run, and the plan/result should record it
- You're wrapping up a session and want the folder to be a faithful handoff for the next one

**Skip when:**

- No task folder exists yet → suggest `refine-idea` or `plan-task`
- The docs already overstate reality (stale statuses, vanished shipped claims) → that's the other direction; use `resume-task-reconcile` or `review-task-reconcile`
- You want to execute the next planned step → use `implement-task`; it records its own work as it goes
- The session only discussed work that wasn't done — there's nothing verified to record; the skill will surface it, not check it
- The plan is `skipped` (terminal) → nothing is reconciled; report it as abandoned

## Process

### 1. Resolve the Task Folder

Resolve a task folder per the **resolve-current-or-ask** discovery rules in `./references/workflow/task-layout.md` — cite it, don't restate it; a full `plan.md` path is taken directly.

The in-session task is the common case: reconcile is usually run at the end of a session that was already about a specific task. If nothing is established and nothing is named, ask — never guess between candidates.

### 2. Load Artifacts

Read all four core artifacts — plus `ticket.md` and `diagram.md` when present — the docs are the baseline you diff the session against, so don't diff against a skim:

- `ticket.md` (when present) — the product-facing ask and its acceptance criteria; a read-only baseline (the ask is user-owned) and the upstream origin `goals.md` derives from.
- `CONTEXT.md` — the static grounding context (problem statement, recommended direction, key assumptions, MVP scope, not-doing, open questions, references). Note the exact wording of prose sections; you compare, you don't paraphrase.
- `goals.md` — capture the full `## Goals` list by `G<n>` ID, and the highest ID in use (a new goal takes the next free number).
- `plan.md` — its `**Status:**`, its steps and their `- [ ]` / `- [x]` markers, each step's **What** / **Verify** / **Goal** / **Depends on**, and the `## Scope` partition.
- `diagram.md` (when present) — the target-state shape and its dated `**Reflects:**` line; a read-only baseline — structure the session changed that it doesn't show becomes a flag-only finding (the shared contract), never a repaint.
- `result.md` — read `## Current state` first for orientation (derived metadata, not ground truth — its refresh at the end of the run is part of this skill's contract); then its `**Status:**`, the latest per-step / full-run section, any `**Blocked:**` block, any `**In review:**` block, any `## Acceptance` section. If none exists, note it: work recorded this session may create it (per the pairing rule in `./references/workflow/task-lifecycle.md`).

A `skipped` plan is terminal — report it as abandoned and stop; write nothing. A plan with no sibling `goals.md` is a gap — surface it (`plan-task` is expected to produce one) rather than fabricating goals.

### 3. Review the Session Against the Docs

This is the load-bearing step. Walk the current session and collect everything material that the task docs don't already carry, then classify each item by where it belongs and how it may be written. Look for:

- **Decisions and direction** — a chosen approach, a rejected alternative, a scope change, a new constraint, a "we're not doing X" — that contradicts or extends `CONTEXT.md`'s prose.
- **New goals or refined goals** — an outcome the session committed to that `goals.md` doesn't list, or a goal the session sharpened.
- **References** — links, specs, tickets, docs mentioned in chat that aren't in `## References`.
- **Answered / new open questions** — a question in `CONTEXT.md` or the plan that the session resolved, or a new one it raised.
- **Verified progress** — a step or goal the session actually completed *and* whose result you can confirm now (Step 5), plus work merely discussed but not done (surface only).
- **Plan changes** — a step whose scope, verify criterion, or ordering the session changed.
- **A changed ask** — the session revealed the product requirement itself shifted from what `ticket.md` states. Surface it so the user can update the ticket (then re-derive goals via `plan-task`); reconcile never rewrites the ask.

Group findings by target file (`CONTEXT.md` / `goals.md` / `plan.md` / `result.md`) — the ticket is read-only, so a changed ask lands under "Not reconciled" for the user. If the session adds nothing beyond what the docs already hold and the reference check below turns up nothing either, there is nothing to reconcile — say so in the change list and write nothing.

### 4. Check the Cited External References

Run the **External reference check** in `./references/workflow/reconciliation.md` — cite it, don't restate it. It is a shared mechanic of every reconciler, and this skill is where it lands for a task you're actively working: the reporting skills (`resume-task`, `review-task`) sweep no citations, so a ticket that closed, a PR that merged, or a spec that moved reaches the docs only through a reconcile.

Its findings join Step 3's as one set. They differ in provenance, not in handling — a question answered by a fetched doc is annotated exactly like one answered in chat, in the file where the question lives. The mapping for each tag is in the contract's `reconcile-task` section.

### 5. Verify Before Recording State

Any finding that would **advance state** — check a step, mark a goal `met`, flip a status upward — passes through the acceptance gate first, per the resolved domain's `verification.md` — when the domain is code, that's `./references/engineering/verification.md`. Re-verify the step's `**Verify:**` criterion or the goal's acceptance behavior *now*, in this session, the way `implement-task` would:

- Verifies cleanly → it's recordable: check the box / mark the goal `met`, and write the evidence (`**Shipped:**` paths, what was run, what was observed) into `result.md`.
- Cannot be verified this session (no evidence, or the check fails) → **surface it, do not record it.** It goes to "Not reconciled" naming `implement-task`. A chat claim of "that's done" is not evidence.

**The one sanctioned exception is a goal marked `(external)`.** Its verification lives outside the session by design, so its **best-available proxy** — the confirmation, receipt, or observed live state the user reports — *is* legitimate evidence (per `./references/workflow/acceptance-criteria.md`), not a bare chat claim. On that proxy you may record the goal as `met` and advance `in-review → done`. Absent the proxy, the goal stays `pending external` and the task stays `in-review`.

Starting work this session on a `to-do` plan is evidenced state (checked steps or shipped artifacts exist) and flips `to-do → executing` with a skeleton `result.md`; finalizing `executing → done` requires the full acceptance gate to pass against `goals.md`. When the only goals left unsatisfied are `(external)` ones still awaiting their proxy, the task finalizes to `in-review` instead of `done`, and reaches `done` on a later confirmation.

### 6. Reconcile the Docs

Apply the findings per the shared contract in `./references/workflow/reconciliation.md` — read it before editing. It defines the shared mechanics (consent model, the external reference check, annotation formats, the append-only `## Reconciliation` record, the `skipped`-plan exemption, the sequence ending in the printed change list), the session → docs direction rules (write surface, strengthen-only-on-verified-evidence, grounding-docs-by-confirmation), and — in its `reconcile-task` section — this skill's finding-type → edit mapping with its three-way legend (**auto** / **verify** = only after Step 5's gate / **ask** = the batched confirmation round). Every edit maps to a finding from Step 3 or Step 4; anything the mapping routes to **verify** or **ask** is never auto-applied.

End every run per the contract's *Current state refresh*: rewrite the result's `## Current state` block to post-edit reality (creating it on a legacy result). On a result **already `done` when the run began** that contract freezes the gloss and `**Next:**` but not `**Pointers:**`; a run that itself advances the task to `done` writes the final digest before the freeze takes hold. And when `result.md` exceeds **20 KB**, add the contract's compaction proposal (`./references/workflow/reconciliation.md` § *Compaction*) to the batched confirmation round — never auto-compact.

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

- [info] [Jira CRM-123](https://example.atlassian.net/browse/CRM-123) — "Add CSV export" — Status: In Progress (unchanged since cited)
- [warn] [Notion: API contract](https://www.notion.so/...) — last edited 2026-05-23 by alice; the open question about pagination is now answered (cursor-based)
- [warn] [PR #482](https://github.com/org/repo/pull/482) — merged 2026-05-20; Step 3's blocker no longer applies
- [block] [Original spec doc](https://docs.google.com/document/d/...) — 404 (moved or deleted); CONTEXT.md cites a now-broken link
- [info] [Slack #project-x](https://acme.slack.com/archives/...) — auth required, re-check manually

(or, when none cited: `No external references cited.` — this heading always renders)

## Not reconciled
- <finding> — <needs real work via implement-task / unverifiable this session>

(or, when the session and the reference check both add nothing beyond the docs: `Nothing to reconcile.`)
```

Then run Step 5 (verify) and Step 6 (auto-apply enrichments, then the batched confirmation round for the `[ask]` items), and close with the change list — reusing the format in `./references/workflow/reconciliation.md`:

```markdown
## Reconciliation applied

- `plan.md` — <edit> (finding: <item>, or: answer to Q<n>)
- `result.md` — <edit> (finding: …)
- `CONTEXT.md` — <edit> (finding: …)
- `goals.md` — <edit> (answer to Q<n>)

**Not reconciled:**

- <finding> — <needs real work via implement-task / awaiting answer / unverifiable this session>
```

(or, when nothing was actionable: `Nothing to reconcile.` — and no file was written)

## Don't Rationalize

- "It surfaced in the session, so I can just write it" — Every temptation to record unverified progress, auto-add a goal, rewrite grounding prose, renumber IDs, or tidy beyond a finding is already answered by the shared contract and this skill's mapping in `./references/workflow/reconciliation.md`. Follow them, not your judgment.
- "I'll run the next step while I'm here" — This skill records work; it doesn't execute the plan. Hand off to `implement-task`.
- "The session is long; I'll summarize what I remember" — Diff the session against the actual docs, don't summarize from memory. Capture what's genuinely missing, and quote/point to the source.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Task folder resolved (in-session task, or asked — never guessed); all four core artifacts read (plus `ticket.md` and `diagram.md` when present) before diffing the session against them
- [ ] A `skipped` plan reported as abandoned, with nothing written
- [ ] Reconciliation followed the shared contract end-to-end; findings report printed from pre-reconcile state; closing change list printed
- [ ] **Before any edit:** every URL the folder cited at that point fetched read-only and tagged (`warn` on material change, `block` on broken, `info` on clean / auth-walled / unreachable), with `## References` rendered even when none
- [ ] State advanced only after Step 5's in-session re-verification, with evidence recorded in `result.md`; grounding docs (`goals.md`, `CONTEXT.md` prose, a step's scope) changed only through the batched confirmation round
- [ ] `## Current state` rewritten to post-edit reality at the end of the run, including the run that finalizes to `done`; on a result already `done` when the run began, only `**Pointers:**` refreshed and the gloss left frozen; the >20 KB compaction proposal raised (as an ask item) when the size trigger fired
- [ ] Docs only — no source code, git, or external-system mutation; no scratch artifact; the upstream `ticket.md` is read-only (a changed ask is surfaced, not rewritten)

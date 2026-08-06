---
name: resume-task-reconcile
description: Use when asked to catch up on a task and also write the findings back — one command that prints the resume briefing from pre-reconcile state, then reconciles the task docs to reality; obvious fixes applied, judgment items asked as one batched round. Also re-checks the folder's cited links against their live state. Writes the task docs only; never code, never git.
argument-hint: '[task folder path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

One command for the catch-up-and-fix pipeline: brief the task (`resume-task`), then write the brief's
findings back into the task docs so they stop overstating what's been built. Two phases, in order —
the brief is a faithful snapshot of **pre-reconcile** state, and the reconcile runs against it.

Phase 1 executes its skill file — read the sibling `SKILL.md` and run its full protocol; Phase 2 runs
against the reference contract it names. Three overrides apply pipeline-wide:

- **Core Rules blocks** — the composite's own block above covers the pipeline; the inner skill's
  AGENTS.md read is already satisfied and doesn't repeat. The override stops there: `resume-task`'s
  domain-pack step still runs, resolving the task's `**Domain:**` and applying that pack.
- **Chat display** — the composite's Output owns what reaches you. Unlike the review pipelines, this
  one holds nothing back: the brief prints in full at the end of Phase 1, **before** any edit.
- **Next pointers** — the inner skill's follow-up suggestions are dropped; the composite's Output
  owns **Next**.

Past these three, a phase departs from its skill or contract only where its own section below says
so — never by improvisation.

**CRITICAL**: This pipeline writes only what the **docs → reality** direction allows, and
`./references/workflow/reconciliation-docs-to-reality.md` § *Write surface* is the whole of that
surface — the writable files, every never-edited one and its reason, and the bound on what a
reconcile may re-run or execute. It fixes the **docs**, not the world
(`./references/workflow/reconciliation.md` § *Docs, not the world*), and creates no `BRIEF.md` or
scratch briefing file.

Invoking this skill is this direction's consent, on the terms
`./references/workflow/reconciliation.md` § *Consent model: obvious fixes only, ask for the rest*
sets.

## When to Use

**Use when:**

- Returning to a task whose docs have visibly drifted — stale statuses, steps checked for work that's
  gone, dead links — and you want them corrected, not just reported
- Wrapping up or handing off, and the folder should be a faithful record before the next session
- `resume-task` already showed drift and the answer is "yes, fix that"

**Skip when:**

- You only want to know where the task stands → use `resume-task`; it is strictly read-only
- The gap needs real work — code changes, re-running the acceptance gate, clearing a blocker → use
  `implement-task`; this pipeline edits docs only
- The information to write back came out of **this session's conversation** rather than the docs
  overstating reality → that's the opposite direction; use `reconcile-task`
- The plan's `**Status:**` is `skipped` — terminal, and exempt from reconciliation entirely; Phase 1
  reports it as abandoned and Phase 2 writes nothing

## Phase 1 — Brief

Execute `../resume-task/SKILL.md` end to end against the resolved task folder, and print its brief in
full — every template section, including the always-rendered "Drift since plan" heading. The brief
sweeps no citations of its own, per the **docs → reality** direction definition opening
`./references/workflow/reconciliation.md`; the cited links are Phase 2's business.

The brief is the pipeline's pre-reconcile snapshot and the evidence Phase 2 acts on — printed
**before** any edit and never regenerated after one, per `./references/workflow/reconciliation.md`
§ *Sequence and output*. If Phase 2 fails hard, the brief still stands as printed — the catch-up is
never lost to a dead pipeline.

## Phase 2 — Reconcile

Apply the brief's findings to the task docs per `./references/workflow/reconciliation.md` and its
**docs → reality** direction file `./references/workflow/reconciliation-docs-to-reality.md` — read
both before editing; together they are the single source of truth and this phase adds no mechanics of
its own. The shared file defines the shared mechanics (consent model, the external reference check,
annotation formats, the append-only `## Reconciliation` record, the `## Current state` refresh, the
sequence ending in the printed change list); the direction file defines the direction rules (write
surface, weaken-never-strengthen), the shared repairs, and — in its `resume-task-reconcile` mapping
section — this pipeline's finding-type → edit mapping.

Run the contract's reference sweep here, per `./references/workflow/reconciliation.md`
§ *External reference check* — which owns it in full, down to why the sweep never substitutes for
Phase 1's claim-level verification of what a finding names. It runs in this phase because the brief
sweeps nothing, so print its `## References` block after the brief and before any edit: it is this
pipeline's only source of dead-link and reference-answered-question findings.

Findings that need real work (code changes, re-running the acceptance gate, clearing a blocker) stay
unfixed — they take the "Not reconciled" routing of `./references/workflow/reconciliation.md`
§ *Consent model: obvious fixes only, ask for the rest*, with the next skill named
(`implement-task`, `plan-task`).

## Output

Lists, never tables.

- **Brief** — the full briefing exactly as `resume-task` specs it, printed at the end of Phase 1 from
  pre-reconcile state. Its "Where to start" section is part of that snapshot; the **Next** line below
  is what accounts for the reconciled state.
- **References** — the reference check's tagged entries, printed at the start of Phase 2 before any
  edit, exactly as the shared contract specs it — rendered even when nothing was in scope.
- **Reconciliation applied** — the change list exactly as `./references/workflow/reconciliation.md`
  specs it: every edit with the finding or engineer answer behind it, plus the "Not reconciled" list.
  When nothing was actionable, print `Nothing to reconcile.` — and write nothing beyond the sweep's
  `observations.md` rewrite, not even an empty Reconciliation entry.

**Next:** the concrete follow-up after the edits — the skill named against the "Not reconciled"
findings (`/implement-task <slug>` for work the docs can't fix, `/plan-task <slug>` for a step that
needs rethinking), or the first action from the brief when nothing was left unreconciled.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Phase 1 ran from `resume-task`'s skill file with its domain-pack step intact — not improvised
- [ ] The brief printed in full from pre-reconcile state, before any edit, and was never regenerated
      after one, per `./references/workflow/reconciliation.md` § *Sequence and output*
- [ ] Every edit traces to a brief finding, a reference finding, or an engineer answer, routed by
      `./references/workflow/reconciliation-docs-to-reality.md`
      § *`resume-task-reconcile` — brief findings*
- [ ] Judgment items went to the engineer as one batched round, and anything unanswered or declined
      landed under "Not reconciled" with its reason, per `./references/workflow/reconciliation.md`
      § *Consent model: obvious fixes only, ask for the rest*
- [ ] The reference check ran in Phase 2 with its `## References` block printed after the brief and
      before any edit, and `observations.md` left as `./references/workflow/reconciliation.md`
      § *External reference check* specs; Phase 1 swept no citations
- [ ] Write surface held — every file written is one
      `./references/workflow/reconciliation-docs-to-reality.md` § *Write surface* allows, nothing
      outside it was touched, and no `BRIEF.md` or scratch briefing file was created
- [ ] The run closed with the change list `./references/workflow/reconciliation.md`
      § *Sequence and output* specs — real-work findings under "Not reconciled" with the next skill
      named, or `Nothing to reconcile.` when nothing was actionable

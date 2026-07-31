---
name: resume-task-reconcile
description: Use when asked to catch up on a task and also write the findings back — one command that prints the resume briefing from pre-reconcile state, then reconciles the task docs to reality; obvious fixes applied, judgment items asked as one batched round. Also re-checks the folder's cited links against their live state. Writes the task docs only; never code, never git.
argument-hint: '[task folder path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.

One command for the catch-up-and-fix pipeline: brief the task (`resume-task`), then write the brief's
findings back into the task docs so they stop overstating what's been built. Two phases, in order —
the brief is a faithful snapshot of **pre-reconcile** state, and the reconcile runs against it.

Phase 1 executes its skill file — read the sibling `SKILL.md` and run its full protocol; Phase 2 runs
against the reference contract it names. Three overrides apply pipeline-wide:

- **Core Rules blocks** — the composite's own block above covers the pipeline; the inner skill's
  AGENTS.md read and `✅` echo are already satisfied and don't repeat. The override stops at those
  two: `resume-task`'s domain-pack step still runs, resolving the task's `**Domain:**` and applying
  that pack (`./references/workflow/domain-packs.md`).
- **Chat display** — the composite's Output owns what reaches you. Unlike the review pipelines, this
  one holds nothing back: the brief prints in full at the end of Phase 1, **before** any edit.
- **Next pointers** — the inner skill's follow-up suggestions are dropped; the composite's Output
  owns **Next**.

Past these three, a phase departs from its skill or contract only where its own section below says
so — never by improvisation.

**CRITICAL**: The write surface is exactly four task files — `plan.md`, `result.md`, minimal
annotations in `CONTEXT.md`'s References / Open Questions sections, and the sweep's `observations.md`
rewrite — and nothing else. `goals.md`, `ticket.md`, and `diagram.md` are never edited (the ticket
is user-owned; even `reconcile-task` treats it as read-only; the diagram is `implement-task`'s to
repaint — drift is flagged, never repaired), source code is never written, git state is never
mutated, external systems are fetched read-only, and no `BRIEF.md` or scratch briefing file is
created. This pipeline fixes the **docs**, not the world — it never re-runs the acceptance gate and
never executes plan work.

Invoking this skill is the consent for the obvious, evidence-dictated fixes only. Anything needing
engineer judgment is asked first, as one batched round.

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
full — every template section, including the always-rendered "Drift since plan" heading. The brief runs
no reference sweep by design; the cited links are Phase 2's business.

The brief is the pipeline's pre-reconcile snapshot and the evidence Phase 2 acts on, so it prints
**before** any edit and is never regenerated afterwards. If Phase 2 fails hard, the brief still
stands as printed — the catch-up is never lost to a dead pipeline.

## Phase 2 — Reconcile

Apply the brief's findings to the task docs per the **docs → reality** direction of
`./references/workflow/reconciliation.md` — read it before editing; it is the single source of truth
and this phase adds no mechanics of its own. It defines the shared mechanics (consent model, the
external reference check, annotation formats, the append-only `## Reconciliation` record, the
`## Current state` refresh, the sequence ending in the printed change list), the direction rules
(write surface, weaken-never-strengthen), the shared repairs, and — in its `resume-task-reconcile`
mapping section — this pipeline's finding-type → edit mapping.

Phase 1 catches drift in what the docs *claim* — on disk, and in whatever artifact a claim names,
including one behind a URL; the contract's **external reference check**, run here, sweeps the folder's
*citations* for the freshness the brief never touches, recording what it saw in `observations.md`.
Different cuts, not a disk/network split: the sweep captures title, status, and last-updated, so it
never substitutes for Phase 1's claim-level verification. Print its `## References` block after the
brief and before any edit — it is this pipeline's only source of dead-link and
reference-answered-question findings.

Findings that need real work (code changes, re-running the acceptance gate, clearing a blocker) stay
unfixed: list them under "Not reconciled" with the next skill named (`implement-task`, `plan-task`).

## Output

Lists, never tables.

- **Brief** — the full briefing exactly as `resume-task` specs it, printed at the end of Phase 1 from
  pre-reconcile state. Its "Where to start" section is part of that snapshot; the **Next** line below
  is what accounts for the reconciled state.
- **References** — the reference check's tagged entries, printed at the start of Phase 2 before any
  edit, exactly as the shared contract specs it — rendered even when nothing was cited.
- **Reconciliation applied** — the change list exactly as `./references/workflow/reconciliation.md`
  specs it: every edit with the finding or engineer answer behind it, plus the "Not reconciled" list.
  When nothing was actionable, print `Nothing to reconcile.` — and write nothing beyond the sweep's
  `observations.md` rewrite, not even an empty Reconciliation entry.

**Next:** the concrete follow-up after the edits — the skill named against the "Not reconciled"
findings (`/implement-task <slug>` for work the docs can't fix, `/plan-task <slug>` for a step that
needs rethinking), or the first action from the brief when nothing was left unreconciled.

## Verification

Confirm the protocol invariants before finishing:

- [ ] `✅ Core agents-kit rules applied` echoed once; Phase 1 ran from `resume-task`'s skill file with
      its domain-pack step intact — not improvised
- [ ] The brief printed in full from pre-reconcile state, before any edit, and was never regenerated
      after one
- [ ] Reconciliation followed the shared contract; every edit maps to a brief finding, a reference
      finding, or an engineer answer, and judgment items were asked as one batched round
- [ ] The reference check ran in Phase 2 with its `## References` block printed before any edit —
      rendered even when none cited — and `observations.md` rewritten with the swept lines, or
      removed when nothing was cited; Phase 1 swept no citations
- [ ] Write surface held: only `plan.md`, `result.md`, `CONTEXT.md`'s References / Open Questions
      annotations, and the sweep's `observations.md` rewrite — `goals.md`, `ticket.md`, and
      `diagram.md` untouched, no code written, no git mutation, no `BRIEF.md` or scratch file
- [ ] Closing change list printed, with real-work findings under "Not reconciled" and the next skill
      named — or `Nothing to reconcile.` with nothing written beyond the sweep's
      `observations.md` rewrite

---
name: review-task-reconcile
description: Use when asked to sanity-check a task's plan and also act on the findings — one command that prints the feasibility assessment from pre-reconcile state, then reconciles obvious findings into the task docs and folds your answers to the review's Questions into the plan. Also re-checks the folder's cited tickets, PRs, and docs against their live state. Writes the task docs only; never code, never git.
argument-hint: '[task folder path] [-x (cross-vendor grounding probe)] — passed through to the review phase'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

One command for the review-and-fix pipeline: validate the plan against reality (`review-task`), then
write the assessment's findings back into the task docs and fold the engineer's answers into the
plan. Two phases, in order — the assessment is a faithful snapshot of **pre-reconcile** state, and
the reconcile runs against it.

Phase 1 executes its skill file — read the sibling `SKILL.md` and run its full protocol; Phase 2 runs
against the reference contract it names. Three overrides apply pipeline-wide:

- **Core Rules blocks** — the composite's own block above covers the pipeline; the inner skill's
  AGENTS.md read is already satisfied and doesn't repeat. The override stops there: `review-task`'s
  domain-pack step still runs, resolving the task's `**Domain:**` and applying that pack
  (`./references/workflow/domain-packs.md`).
- **Chat display** — the composite's Output owns what reaches you. Unlike the review pipelines over a
  diff, this one holds nothing back: the assessment prints in full at the end of Phase 1, **before**
  any edit.
- **Next pointers** — the inner skill's follow-up suggestions are dropped; the composite's Output
  owns **Next**.

Past these three, a phase departs from its skill or contract only where its own section below says
so — never by improvisation.

**CRITICAL**: The write surface is exactly four task files — `plan.md`, `result.md`, minimal
annotations in `CONTEXT.md`'s References / Open Questions sections, and the sweep's `observations.md`
rewrite — and nothing else. `goals.md`, `ticket.md`, `diagram.md`, and a doc task's deliverable are
never edited (the goals and ticket are the user's contract — a suggested goal rewrite is printed for
the user to apply, and an engineer's answer about a goal goes to the user as text, not into the file;
the diagram is `implement-task`'s to repaint — drift is flagged, never repaired; the deliverable's
`**Published:**` line is `stage-doc`'s), source code is never written, git state is never mutated,
and external systems are fetched read-only — never commented on, updated, or posted to. This
pipeline fixes the **docs**, not the world — it never re-runs the acceptance gate and never
executes plan work. It still does not implement and does not redesign: a step that needs rethinking
goes back to `plan-task`.

Invoking this skill is the consent for the obvious, evidence-dictated fixes only. Anything needing
engineer judgment — which is most of this review's findings — is asked first, as one batched round.

## Flags

`-x` (cross-vendor grounding probe) passes through to the review phase unchanged — see
`../review-task/SKILL.md`. The probe is read-only and merges into Phase 1's grounding pass before its
verdicts finalize; it has no effect on Phase 2.

## When to Use

**Use when:**

- The plan needs a sanity check *and* you intend to act on it in the same sitting — stale citations
  corrected, an incomplete Scope partition closed, vague Verify criteria sharpened
- The review's Questions should actually be put to you rather than left rhetorical
- `review-task` already produced an assessment and the answer is "yes, apply that"

**Skip when:**

- You only want the assessment → use `review-task`; it is strictly read-only
- The plan needs redesign, not repair — infeasible steps, a changed direction → use `plan-task`;
  this pipeline never redesigns
- You want status rather than feasibility → use `resume-task`, or `resume-task-reconcile` to write
  its findings back
- The information to write back came out of **this session's conversation** rather than the docs
  disagreeing with reality → that's the opposite direction; use `reconcile-task`
- The plan's `**Status:**` is `skipped` — terminal, and exempt from reconciliation entirely; Phase 1
  reports it as abandoned and Phase 2 writes nothing

## Phase 1 — Review

Execute `../review-task/SKILL.md` end to end against the resolved task folder, passing `-x` through
when given, and print its assessment in full — every output section, including the always-rendered
Goal Quality, Acceptance Coverage, and Cross-File Drift sections and its numbered Questions.

The assessment is the pipeline's pre-reconcile snapshot and the evidence Phase 2 acts on, so it
prints **before** any edit and is never regenerated afterwards. If Phase 2 fails hard, the assessment
still stands as printed — the review is never lost to a dead pipeline.

## Phase 2 — Reconcile

Apply the assessment's findings to the task docs per the **docs → reality** direction of
`./references/workflow/reconciliation.md` — read it before editing; it is the single source of truth
and this phase adds no mechanics of its own. It defines the shared mechanics (consent model, the
external reference check, annotation formats, the append-only `## Reconciliation` record, the
`## Current state` refresh, the sequence ending in the printed change list), the direction rules
(write surface, weaken-never-strengthen), the shared repairs, and — in its `review-task-reconcile`
mapping section — this pipeline's finding-type → edit mapping.

The contract's **external reference check** runs here too: `review-task` sweeps no citations, so
sweep the folder's *citations from an actionable surface* and print the `## References` block before
any edit, recording what the sweep saw in `observations.md` — it is this pipeline's only source of
dead-link and reference-answered-question findings.

Per that mapping, the assessment's Questions are **not left rhetorical**: put them to the engineer as
one batched round, with the concrete options the assessment already attached, and write the answers
into the plan exactly as given — no redesign around them. Engineer answers refine plan *content*;
they never advance *state*.

Findings that need real work (a step that must be rethought, a goal the user has to rewrite, code
changes) stay unfixed: list them under "Not reconciled" with the next skill named (`plan-task`,
`implement-task`).

## Output

Lists, never tables.

- **Assessment** — the full review output exactly as `review-task` specs it, printed at the end of
  Phase 1 from pre-reconcile state, including the Plan Summary's `Cross-check:` line when `-x` was
  passed.
- **References** — the reference check's tagged entries, printed at the start of Phase 2 before any
  edit, exactly as the shared contract specs it — rendered even when nothing was in scope.
- **Reconciliation applied** — the change list exactly as `./references/workflow/reconciliation.md`
  specs it: every edit with the finding or engineer answer behind it, plus the "Not reconciled" list.
  When nothing was actionable, print `Nothing to reconcile.` — and write nothing beyond the sweep's
  `observations.md` rewrite, not even an empty Reconciliation entry.

**Next:** the concrete follow-up after the edits — `/implement-task <slug>` when the plan is now
ready to execute, `/plan-task <slug>` for a step the review sent back for redesign, or the specific
goal rewrite left for the user to apply in `goals.md`.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Phase 1 ran from `review-task`'s skill file with its domain-pack step intact and `-x` passed
      through unchanged — not improvised
- [ ] The assessment printed in full from pre-reconcile state, before any edit, and was never
      regenerated after one
- [ ] Reconciliation followed the shared contract; every edit maps to an assessment finding, a
      reference finding, or an engineer answer, and the review's Questions were put as one batched
      round with only answered items applied
- [ ] The reference check ran in Phase 2 with its `## References` block printed before any edit —
      rendered even when nothing was in scope — and `observations.md` rewritten with the swept
      lines, or removed in that case; Phase 1 swept no citations
- [ ] Write surface held: only `plan.md`, `result.md`, `CONTEXT.md`'s References / Open Questions
      annotations, and the sweep's `observations.md` rewrite — `goals.md`, `ticket.md`,
      `diagram.md`, and a doc task's deliverable untouched (suggested rewrites printed, not written),
      no code written, no git mutation
- [ ] No implementation and no redesign; steps needing rethinking routed to `plan-task`
- [ ] Closing change list printed, with real-work findings under "Not reconciled" and the next skill
      named — or `Nothing to reconcile.` with nothing written beyond the sweep's
      `observations.md` rewrite

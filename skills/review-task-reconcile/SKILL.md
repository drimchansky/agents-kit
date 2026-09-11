---
name: review-task-reconcile
description: Use when asked to sanity-check a task's plan and also act on the findings — one command that prints the feasibility assessment from pre-reconcile state, then reconciles obvious findings into the task docs and rules on the review's Questions itself, each ruling applied and recorded with the reading it declined. Also re-checks the folder's cited tickets, PRs, and docs against their live state. Writes the task docs only; never code, never git.
argument-hint: '[task folder path] [-x (cross-vendor grounding probe)] — passed through to the review phase'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

One command for the review-and-fix pipeline: validate the plan against reality (`review-task`), then
write the assessment's findings back into the task docs, the review's own Questions ruled on and
folded into the plan. Two phases, in order — the assessment is a faithful snapshot of
**pre-reconcile** state, and the reconcile runs against it.

Phase 1 executes its skill file — read the sibling `SKILL.md` and run its full protocol; Phase 2 runs
against the reference contract it names. Three overrides apply pipeline-wide:

- **Core Rules blocks** — the composite's own block above covers the pipeline; the inner skill's
  AGENTS.md read is already satisfied and doesn't repeat. The override stops there: `review-task`'s
  domain-pack step still runs, resolving the task's `**Domain:**` and applying that pack.
- **Chat display** — the composite's Output owns what reaches you. Unlike the review pipelines over a
  diff, this one holds nothing back: the assessment prints in full at the end of Phase 1, **before**
  any edit.
- **Next pointers** — the inner skill's follow-up suggestions are dropped; the composite's Output
  owns **Next**.

Past these three, a phase departs from its skill or contract only where its own section below says
so — never by improvisation.

**CRITICAL**: The write surface is exactly what
`./references/workflow/reconciliation-docs-to-reality.md` § *Write surface* fixes — the task files,
plus the two surfaces reaching past the folder, `ticket.md` and an applicable `GROUP_CONTEXT.md`, on
the added terms of `./references/workflow/reconciliation.md` § *The upstream ask is writable, and
never rewritten quietly* — and nothing else; that section names every never-edited file and why.
This pipeline fixes the **docs**, not the
world (`./references/workflow/reconciliation.md` § *Docs, not the world*). It still does not
implement and does not redesign: a step that needs
rethinking is flag-only and goes back to `plan-task`, per the mapping's *Infeasible or
conflicts-with-existing steps* row.

A user invoking this skill is the consent the contract's § *Consent model: findings apply, the record
carries them* defines; a model-invoked run carries no such consent and asks for every fix. Past that
bar nothing is put back to you: a finding admitting more than one defensible edit is ruled on here,
applied, and recorded with the reading it passed over.

## Flags

`-x` (cross-vendor grounding probe) passes through to the review phase unchanged — see
`../review-task/SKILL.md`. The probe is read-only and merges into Phase 1's grounding pass before its
verdicts finalize; it has no effect on Phase 2.

## When to Use

**Use when:**

- The plan needs a sanity check *and* you intend to act on it in the same sitting — stale citations
  corrected, an incomplete Scope partition closed, vague Verify criteria sharpened
- The review's Questions should actually be settled and written into the docs rather than left
  rhetorical
- `review-task` already produced an assessment and the answer is "yes, apply that"

**Skip when:**

- You only want the assessment → use `review-task`; it is strictly read-only
- The plan needs redesign, not repair — infeasible steps, a changed direction → use `plan-task`;
  this pipeline never redesigns
- You want status rather than feasibility → use `resume-task`, or `resume-task-reconcile` to write
  its findings back
- The information to write back came out of **this session's conversation** rather than the docs
  disagreeing with reality → that's the opposite direction; use `reconcile-task`
- The plan's `**Status:**` is `skipped` — terminal, and exempt from reconciliation entirely
  (§ *Skipped plans are exempt*); Phase 1 reports it as abandoned and Phase 2 writes nothing

## Phase 1 — Review

Execute `../review-task/SKILL.md` end to end against the resolved task folder, passing `-x` through
when given, and print its assessment in full — every output section, including the always-rendered
Goal Quality, Acceptance Coverage, and Cross-File Drift sections and its numbered Questions. Like
every base skill in this direction, `review-task` sweeps no citations of its own — see the
**docs → reality** direction definition opening `./references/workflow/reconciliation.md`; the
folder's cited links are Phase 2's business.

The assessment is the pipeline's pre-reconcile snapshot and the evidence Phase 2 acts on: it prints
**before** any edit and is never regenerated afterwards, per the contract's § *Sequence and output*.
If Phase 2 fails hard, the assessment still stands as printed — the review is never lost to a dead
pipeline.

## Phase 2 — Reconcile

Apply the assessment's findings to the task docs per `./references/workflow/reconciliation.md` and
its **docs → reality** direction file `./references/workflow/reconciliation-docs-to-reality.md`, read
before editing: how those two split the mechanics between them, and that a phase running them adds
none of its own, is the shared file's opening. This pipeline's finding-type → edit mapping is the
direction file's `review-task-reconcile` section.

The contract's reference sweep, `./references/workflow/reconciliation-sweep.md`, runs in this phase,
its `## References` block printed before any edit; that file owns the sweep in full, its scope script
and the unavailable-script fallback included.
It is this pipeline's only source of dead-link and reference-answered-question findings.

The assessment's **numbered open questions** are this phase's to rule on, not to relay: `review-task`
still produces the section, and here each entry becomes a ruling this run makes on the evidence in
front of it — the option that evidence best supports, written into the home file the direction file's
§ *`review-task-reconcile` — assessment findings* names, the option passed over recorded with it per
`./references/workflow/reconciliation.md` § *Consent model: findings apply, the record carries them*,
and no redesign around it. An entry whose options all reach past what the finding itself reached is
redesign rather than a ruling: name `plan-task` under "Not reconciled" instead. What a ruling may
move is bounded by the direction file's § *Repairs weaken; advances go through the shared engine* —
it refines plan and grounding content, and never attests that work was done: an advance goes through
`./references/workflow/reconciliation.md` § *Strengthen only on verified evidence*, re-verified in
this run. The assessment's **Answered by research** list is evidence rather than a ruling target. Its
originating findings still follow the direction's mapping: a disproved finding needs no Phase 2
action, while one the answer merely supplied repair content for carries that answer into its
**judged** row as the edit that lands.

Findings that need real work (a step that must be rethought, code changes) stay unfixed, listed as
*Needs work* under "Not reconciled" with the next skill named (`plan-task`, `implement-task`) per
§ *Consent model: findings apply, the record carries them*.

## Output

Lists, never tables.

- **Assessment** — the full review output exactly as `review-task` specs it, printed at the end of
  Phase 1 from pre-reconcile state, including the Plan Summary's `Cross-check:` line when `-x` was
  passed.
- **References** and **Reconciliation applied** — rendered exactly as their contracts spec them:
  `./references/workflow/reconciliation-sweep.md` § *Output and routing* for the sweep's tagged
  entries, which lands before any Phase 2 edit, and `./references/workflow/reconciliation.md`
  § *Sequence and output* for the change list and for what a run with nothing actionable writes.

**Next:** the concrete follow-up after the edits — `/implement-task <slug>` when the plan is now
ready to execute, or `/plan-task <slug>` for a step the review sent back for redesign or a direction
a judged grounding edit changed.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Phase 1 ran from `review-task`'s skill file with its domain-pack step intact and `-x` passed
      through unchanged — not improvised
- [ ] The assessment printed in full from pre-reconcile state, before any edit, and was never
      regenerated after one — § *Sequence and output*
- [ ] Every edit maps to an assessment finding or a reference finding; each of the review's numbered
      open questions was ruled on and applied, or named `plan-task` where every option was redesign;
      and research-answered evidence fed its surviving originating finding through that finding's
      registered route —
      `./references/workflow/reconciliation-docs-to-reality.md`
      § *`review-task-reconcile` — assessment findings*
- [ ] Every box checked or `**Status:**` advanced went through
      `./references/workflow/reconciliation.md` § *Strengthen only on verified evidence*,
      re-verified in this run — a judged edit refines plan and grounding content, never state
- [ ] The reference check ran in Phase 2 — or its gate skipped it — its scope enumerated by
      `sweep-scope.ts` rather than by hand, with the `## References` block printed before any edit,
      rendered even when nothing was in scope, and `observations.md` rewritten with the swept lines
      or removed — `reconciliation-sweep.md`
- [ ] Write surface held: nothing written outside the task files the direction fixes and the two
      external surfaces the shared contract opens, and every file that section keeps off the surface
      untouched — `./references/workflow/reconciliation-docs-to-reality.md` § *Write surface*,
      `./references/workflow/reconciliation.md` § *The upstream ask is writable, and never rewritten
      quietly*, whose terms every `ticket.md` or group-file edit met: the external surface named,
      both wordings quoted, the ask never rewritten to match what was built
- [ ] No implementation and no redesign; steps needing rethinking flagged and routed to
      `plan-task` — the *Infeasible or conflicts-with-existing steps* row
- [ ] Closing change list printed, with *Needs work* lines under "Not reconciled" and the next skill
      named — or `Nothing to reconcile.` with nothing written beyond the sweep's
      `observations.md` rewrite — § *Sequence and output*
- [ ] Every judgment item was applied, its record line naming the readings it declined and what chose
      between them — nothing deferred for an answer — and the one user-owned surface, a deliverable's
      `**Published:**` line, landed under "Not reconciled" as *Yours to apply* with its proposed text
      where one exists — `./references/workflow/reconciliation.md` § *Consent model: findings apply,
      the record carries them*

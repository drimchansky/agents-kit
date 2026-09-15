# Reconciliation: Docs → Reality

Reconcile printed findings against disk through `resume-task-reconcile` or `review-task-reconcile`, adding `./reconciliation-sweep.md`. Apply `./reconciliation.md`.

## Write surface

- `plan.md`: use the five shared openings under § *Repairs weaken; advances go through the shared engine*.
- `result.md`: append under `./reconciliation.md` § *The record*; apply § *Current state refresh*. Finalization writes Acceptance and required In review.
- `CONTEXT.md`: auto-annotate References/Open Questions under `./task-lifecycle.md`; judge prose changes under `./reconciliation.md` § *Grounding docs change on evidence, never silently*.
- `goals.md`: **judged** changes under that grounding rule and durable IDs, nominated only by § *`review-task-reconcile` — assessment findings*.
- `observations.md`: the sweep rewrites it.
- `ticket.md` and applicable `GROUP_CONTEXT.md`: apply `./reconciliation.md` § *The upstream ask is writable, and never rewritten quietly*. Ticket edits are the auto broken-link annotation, or a judged rewrite when fetched requester wording shows the ask moved (§ *Cited reference changed*). Never fit a ticket to what disk holds; that drift is **Needs work**, naming `plan-task`.

Exclude deliverables (`./reconciliation.md` § *Authored surfaces are never written*); route Published through § *Never-annotated surfaces* there. Execute no plan work; run acceptance only for verified advances.

## Repairs weaken; advances go through the shared engine

Repairs clear checked boxes or take `done → executing`, `in-review → executing`, or `executing → to-do`. They never set `skipped`, `blocked`, or `in-review`.

Check boxes, record `met`, or advance only through `./reconciliation.md` § *Strengthen only on verified evidence*. Reports, conversation, and judged edits attest no progress (§ *Grounding docs change on evidence, never silently* there).

## Shared repairs (both composites)

Use brief drift, assessment cross-file findings, or either sweep. Routes: `./reconciliation.md` § *The mapping legend*.

- **Unbacked `- [x]` step**, work gone or result absent: **auto**-uncheck, drop its link, and cite the dropped anchor in Reconciliation. Preserve prior records, What/Verify, and numbering.
- **Lifecycle repairs** — **auto** downward repairs; invent no Acceptance, cause, or pending goal.
  - `done` without Acceptance: take `done → executing` and remove `**Completed:**`.
  - `executing` without result: checked steps or verified work warrant a skeleton result (`implement-task`'s init header) holding the Reconciliation section, with the plan's Result link pointed at it. With no evidence, take `executing → to-do`, restore the Result placeholder, create nothing. Judge ambiguity downward.
  - `blocked`/`in-review` without result: **flag only**.
  - `done` without result: repair to `executing`, then apply its missing-result rule above.
  - Unknown status: **judged**: choose the weakest evidence-supported status (`./task-lifecycle.md`); record the original verbatim.
- **Result records work the plan doesn't show** — nominate for verification; check only on pass. Otherwise flag **Needs work**, naming `implement-task`.
- **Inherited group constraint contradicts a task artifact** — **judged**: rule on inherited grounding versus pending steps or assessment Cross-File Drift. Apply upstream-ask terms to groups and grounding terms to local What/Verify, context, or goals. Apply evidence-settled corrections and prior decisions; leave unresolved impactful precedence choices pending. Flag redesign for `plan-task`.
- **Cited reference materially changed or gone** — apply `./reconciliation.md` § *Cited reference changed*.
- **Never-annotated surface changed or broken** — apply `./reconciliation.md` § *Never-annotated surfaces*. Name changed pages and stale claims for `warn`, including cleared pause causes; name gone pages for `block`.

## `resume-task-reconcile` — brief findings

Use Drift since plan, Commits since watermark, Open questions, and the sweep. Briefs neither sweep nor write watermarks (`./reconciliation-commits.md` § *Read/write split*). Links and answers use `./reconciliation.md` § *Annotation formats*; unbacked steps and lifecycle claims use Shared repairs.

- **A `met` goal no longer holds** — **auto**: take `done → executing` or `in-review → executing`; remove Completed. Leave checkboxes unchanged. Record `G<n>`, supersede Acceptance, and name `implement-task` under Not reconciled.
- **Commit-nominated candidate** — **verify** the full step tier (`./execution-loop.md` § *Two verification tiers*). Pass: check and link this Reconciliation (`./reconciliation-commits.md` § *The record*; same-day suffix: `./reconciliation.md` § *The record*). Otherwise leave pending, name `implement-task`, and explain non-rerunnable criteria.
- **Verified advances would close the plan** — **verify** every goal and fresh health through the shared advance engine. Failure: stay executing; refer to `implement-task`. Pass: append Acceptance verdicts and enter done, or in-review with its required section for an external-only remainder (`./task-lifecycle.md`).
- **`[info]` findings** — make no edit or completion claim; they verify no pending work.
- **Watermark writes** — **auto** under `./reconciliation-commits.md` § *Degenerate cases* and § *The record*.
- **External blocker cleared** — apply `./reconciliation.md` § *Cited reference changed*. Refresh Pointers; flag pause-only citations without editing pauses. Change no status; name `implement-task` under Not reconciled.
- **Missing goals/context** — never fabricate them; flag for `plan-task`.

## `review-task-reconcile` — assessment findings

Use assessment and sweep findings. References take `./reconciliation.md` § *Annotation formats*; cross-file drift takes Shared repairs.

Route numbered Questions using assessment evidence under `./reconciliation.md` § *Consent model: findings apply, the record carries them*. Reuse the assessment's researched options. Apply evidence-settled answers at home and record declined options; leave unresolved impactful choices pending. Stay within findings. Disproved findings route nowhere.

- **Scope partition not total** — **judged**: use verified step reach and prior decisions to settle delivered/deferred placement. Leave an unresolved impactful partition choice pending. Retire only requirements dropped by ticket/context, under `./reconciliation.md` § *Grounding docs change on evidence, never silently*; repair retired-ID citations below.
- **Ticket criterion maps to no goal** — **judged**: add a goal with the next free `G<n>`. Remove ticket criteria only on changed-ask evidence (§ *Write surface*), never because work is missing.
- **Stale or orphan goal citations** — **judged**: repoint to the fitting goal, mark `none (infra/refactor)`, or add a next-free-ID goal and cite it. Flag step removal for `plan-task`.
- **Vague or untestable Verify criterion** — **judged**: apply the assessment's rewrite; check only through verification (§ *Repairs weaken; advances go through the shared engine*).
- **Gaps and needs-clarification steps** — **judged**: apply the assessment's answer within What/Verify or Scope.
- **Goal quality findings** (`weak`/`vague-or-untestable`/`unresolved`) — **judged**: apply the suggested goal rewrite; drop resolved `_(unresolved: …)_`. Without a rewrite, flag for `plan-task`.
- **CONTEXT ↔ goals / CONTEXT ↔ plan contradictions** — **judged**: prefer later evidence; rewrite Scope/steps, goals, or context. With no section change, annotate context Open Questions. Record the losing side; flag plan redesign for `plan-task`.
- **Restated grounding** — **judged**: resolve diverged copies and their home (`./one-home.md` § *One home per fact*). Replace plan-side copies with citations, retaining plan-time deltas. Change context only when newer plan content supplies surviving grounding.
- **Infeasible or conflicts-with-existing steps** — **flag only**, naming `plan-task`.

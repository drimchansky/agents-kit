# Reconciliation: Shared Contract

Compaction: `./reconciliation-compaction.md`.

- **Docs → reality** (`./reconciliation-docs-to-reality.md`): resume-task-reconcile and review-task-reconcile compare docs with built work. Read-only resume-task/review-task may follow claim citations, but cannot sweep reference lists.
- **Session → docs** (`./reconciliation-session-to-docs.md`): reconcile-task records session discoveries without a write flag.

## Consent model: findings apply, the record carries them

User-invoked reconciliation applies every evidenced fix without mid-run questions. Model-invoked runs ask before fixing (`./skill-conventions.md` § *The invocation gate*).

An **obvious** fix needs no interpretation, alternatives, or invented annotation. **Judged** fixes choose among alternatives; record the rejected readings and deciding evidence (§ *The record*).

Without identifiable alternatives and deciding evidence, flag redesign for its owning skill. List unapplied findings under Not reconciled:

- **Needs work:** docs cannot fix it or verification failed. Name implement-task/plan-task, explain non-rerunnable criteria, and include all unverified steps/goals.
- **Yours to apply:** deliverable Published changes (§ *Never-annotated surfaces*). Supply paste-ready text for the user.

## The mapping legend

- **auto:** apply the obvious fix under the consent model above.
- **judged:** choose, apply, and record alternatives on evidence under that model.
- **verify:** re-prove the nominated claim before writing (§ *Strengthen only on verified evidence*).
- **flag only:** leave unchanged; name the repair owner and re-report (§ *Flag-only findings are re-reported*).

## Docs, not the world

Write task docs only: no code, Git, or external-system mutation. Each edit maps to a printed finding, except these sweep/watermark writes:

- Rewrite/remove observations.md under `./reconciliation-sweep.md`.
- Seed/re-seed watermarks under `./reconciliation-commits.md` § *Degenerate cases*; advance them under its § *The record*.

Read-only verification grants no work-product edit permission.

## One home per fact

Place grounding in CONTEXT, acceptance in goals, execution in plan, history in result, and answers beside questions (`./one-home.md` § *One home per fact*). Ticket edits follow the upstream-ask terms below. Siblings link to the home with `./` paths instead of copying it.

## Grounding docs change on evidence, never silently

Judge scope/acceptance changes: goals, step scope, and CONTEXT's Recommended Direction, MVP Scope, Not Doing, and Key Assumptions. Record each separately with prior/new wording, rejected readings, and deciding evidence.

Assign new goals the next free G<n>; preserve existing and retired IDs (`./task-goals.md`). Goals have no Status or Description section.

Goal edits establish no achievement. Advance only under § *Strengthen only on verified evidence*. Grading a goal met in its editing run voids that run's verdicts; re-derive them next run.

## The upstream ask is writable, and never rewritten quietly

Both directions judge ticket/group edits (`./task-store.md` § *Shared group context*). Ticket broken-link/group-answer annotations owe term 1; content edits owe all four:

1. Mark the record's external surface, naming the selected-root-relative group path or ticket section.
2. Quote prior/new wording there.
3. Require evidence that the ask/constraint changed. Do not fit the ask to built work or relax constraints after failure; flag such drift Needs work for plan-task.
4. Refer new criteria absent from goals to plan-task under Not reconciled; derive no goals beside the ticket edit.

## Strengthen only on verified evidence

Both directions may check steps, mark goals met, or advance to-do→executing, executing→done/in-review, and in-review→done.

Re-prove nominated claims in-session: full unit outcomes (`./execution-loop.md` § *Two verification tiers*) or goal acceptance, using resolved-domain verification.md (`../engineering/verification.md` for code). Findings/conversational claims are not proof. Flag unverifiable claims without advancement.

Before any advance to done or in-review, pass fresh integrated health even without product edits (`./execution-loop.md` § *Health boundaries*). Follow `../engineering/verification.md` § *Two verification tiers* or `../documentation/verification.md` § *Integrated health — declared boundaries*. Record Health below. Non-final advances need only unit outcomes.

Use in-review only for an external-only remainder awaiting user confirmation, receipt, or reported live state. These proxies count as external-goal evidence (`./acceptance-criteria.md`); finalization still requires fresh health.

## Skipped plans are exempt

Report abandonment; perform no reference sweep or writes, regardless of drift.

## The reference sweep

Sweep while assembling findings under `./reconciliation-sweep.md`. Only this sweep re-derives cited-reference freshness (`./one-home.md` § *One home per fact*).

## Authored surfaces are never written

Keep deliverables unchanged. Flag divergence by section and required content for implement-task; absent deliverables raise nothing. Published follows the next section.

## Never-annotated surfaces

Sweep Published and active pause sections without writing either (`./reconciliation-sweep.md` § *Scope*). Flag warn/block to the user for Published or implement-task for paused work. Record alongside other edits only. Re-report until the owner records repair at the owning surface.

Ticket/group writes follow upstream-ask terms. Ticket block takes Annotation formats; warn takes Cited reference changed. Group URLs remain unswept, unannotated, and undated.

## Flag-only findings are re-reported

Re-report every flag-only finding in full with its owner until that owner records repair; ledger entries alone do not resolve it.

For tagged findings, re-report fetched block and carried warn/block. Report warn once more after a clean fetch retags it info, then stop (`./reconciliation-sweep.md` § *Tags*).

Re-report untagged findings while disk or Reconciliation shows them. Report unrecorded session findings fully; their named owners hold the record.

## The record

- Append all edits to an existing/repaired result's `## Reconciliation — YYYY-MM-DD`; suffix same-day repeats `(2)`, then increment. Preserve prior sections, including Acceptance; supersede by new entry/status flip.
- Refresh Current state in place (`./task-authorship.md`). Decision log accepts appended dated pointers only.
- Without an existing or owed result (to-do plan), the printed change list is the record; create no result solely for logging.
- Judged edits include `— chose <reading> over <reading>: <deciding evidence>`, plus the required grounding quotes and external-surface details.

```markdown
## Reconciliation — YYYY-MM-DD

**Trigger:** `<skill>`; report printed this session from pre-reconcile state.
**Health:** <fresh boundary evidence in the resolved domain's shape; omit when no advance required a boundary>
**Commits:** <dated commit lines when scanned; follow `./reconciliation-commits.md` § The record for content and cap>

- plan.md — <edit> — finding: <section> [tag]. Prior record: <anchor when superseding>
- CONTEXT.md — <edit> — finding: <section> [tag]
- goals.md — was "<prior>", now "<new>" — finding: <section> [tag] — chose <reading> over <alternative>: <evidence>
- ticket.md — external surface: `ticket.md` § <section>; was "<prior>", now "<new>" — finding: <section> [tag] — chose <reading> over <alternative>: <evidence>
- GROUP_CONTEXT.md — external surface: `<root-relative-path>` § <section>; was "<prior>", now "<new>" — finding: <section> [tag] — chose <reading> over <alternative>: <evidence>

**Not reconciled:**

- Needs work — G2 regressed — re-run acceptance via `/implement-task <slug>`
- Needs work — new ticket criterion absent from goals — re-derive via `/plan-task <slug>`

---
```

Code boundaries: `../engineering/verification.md` § *What a boundary records*. Commit lines: `./reconciliation-commits.md` § *The record*.

## Annotation formats

Annotate only direction-writable surfaces:

- **Broken external link, auto:** append `— _broken as of YYYY-MM-DD (404)_` on context References/Open Questions, plan steps/Open Questions, or ticket citing lines. Replace known redirects with target URLs. Exclude Never-annotated surfaces, prior results, goals, and group URLs (`./reconciliation-sweep.md` § *Scope*).
- **Answered open question:** append `— _answered YYYY-MM-DD: <answer> ([source](url) when there is one)_` beside context/plan Open Questions. Unambiguous quotation/paraphrase is auto; otherwise judge and record close alternatives. Group questions follow upstream-ask terms. Resolve goals' unresolved markers through the direction's goal row, not annotations.

Correct broken-link/Pointers gone/moved notes are no-ops. Re-date only changed failures; avoid duplicates. Carried tags cause no edits (`./reconciliation-sweep.md` § *Tags*); flag-only findings still re-report.

## Cited reference changed

Refresh warn/block Pointers entries (§ *Current state refresh*). For block, retain the identifier and add a dated gone/moved note. Record only alongside other edits. Answers take Annotation formats.

- Changed references alone cannot change status. PR merge proves no acceptance; reconciliation cannot resume blocked work.
- Context/plan/ticket block uses Annotation formats; excluded surfaces follow Never-annotated surfaces.
- Judge ticket warn only on fetched requester wording that changes the ask, applying upstream-ask quotes and plan-task referral. Otherwise record alongside other edits only.
- Route each occurrence by its surface (`./reconciliation-sweep.md` § *Fetching*); a URL shared by Pointers and Published gets both outcomes.
- Carried tags and correct gone/moved notes create no edit; flag-only findings remain reportable.

Fetched contradictions permit judged context rewrites with evidence and rejected readings recorded under the grounding rules above.

## Current state refresh

Finish result writes by refreshing Current state (`./task-authorship.md`) within the resulting plan status.

- Live executing/blocked/in-review plans re-derive every field and name the concrete next action. Preserve the watermark unless `./reconciliation-commits.md` permits advancement.
- Plans already done at run start freeze narrative and Next. Refresh world-truth Pointers, including moved/merged references, and Updated (`./one-home.md` § *One home per fact*).
- A newly terminal plan writes its final digest before freezing; done→executing repair refreshes the now-live block fully.

Only direction repair rules or verified advancement move status/checkboxes. The digest follows and asserts no stronger state.

## The `plan.md` write surface

Use these openings as the direction permits, plus session direction's two additional openings:

- **Checkboxes/result links:** unchecking clears the trailing link; verified checking links its evidence section. Every checked step requires that link.
- **Status:** advance under verified-evidence rules; repair through `./reconciliation-docs-to-reality.md` § *Repairs weaken; advances go through the shared engine*.
- **Result header:** link a skeleton result or restore the pre-execution placeholder under docs→reality repair.
- **Annotations:** broken links in steps/Open Questions; answers in Open Questions, under Annotation formats.
- **Step content:** judge Verify, gaps, Scope, goal citations, and restated grounding only within the finding's scope (§ *One home per fact*). Flag broader redesign Needs work for plan-task.

Preserve existing step numbers in both directions. Permitted insertions use Step 3a/3b rather than shifting siblings.

## Sequence and output

1. Print the full report from pre-reconcile state and preserve it after edits. Reconcile-task sweeps before composing and renders References inline.
2. Sweep before edits (`./reconciliation-sweep.md`). Composites print References at reconciliation start. Tags supply finding evidence; the ledger rewrite lands with the check.
3. Apply obvious fixes by file: owed result, plan, then context.
4. Apply judged fixes in that order, then goals, ticket, and groups. Record each judged edit as it lands.
5. Refresh Current state.
6. Print the change list below. With no actionable findings, print `Nothing to reconcile.` and write only the sweep ledger. Append no empty Reconciliation section or watermark advance (`./reconciliation-commits.md` § *The record*).

```markdown
## Reconciliation applied

- `plan.md` — <edit> (finding: <section> [tag])
- `result.md` — <edit> (finding: …)
- `CONTEXT.md` — <annotation, or prose rewrite> (finding: …)
- `goals.md` — <edit> (finding: …)
- `ticket.md` — <edit> (finding: …) — external surface
- `<path>/GROUP_CONTEXT.md` — <edit> (finding: …) — external surface

**Not reconciled:**

- <Needs work | Yours to apply> — <finding> — <skill, or proposed text>
```

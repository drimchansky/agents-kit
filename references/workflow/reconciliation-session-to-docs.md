# Reconciliation: Session → Docs

`reconcile-task` enriches task docs with current-session findings. Shared mechanics: `./reconciliation.md`.

## Write surface

Write context, goals, plan, result, ticket, inherited group files, and sweep ledger. Exclude deliverables (`./reconciliation.md` § *Authored surfaces are never written*), Published lines, and active pause sections (§ *Never-annotated surfaces* there). Results follow § *The record* there.

Use the five shared plan openings, plus:

- **New steps**, **judged**: insert without renumbering existing steps.
- **New open questions**, **auto**: append in Open Questions.

Judge context prose, goals, and step scope under `./reconciliation.md` § *Grounding docs change on evidence, never silently*. Ticket/group content additionally follows § *The upstream ask is writable, and never rewritten quietly*. Annotation-only edits retain § *Annotation formats*' route.
Every judged row follows the shared consent model; an unresolved impactful choice writes no dependent change before the answer.

Auto-enrich references, questions, and result narrative at their home (`./reconciliation.md` § *One home per fact*).

## `reconcile-task` — session findings

Use the session and sweep (`./reconciliation-sweep.md`); routes follow `./reconciliation.md` § *The mapping legend*.

- **New reference/spec/ticket** — **auto**: append label, URL, and short description to context References when absent.
- **Open question answered in session** — use the shared answer format: **auto** if unambiguous, otherwise **judged**. Keep the full decision evidence dated and reachable from concise current guidance, including on a to-do task with no result (`./one-home.md` § *One home per fact*). Goals' `_(unresolved: …)_` uses the goal-change row.
- **Cited link broken** (`block`) — **auto**: use the shared broken-link format or known redirect target. Carried blocks add no edit (`./reconciliation.md` § *Annotation formats*).
- **Cited reference answers an open question** (`warn`) — use the shared answer format and fetched source at the question's home: **auto** if unambiguous, otherwise **judged**.
- **Cited reference materially changed or gone** — apply `./reconciliation.md` § *Cited reference changed*. Name `implement-task` under Not reconciled wherever that row leaves status unchanged.
- **Never-annotated surface changed or broken** — **flag only** under `./reconciliation.md` § *Never-annotated surfaces*: user for Published, `implement-task` for pauses.
- **Shared constraint changed or contradicted** — **judged**: apply evidence-settled corrections and prior decisions; otherwise leave an impactful precedence choice pending. Write settled group edits under upstream-ask terms and local scope/Verify, context, or goals at home. Quote both statements with their sources, cite the group file by its path from the selected root, and record which side lost. Flag redesign for `plan-task`.
- **New open question** — **auto**: append grounding questions in context, execution questions in plan.
- **Session narrative** without state or grounding change — **auto**: append Reconciliation to result. When work is evidenced, create result; **verify** before taking `to-do → executing` under `./task-lifecycle.md` § *Companion result file* and the shared advance engine.
- **Step completed this session** — **verify** Verify and domain per-unit checks (`./execution-loop.md` § *Two verification tiers*). Pass: check and record evidence. Otherwise leave pending; flag **Needs work**, naming `implement-task`.
- **Goal met this session** — **verify** acceptance. Record passing `met` in Reconciliation, or Acceptance when finalizing. Finalization requires all goals, applicable engineering live checks, and fresh health under `./reconciliation.md` § *Strengthen only on verified evidence*. Its delivered-source selector applies to deployable engineering `in-review → done`; documentation and supported local-only engineering use current work-product health. Enter in-review for downstream verification, including checks without goal IDs; enter done only when all pass or have supported N/A. Failed work routes **Needs work** to `implement-task`, with no status flip.
- **`(external)` goal confirmed** — **verify** its best-available proxy (`./acceptance-criteria.md`). With downstream checks pending, append its proxy-backed `met` verdict in Reconciliation, superseding prior Acceptance without rewriting it. Before the last pending item closes, verify engineering live checks and freshly pass integrated health on the surface selected by `./reconciliation.md` § *Strengthen only on verified evidence*. Missing delivered-source proof for deployable engineering stays pending, without a failed-health claim. Pass: append `met` and health evidence, take `in-review → done`, and write Completed together. An actual health failure records receipt and failure, preserves the authoritative pending state, and stays in-review. Failed or absent proxy also leaves that verdict and status unchanged.
- **Engineering live check resolved** — **verify** expected release, workload health, and frontend/backend behavior under `../engineering/acceptance-gate.md`. Append evidence or supported N/A in Reconciliation. Keep unresolved targets in In review (`./task-lifecycle.md` § *Companion result file*). An observed failure routes **Needs work** to `implement-task`; no completion advance follows it. The last passing check can close in-review only after all goals and fresh health pass on the selected surface (`./reconciliation.md` § *Strengthen only on verified evidence*).
- **New, reworded, or retired goal** — **judged**: apply session-supported changes under the grounding rule; preserve durable IDs. Replace a resolved marker's alternatives with the selected current rule and a decision-record citation, preserving the acceptance outcome and historical alternatives. A goal written this run is never recorded `met` in the same run; that verdict waits for a later run's re-verification.
- **Changed direction/MVP scope/Not Doing/Key Assumptions** — **judged**: rewrite the matching context section; quote prior wording in the record.
- **Changed step scope/new step/changed Verify** — **judged**: edit within the finding; keep Scope's goal-ID partition total.
- **Changed ask** — **judged**: write the ticket on upstream-ask terms, with requester wording as evidence, both wordings quoted, and the section named. Refer uncovered criteria to `plan-task` under Not reconciled. Never fit the ask to built work.
- **Deliverable content decided but absent** — **flag only**, naming `implement-task`; stale published copies take the Published row instead.
- **Work discussed but not done** — **flag only**, naming `implement-task`.

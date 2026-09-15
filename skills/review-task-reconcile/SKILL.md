---
name: review-task-reconcile
description: Use when asked to sanity-check a plan and act on findings. Prints the pre-reconcile assessment, applies settled corrections, and presents unresolved impactful choices using the review's research. Writes task docs only; never code or Git.
argument-hint: '[task folder path] [-x (cross-vendor grounding probe)] — passed through to the review phase'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

One command for the review-and-fix pipeline: validate the plan against reality (`review-task`), then reconcile its findings. Settle the review's Questions or present them for input. The assessment is a snapshot of pre-reconcile state.

Phase 1 runs `../review-task/SKILL.md`'s full protocol; Phase 2 runs the reference contract it names. Three overrides apply pipeline-wide:

- **Core Rules blocks**: this block covers the pipeline; the inner AGENTS.md read does not repeat. `review-task`'s domain-pack step still runs.
- **Chat display**: the assessment prints in full at the end of Phase 1, before any edit.
- **Next pointers**: the inner skill's follow-ups are dropped; this Output owns **Next**.

A phase departs from its skill or contract only where its section below says so.

The write surface is exactly what `./references/workflow/reconciliation-docs-to-reality.md` § *Write surface* fixes: the task files plus `ticket.md` and an applicable `GROUP_CONTEXT.md`, on the added terms of `./references/workflow/reconciliation.md` § *The upstream ask is writable, and never rewritten quietly*. `./references/workflow/reconciliation-docs-to-reality.md` § *Write surface* names every never-edited file. This pipeline fixes the docs, not the world (`./references/workflow/reconciliation.md` § *Docs, not the world*), and never implements or redesigns: a step that needs rethinking is flag-only and goes back to `plan-task`, per the mapping's *Infeasible or conflicts-with-existing steps* row.

User invocation authorizes settled corrections under `./references/workflow/reconciliation.md` § *Consent model: findings apply, the record carries them*. Unresolved impactful choices are presented with their options; those still unanswered remain Awaiting decision. A model-invoked run has no write consent and asks before each fix.

## Flags

`-x` (cross-vendor grounding probe) passes through to `../review-task/SKILL.md` unchanged. The probe is read-only, merges into Phase 1's grounding pass, and has no effect on Phase 2.

## When to Use

**Use when** the plan needs a sanity check and you intend to act on it in the same sitting, the review's Questions should be settled and written into the docs, or `review-task` already produced an assessment and the answer is "apply that".

**Skip when** you only want the assessment → `review-task`; the plan needs redesign, not repair → `plan-task`; you want status rather than feasibility → `resume-task` or `resume-task-reconcile`; the information came out of this session's conversation rather than the docs disagreeing with reality → `reconcile-task`; the plan is `skipped` → terminal and exempt (§ *Skipped plans are exempt*), so Phase 1 reports it as abandoned and Phase 2 writes nothing.

## Phase 1 — Review

Execute `../review-task/SKILL.md` end to end against the resolved task folder, passing `-x` through when given, and print its assessment in full: every output section, including the always-rendered Goal Quality, Acceptance Coverage, and Cross-File Drift sections and its numbered Questions. `review-task` sweeps no citations of its own (the **docs → reality** direction definition opening `./references/workflow/reconciliation.md`); the folder's cited links are Phase 2's.

The assessment prints before any edit and is never regenerated afterwards (§ *Sequence and output*). If Phase 2 fails hard, the assessment stands as printed.

## Phase 2 — Reconcile

Apply the assessment's findings per `./references/workflow/reconciliation.md` and `./references/workflow/reconciliation-docs-to-reality.md`, read before editing. This pipeline's finding-type → edit mapping is the direction file's § *`review-task-reconcile` — assessment findings*.

Run the reference sweep, `./references/workflow/reconciliation-sweep.md`, in this phase, its `## References` block printed before any edit. It is this pipeline's only source of dead-link and reference-answered-question findings.

Route every numbered Question through § *Consent model: findings apply, the record carries them*. Reuse `review-task`'s researched options, trade-offs, and recommendation without repeating research. An entry whose options exceed the finding is redesign and goes to `plan-task`. A ruling never attests work; advances still require § *Strengthen only on verified evidence*. Disproved findings need no action. A deliverable's `**Published:**` line remains Yours to apply.

Findings that need real work (a step to rethink, code changes) stay unfixed, listed as *Needs work* under "Not reconciled" with the next skill named (`plan-task`, `implement-task`).

## Output

Lists, never tables.

- **Assessment**: the full review output as `review-task` specs it, printed at the end of Phase 1 from pre-reconcile state, including the Plan Summary's `Cross-check:` line when `-x` was passed.
- **References** and **Reconciliation applied**: rendered per `./references/workflow/reconciliation-sweep.md` § *Output and routing* (before any Phase 2 edit) and `./references/workflow/reconciliation.md` § *Sequence and output* (the change list, and what a run with nothing actionable writes).

**Next:** answer Awaiting decision when present; otherwise use `/implement-task <slug>` when ready or `/plan-task <slug>` for redesign.

---
name: resume-task-reconcile
description: Use when asked to catch up on a task and write findings back. Prints the pre-reconcile brief, applies settled corrections, presents unresolved impactful choices, and re-checks cited links. Writes task docs only; never code or Git.
argument-hint: '[task folder path]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

One command for the catch-up-and-fix pipeline: brief the task (`resume-task`), then write the brief's findings back into the task docs so they stop overstating what has been built. The brief is a snapshot of pre-reconcile state; the reconcile runs against it.

Phase 1 runs `../resume-task/SKILL.md`'s full protocol; Phase 2 runs the reference contract it names. Three overrides apply pipeline-wide:

- **Core Rules blocks**: this block covers the pipeline; the inner AGENTS.md read does not repeat. `resume-task`'s domain-pack step still runs.
- **Chat display**: the brief prints in full at the end of Phase 1, before any edit.
- **Next pointers**: the inner skill's follow-ups are dropped; this Output owns **Next**.

Any other departure from the inner skill or the contract is named in the phase's section below.

This pipeline writes only what `./references/workflow/reconciliation-docs-to-reality.md` § *Write surface* allows: the task files, plus `ticket.md` and an applicable `GROUP_CONTEXT.md` on the added terms of `./references/workflow/reconciliation.md` § *The upstream ask is writable, and never rewritten quietly*. `./references/workflow/reconciliation-docs-to-reality.md` § *Write surface* names every never-edited file and bounds what a reconcile may re-run. It fixes the docs, not the world (`./references/workflow/reconciliation.md` § *Docs, not the world*), and creates no `BRIEF.md` or scratch briefing file.

User invocation authorizes settled corrections under `./references/workflow/reconciliation.md` § *Consent model: findings apply, the record carries them*. Unresolved impactful choices are presented with their options; those still unanswered remain Awaiting decision. A model-invoked run has no write consent and asks before each fix.

## When to Use

**Use when** returning to a task whose docs have drifted (stale statuses, steps checked for work that is gone, dead links) and you want them corrected; wrapping up or handing off; or `resume-task` already showed drift and the answer is "fix that".

**Skip when** you only want to know where the task stands → `resume-task`; the gap needs real work → `implement-task`; the information came out of this session's conversation rather than the docs overstating reality → `reconcile-task`; the plan is `skipped` → terminal and exempt, so Phase 1 reports it as abandoned and Phase 2 writes nothing.

## Phase 1 — Brief

Execute `../resume-task/SKILL.md` end to end against the resolved task folder and print its brief in full: every template section, including the always-rendered "Drift since plan" heading and, wherever the commit scan resolves a repository, "Commits since watermark". The brief sweeps no citations (the **docs → reality** direction definition opening `./references/workflow/reconciliation.md`); the cited links are Phase 2's.

The brief prints before any edit and is never regenerated afterwards (`./references/workflow/reconciliation.md` § *Sequence and output*). If Phase 2 fails hard, the brief stands as printed.

## Phase 2 — Reconcile

Apply the brief's findings per `./references/workflow/reconciliation.md` and `./references/workflow/reconciliation-docs-to-reality.md`, read before editing. This pipeline's finding-type → edit mapping is the direction file's § *`resume-task-reconcile` — brief findings*.

Run the reference sweep per `./references/workflow/reconciliation-sweep.md` in this phase, since the brief sweeps nothing; print its `## References` block after the brief and before any edit. It is this pipeline's only source of dead-link and reference-answered-question findings, and it never substitutes for Phase 1's claim-level verification.

A judged finding follows § *Consent model: findings apply, the record carries them*. Grounding and external-surface records retain their required quotes. State moves only through § *Strengthen only on verified evidence*. Watermark writes retain their `./references/workflow/reconciliation-commits.md` route. A deliverable's `**Published:**` line remains Yours to apply.

Findings that need real work (code changes, re-running the acceptance gate, clearing a blocker) stay unfixed, listed as *Needs work* under "Not reconciled" with the next skill named (`implement-task`, `plan-task`).

## Output

Lists, never tables.

- **Brief**: the full briefing as `resume-task` specs it, printed at the end of Phase 1 from pre-reconcile state. Its "Where to start" section is part of that snapshot; the **Next** line below accounts for the reconciled state.
- **References** and **Reconciliation applied**: the sweep's tagged entries, then the change list, per `./references/workflow/reconciliation-sweep.md` § *Output and routing* and `./references/workflow/reconciliation.md` § *Sequence and output* (the latter covering a run with nothing actionable). References lands at the start of Phase 2, before any edit.

**Next:** answer Awaiting decision when present; otherwise use the skill named against Needs work, or the brief's first action.

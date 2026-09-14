---
name: resume-task-reconcile
description: Use when asked to catch up on a task and also write the findings back — one command that prints the resume briefing from pre-reconcile state, then reconciles the task docs to reality; obvious fixes applied, judgment calls settled on the run's own evidence and recorded with the readings they declined. Also re-checks the folder's cited links against their live state. Writes the task docs only; never code, never git.
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

Invoking this skill as the user supplies this direction's consent, on the terms `./references/workflow/reconciliation.md` § *Consent model: findings apply, the record carries them* sets; nothing is put back to the user mid-run. A model-invoked run has no such consent and asks before each fix.

## When to Use

**Use when** returning to a task whose docs have drifted (stale statuses, steps checked for work that is gone, dead links) and you want them corrected; wrapping up or handing off; or `resume-task` already showed drift and the answer is "fix that".

**Skip when** you only want to know where the task stands → `resume-task`; the gap needs real work → `implement-task`; the information came out of this session's conversation rather than the docs overstating reality → `reconcile-task`; the plan is `skipped` → terminal and exempt, so Phase 1 reports it as abandoned and Phase 2 writes nothing.

## Phase 1 — Brief

Execute `../resume-task/SKILL.md` end to end against the resolved task folder and print its brief in full: every template section, including the always-rendered "Drift since plan" heading and, wherever the commit scan resolves a repository, "Commits since watermark". The brief sweeps no citations (the **docs → reality** direction definition opening `./references/workflow/reconciliation.md`); the cited links are Phase 2's.

The brief prints before any edit and is never regenerated afterwards (`./references/workflow/reconciliation.md` § *Sequence and output*). If Phase 2 fails hard, the brief stands as printed.

## Phase 2 — Reconcile

Apply the brief's findings per `./references/workflow/reconciliation.md` and `./references/workflow/reconciliation-docs-to-reality.md`, read before editing. This pipeline's finding-type → edit mapping is the direction file's § *`resume-task-reconcile` — brief findings*.

Run the reference sweep per `./references/workflow/reconciliation-sweep.md` in this phase, since the brief sweeps nothing; print its `## References` block after the brief and before any edit. It is this pipeline's only source of dead-link and reference-answered-question findings, and it never substitutes for Phase 1's claim-level verification.

A finding admitting more than one defensible edit is settled here: pick the reading the brief's and the sweep's evidence best supports, write it, and give its record line the alternatives passed over (§ *Consent model: findings apply, the record carries them*). A grounding rewrite also quotes the prior wording (§ *Grounding docs change on evidence, never silently*); a `ticket.md` or group-file edit also names the external surface and quotes both wordings (§ *The upstream ask is writable, and never rewritten quietly*), never rewriting the ask to match what was built. State (a box, a `**Status:**`, a goal recorded `met`) moves only through § *Strengthen only on verified evidence*, re-verified in this run. Watermark writes follow `./references/workflow/reconciliation-commits.md`: a missing baseline seeded where a `result.md` exists, an orphan re-seeded, the scanned commit list recorded, the `**Pointers:**` entry advanced to the scanned HEAD. The one user-owned surface, a deliverable's `**Published:**` line, goes to *Yours to apply* under "Not reconciled" with proposed text.

Findings that need real work (code changes, re-running the acceptance gate, clearing a blocker) stay unfixed, listed as *Needs work* under "Not reconciled" with the next skill named (`implement-task`, `plan-task`).

## Output

Lists, never tables.

- **Brief**: the full briefing as `resume-task` specs it, printed at the end of Phase 1 from pre-reconcile state. Its "Where to start" section is part of that snapshot; the **Next** line below accounts for the reconciled state.
- **References** and **Reconciliation applied**: the sweep's tagged entries, then the change list, per `./references/workflow/reconciliation-sweep.md` § *Output and routing* and `./references/workflow/reconciliation.md` § *Sequence and output* (the latter covering a run with nothing actionable). References lands at the start of Phase 2, before any edit.

**Next:** the skill named against the *Needs work* lines (`/implement-task <slug>` for work the docs cannot fix, `/plan-task <slug>` for a step that needs rethinking), or the first action from the brief when nothing was left unreconciled.

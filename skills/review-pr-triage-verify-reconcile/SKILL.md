---
name: review-pr-triage-verify-reconcile
description: Use when asked for a verified review of a PR or branch and to act on it in the same sitting — one command that runs the review → triage → verify pipeline, prints its verdicts in full, then appends one plan step per Confirmed finding you accept to a task folder's `plan.md` and records the append in `result.md`. Writes those two task files only; never code, never git, never the PR.
argument-hint: '[task folder path or slug] [-x (cross-vendor second review)] [-p (parallel lens probes + gap sweep)] [-d (draft PR description)] — flags passed through to the review phase'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One command for the review-and-record pipeline: run the full verified review of the current branch (`review-pr-triage-verify`), then append the Confirmed findings you accept to a task folder's plan as new steps. Two phases, in order — the review's verdicts are the reconcile phase's entire finding set, and that phase derives none of its own.

Phase 1 executes its skill file — read the sibling `SKILL.md` and run its full protocol, that pipeline's own Setup included; Phase 2 runs against the reference contracts it names. Three overrides apply pipeline-wide:

- **Core Rules blocks** — the composite's own block above covers the pipeline; the inner pipeline's AGENTS.md and engineering-rules reads are already satisfied and don't repeat. The override stops there: every other step of `review-pr-triage-verify`, Setup included, still runs.
- **Chat display** — the composite's Output owns what reaches you. The review pipeline's Output prints whole at the seam, **before** any edit; Phase 2's sections follow it.
- **Next pointers** — the inner pipeline's follow-up suggestions are dropped; the composite's Output owns **Next**.

Past these three, a phase departs from its skill or contract only where its own section below says so — never by improvisation.

**CRITICAL**: The write surface is exactly two task files, `plan.md` and `result.md` — the strict subset of the session → docs surface that `./references/workflow/reconciliation-session-to-docs.md` § *Write surface* fixes for this composite, and that section names every file the direction leaves read-only. Nothing outside those two is written, and the review half's guarantee holds end to end: no code edited, no PR posted to, no git state mutated (`./references/workflow/reconciliation.md` § *Docs, not the world*). `/review-pr-triage-verify` invoked on its own still writes nothing at all — the write lives here, strictly after that pipeline's Output.

Invoking this skill is **not** consent to the append. `./references/workflow/reconciliation.md` § *Consent model: obvious fixes only, ask for the rest* leaves this composite no obvious-fix path at all, so invoking it buys the review; every step it writes goes through that section's batched round first.

## Flags

`-x` (cross-vendor second review), `-p` (parallel lens probes), and `-d` (draft PR description) pass through to Phase 1 — see `../review-pr-triage-verify/SKILL.md`, which forwards them to its own review phase with the one suppression it states on `-p`. They shape what the review finds and have no effect on Phase 2, which writes what the round accepts either way.

## When to Use

**Use when:**

- A PR or branch needs a verified review *and* the defects it confirms should land in the task's plan in the same sitting
- Those defects are work to schedule rather than a fix to apply now — appended as steps, executed later by `implement-task`
- The task folder whose plan shipped the reviewed work is known: named in the invocation, or already established this session

**Skip when:**

- You only want the review → use `review-pr-triage-verify`; it is strictly read-only
- You want the Confirmed findings fixed now rather than planned → use `fix-findings`, which edits working-tree code and writes no task doc
- What should reach the docs came out of the session at large rather than from a review's verdicts → that is this direction's other member; use `reconcile-task`, whose surface is all four core files
- The docs overstate what's built — stale statuses, vanished shipped claims → that's the opposite direction; use `review-task-reconcile` or `resume-task-reconcile`
- The plan is `to-do` or `skipped`, or its companion `result.md` is missing → Setup refuses all three below, before the review is spent

## Setup

Resolve the target task folder **before Phase 1 runs**, and refuse here rather than later. Everything in this section is decidable without the review, so refusing now costs nothing, while refusing after Phase 1 would waste the whole review — and with `-x` a cross-vendor probe with it. That is the economy `../review-pr-triage-verify/SKILL.md`'s own Setup argues for its working-tree precondition, applied at the other end of the pipeline.

Take the task from the invocation — a slug, a task-folder path, or a full `plan.md` path — by the **base resolution** in `./references/workflow/task-layout.md` § *Discovery rules for skills*, under that section's **resolve-current-or-refuse** rule, which this skill is the member of. Two resolution outcomes stop the run:

- **Nothing names a task** — no argument, and none established this session. Unlike the skills that fall back to listing the active folders and asking which, this one refuses: the steps land in the plan that shipped the reviewed code, and a listing is no evidence of which plan that is. Say the task has to be named, and stop.
- **Unresolvable** — a slug or path matching no task folder. Report what was looked for and stop; never widen to a neighboring folder.

Then read the resolved `plan.md`'s `**Status:**`, whether a companion `result.md` exists, `goals.md`'s `G<n>` list (the round asks which goals a defect threatens), and `CONTEXT.md`'s `**Domain:**`, default `engineering` — this pipeline's review and reconcile halves are both calibrated for engineering only, so a task in another domain is announced before the run rather than silently reviewed against the wrong pack (`challenge-task` reads its own domain the same way). It selects nothing this skill loads, and the produced step's **Verify** field names only the finding's immediate outcome; the later `implement-task` run resolves its own health recipe. Three outcomes stop the run:

- **`skipped`** — terminal, and exempt from reconciliation entirely (`./references/workflow/reconciliation.md` § *Skipped plans are exempt*). Report the plan as abandoned and stop.
- **`to-do`** — reviewed work sits on the branch beside a plan that was never started, which has no companion result file by design (`./references/workflow/task-lifecycle.md` § *Companion result file*). The disagreement here is between the branch and the docs — whether the work began at all — not between a plan and its result file, so no reconciler repairs it and the missing file is not what stops the run. Surface it and stop; never write around it by appending to an unstarted plan.
- **No companion `result.md`** on a plan the two stops above left standing — `executing`, `blocked`, `in-review`, or `done`. A record is owed the moment a step is appended (`./references/workflow/reconciliation.md` § *The record*), and this composite creates no result file, so an absent one leaves the run owing a record it cannot write. On these four the absence *is* drift: `./references/workflow/task-lifecycle.md` § *Companion result file* names it in its closing paragraph, and the docs → reality composites repair it — a skeleton result file where work is evidenced. Report that and stop.

A **`blocked`** plan is accepted rather than refused: appending steps enriches a paused plan and resumes nothing. It, and `executing`, `done`, and `in-review`, are all taken by **The target's status** in `./references/workflow/reconciliation-verified-findings.md`, which decides what each one flips.

## Phase 1 — Review

Execute `../review-pr-triage-verify/SKILL.md` end to end against the current branch — its Setup, its three phases, and its degrade rules unchanged — passing `-x`, `-p`, and `-d` through when given. Print its Output at the seam: every section that skill specs, its mandatory `Verified:` line and its `Reviewed` provenance line included, less the `**Next:**` the overrides above drop.

That Output is this run's report. It prints **before any file is written**, which is what satisfies `./references/workflow/reconciliation.md` § *Sequence and output* step 1 for this member (**The round** in `./references/workflow/reconciliation-verified-findings.md`), and it is never regenerated afterwards. If Phase 2 fails hard, the Output still stands as printed — the review is never lost to a dead pipeline.

**No Confirmed finding** → Phase 2 has nothing to offer: skip the round, write nothing, and close with `Nothing to reconcile.`

## Phase 2 — Reconcile

Append the accepted findings per `./references/workflow/reconciliation.md` and its **session → docs** direction file `./references/workflow/reconciliation-session-to-docs.md` — read both before editing; together they are the single source of truth and this phase adds no mechanics of its own. The shared file defines the shared mechanics (consent model, the `plan.md` openings and the step-stability rule, the append-only record in its § *The record*, the `## Current state` refresh, the sequence ending in the printed change list); the direction file defines the direction rules, and `./references/workflow/reconciliation-verified-findings.md` is this phase's entire mapping — the verdict filter, then, in that section's named paragraphs, **The round**, **The produced step**, **Where the steps land**, **`## Scope` normally stays untouched**, **The target's status**, and **The record**. Those six are cited by name below; each lives in that one section, not as a heading of its own.

Three things about running that mapping here, none of them left to judgment:

- **The finding set is Phase 1's, and nothing else.** Each finding is taken as that phase left it, verdict and all. Because the set is pinned to a producing phase, this phase runs **no reference sweep and renders no `## References` block** — `./references/workflow/reconciliation.md` § *The reference sweep* exempts it by name, and that exemption transfers no ownership: `reconcile-task` still sweeps the same folder.
- **Both authorities, or no step.** A step is written only where the **Confirmed** verdict and your acceptance in the round both hold; nothing is written before the round is answered, and a round that accepts nothing writes no file at all. Nothing else in the two files moves — the mapping's legend admits **ask** rows only here.
- **The reopen precedes the first write.** A `done` or `in-review` target is reopened before any step is appended; the mapping's **The target's status** fixes what flips and on which files, and `./references/workflow/status-transitions.md` registers it as this composite's **append-driven reopen** — the one transition this phase makes.

Findings that produce no step — declined, unanswered, or carrying a verdict or a triage bucket the mapping never offers — go to the printed "Not reconciled" list with that reason, and leave no trace in the folder.

## Output

Lists, never tables.

- **Review** — Phase 1's Output as `../review-pr-triage-verify/SKILL.md` § *Output* specs it, printed at the end of that phase before any edit and never regenerated after one. Every section that file lists survives the seam, each under its own condition — read the list there rather than a copy here, which would only drift from it — with the single exception the overrides above make: its `**Next:**` is dropped, because this composite's Output owns that pointer.
- **Reconciliation applied** — the change list exactly as `./references/workflow/reconciliation.md` § *Sequence and output* specs it: each appended step with the finding behind it, the reopen as its own bullet when one happened, and the "Not reconciled" list carrying every finding that produced no step with its reason. When the round accepted nothing, print `Nothing to reconcile.` and write nothing — no entry, no flip, no `## Current state` rewrite.

Neither phase renders a `## References` block: this pipeline sweeps nothing (Phase 2 above).

**Next:** `/implement-task <slug>` executes the appended steps — the plan is live work again where the run reopened it. `/publish-pr-review` still posts Phase 1's **Findings** list, which the append did not change; with `-d`, `/update-pr-description` applies the drafted **PR description**. `/fix-findings` for a Confirmed finding you would rather fix now than schedule, and `/plan-task <slug>` for one the round declined as outside the plan's scope.

## Verification

Confirm the protocol invariants before finishing. A `§` names a heading of `./references/workflow/reconciliation.md` or of its direction file `./references/workflow/reconciliation-session-to-docs.md`; a **bold** name is a paragraph inside `./references/workflow/reconciliation-verified-findings.md`. Check the behavior against the cited text, not against this list:

- [ ] Setup resolved the task before Phase 1 ran, and stopped there — nothing written, no review spent — on a `skipped` plan, a target with no companion `result.md` (the `to-do` plan among them), an unresolvable task, or a run naming none
- [ ] A `**Domain:**` other than `engineering` announced before Phase 1 ran — the pipeline is engineering-calibrated end to end — rather than run silently against the wrong pack
- [ ] Phase 1 ran from `../review-pr-triage-verify/SKILL.md` end to end, its own Setup included and `-x` / `-p` / `-d` passed through as that skill specifies — not improvised
- [ ] Its Output printed in full before any file was written and stands exactly as printed — never regenerated after an edit, and still standing had Phase 2 stopped — § *Sequence and output*
- [ ] Every appended step maps to a **Confirmed** finding accepted in the batched round, and was built, placed, and numbered per **The produced step** and **Where the steps land** — no existing step number moved
- [ ] Write surface held: `plan.md` and `result.md` only, everything else in the folder untouched, and no code, git, or PR mutation anywhere in the run — § *Write surface*
- [ ] The target's status handled per **The target's status**, any flip it owed taken before the first step was written
- [ ] One `## Reconciliation` entry recorded and `## Current state` refreshed, in the shape § *The record* fixes and with the per-step bullet **The record** adds
- [ ] No sweep run and no `## References` block rendered — § *The reference sweep*'s exemption for a finding set pinned to a producing phase
- [ ] Closing change list printed, every unwritten finding under "Not reconciled" — or `Nothing to reconcile.` with no file written at all

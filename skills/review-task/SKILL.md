---
name: review-task
description: Use when asked to review, validate, or sanity-check a task's plan — confirms the direction is right and still in sync with CONTEXT.md, the goals, and current reality, and surfaces any drift between task artifacts (ticket, CONTEXT, goals, plan, result) and the work itself. Read-only.
argument-hint: '[task folder path] [-x (cross-vendor grounding probe)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so.

Validate a plan against current reality and report feasibility, gaps, and questions. This skill is read-only: implement nothing, redesign nothing, and write no file. Route steps needing rethinking to `plan-task`.

## Flags

- `-x`: add one read-only cross-vendor grounding probe in Step 2. Apply `./references/workflow/probe-cross-check.md`, `./references/workflow/probe-shape-grounding.md`, `./references/workflow/agent-fanout.md`, and `./references/workflow/probe-engines-cross-vendor.md`. Off by default. Record its outcome on the Plan Summary's `Cross-check:` line. <!-- cold -->

## Locate the Plan

Resolve the folder using **resolve-or-ask** in `./references/workflow/task-layout.md`; accept a full `plan.md` path directly.

Read `plan.md`, `goals.md`, and `CONTEXT.md` in full, plus `ticket.md` and `result.md` when present. The plan is the review subject. This whole-file read overrides `./references/workflow/task-layout.md` § *Reading a resolved folder*'s read order.

Before assessment, read applicable `GROUP_CONTEXT.md` files from disk, root-to-task, using `./references/workflow/task-store.md` § *Shared group context*. Resolve the chain from the folder's current location on every run. Outside registered roots, no group context applies.

The ticket supplies the upstream ask (`./references/workflow/ticket-format.md`); context supplies scope, assumptions, direction, and references. Goals define acceptance; step `**Goal:**` citations must cover them. Context and goals are required grounding. Flag missing context; report missing goals as the highest-priority gap, since quality and coverage cannot be assessed. An absent ticket is normal.

## When to Review

**Use when** validating a new or existing plan before execution, especially its integration points, shared changes, and new patterns.

**Skip when** findings should also be applied → `review-task-reconcile`; execution is already requested → `implement-task`; or review exceeds the value of a trivial plan or clear bug fix.

## Review Process

### 1. Parse the Plan

Extract the goal, ordered steps, scope, integration points, and implicit assumptions. Capture each step's What, Verify, Depends on, and optional Due, Lead time, and Touches.

Read each `### Checkpoint after Step N` and its assertions. Engineering checkpoint assertions follow `./references/engineering/planning.md` § *Checkpoints*; health commands belong at their adjacent boundary.

Restate the intent in your own words. Identify ambiguous steps without silently selecting an interpretation.

### 2. Ground in the Domain's Reality

Verify every integration point independently of the plan's exploration. Inspect actual artifacts for existence, assumed behavior, reusability or availability, and affected work. Names alone establish none of these. Investigate concerns before dismissing them or reporting them as defects.

With `-x`, launch the probe before grounding inline. Supply reality claims, integration points, reuse assumptions, referenced files/symbols/APIs, and the absolute project root. Require per-claim `CONFIRMED` / `CONTRADICTED` / `NOT FOUND` with `file:line` evidence. Use `./references/workflow/probe-cross-check.md`, `./references/workflow/probe-shape-grounding.md`, and `./references/workflow/probe-engines-cross-vendor.md`. Continue the primary pass while it runs; collect before Step 3 and re-check contradictions before assigning verdicts. Record the mandatory `Cross-check:` outcome, including `skipped (<reason>)` when unavailable. The probe supplements the primary pass. <!-- cold -->

For code, apply `./references/engineering/exploration.md`: inspect implementations, installed API versions, and message or transaction formats.

### 3. Assess Each Step

Give every step an evidence-backed verdict:

- **Feasible**: executable with existing patterns and infrastructure.
- **Feasible with caveats**: executable, but missing details.
- **Needs clarification**: interpretations differ enough to affect implementation.
- **Conflicts with what exists**: contradicts patterns, conventions, or constraints.
- **Infeasible as stated**: the required artifact or capability cannot support the step.

Assess every Verify criterion for concrete, testable evidence. Surface vague or untestable criteria now, with the affected step.

### 4. Audit Goal Quality

Apply every check in `./references/workflow/acceptance-criteria.md` to each goal:

- **good**: passes every dimension.
- **weak**: a limited shortfall; feedback rather than a blocker.
- **vague-or-untestable**: fails the bar; revise or mark `_(unresolved: ...)_` before execution.
- **unresolved**: already carries that marker; lift into Questions.

For each non-good goal, name the exact failing checklist dimension and suggest a concrete rewrite where possible. Lift all three non-good classes into Questions. Without goals, skip the audit and retain the missing-file finding as highest priority.

### 5. Check Acceptance Coverage

Run `node <kit-root>/scripts/task-state.ts <task folder>` and use `goalCoverage`. Resolve `<kit-root>` through `./references/workflow/task-store.md` § *Resolving `<kit-root>`*; CLI contract: `./references/scripts/task-state.md`. If the root, script, or Node is unavailable, say so and map `**Goal:**` citations by hand. <!-- cold -->

Coverage is citation-driven, with one content judgment for partial delivery:

- **Covered**: `goals` names a citing step; list all citing steps.
- **Partially covered**: citing steps visibly deliver only part; name the missing behavior.
- **Uncovered**: listed in `uncoveredGoals` and not deferred; add a step or citation before execution.
- **Out of scope (deferred)**: listed in `scopePartition.deferred`; coverage is not required.

Flag `orphanSteps` and `unknownGoalCitations`. The explicit `**Goal:** none (infra/refactor)` escape is legitimate. Lift uncovered goals, orphan steps, stale citations, and unresolved goals into Questions.

### 6. Check Cross-File Drift

Compare these pairs for substantive contradictions:

- **ticket ↔ goals**, when present: each ticket criterion maps to at least one goal, and no goal contradicts ticket scope (`./references/workflow/ticket-format.md` § *Ticket → goals*).
- **ticket ↔ context**, when present: flag a re-prosed Problem Statement that has diverged from the ticket. Suggest a citation to `./ticket.md` (`./references/workflow/one-home.md` § *One home per fact*).
- **context ↔ goals**: compare goals against Not Doing, MVP Scope, Recommended Direction, and Key Assumptions.
- **context ↔ plan**: compare scope and assumptions, including unsettled assumptions treated as settled. Flag duplicated grounding content, verbatim or reworded. Suggest keeping its home and replacing copies with citations, preserving interleaved plan-time deltas (`./references/workflow/one-home.md`). Citations with refinements or re-verification notes are conformant. The reconcile composite routes this as a judgment item.
- **goals ↔ plan**: inspect `scopePartition.missingFromPartition` and `inBoth` from Step 5. Every goal must belong to exactly one delivered/deferred partition.
- **plan ↔ result**, when present: compare recorded completion with checkboxes and step numbers. Check the companion requirements in `./references/workflow/task-lifecycle.md` § *Companion result file*.
- **inherited group context ↔ task artifacts**: compare constraints against ticket scope, goals, context, and every step. Quote both statements and sources; cite the group path from the selected root. Report only task-local consequences; propose no edit above the folder. A contradiction-free chain produces no finding.
- **status fields**: validate only the plan's lifecycle vocabulary and required companion sections (`./references/workflow/task-lifecycle.md`). Ignore legacy Status headers in context or result. Absence of result is conformant only for `to-do` or `skipped`; this check still runs when the plan/result pair cannot.

Report actual drift, not stylistic differences. Do not rewrite either artifact.

### 7. Identify Gaps

Check failure modes and boundaries, actor transitions, required inputs, dependency order, domain constraints, and missing execution details.

For Due/Lead time, confirm each lead time fits its own and dependent deadlines, including early starts for long-lead work. For Touches, verify coverage and claimed disjointness against actual edits; engineering traps are in `./references/engineering/planning.md` (Declaring edit surfaces).

Check cadence against `plan-task` § *Add Checkpoints*. Flag missing, misplaced, vague, or health-shaped assertions. Each engineering checkpoint names an end-to-end outcome; suite/typecheck/lint/build belong at the adjacent health boundary (`./references/engineering/planning.md` § *Checkpoints*).

For code, also apply that file's Common gaps to check in a code plan, including UI states, navigation, data, analytics, and patterns.

### 8. Check Pattern Consistency

Compare structure, conventions, and enforced boundaries with similar work. Assess justification for new dependencies, patterns, or exceptions. For code, use `./references/engineering/exploration.md`'s pattern checks.

### 9. Research the Questions

Collect and deduplicate candidates from Steps 3–7: unclear steps, Verify criteria, goal quality, coverage, stale citations, drift, and gaps. One unresolved goal is one candidate. With none, skip research and omit its outcome line.

Launch as soon as Step 7 closes, while Step 8 runs. Use one read-only native probe per question, batching trivially related questions. Apply `./references/workflow/probe-engines.md`, `./references/workflow/probe-shape-options-research.md`, and `./references/workflow/agent-fanout.md`. Collect all probes before rendering Questions.

Re-check each classification before adopting it:

- **ANSWERED**: verify the citation settles the question. Move it to Answered by research. Clear its originating finding only if that same re-check disproves the finding. When the answer supplies repair content, retain the finding and cite the answered entry.
- **OPTIONS**: verify every citation and trade-off; attach 2–3 grounded options and a recommendation to the surviving question.
- **NO-EVIDENCE**: repeat the named source-and-location search enough to support absence. Mark a genuine preference question; invent no options.

Promote surviving candidates into numbered Questions. Their originating sections retain the finding and cite its question number.

Research inline when an engine is unavailable, a probe dies, or a question arrives after launch, including Step 8 candidates. Count these under the outcome line's skipped segment, with reasons. Research rejected classifications inline too, counting them in the separate rejected-classification segment. A probe does not block the assessment; research remains required for every candidate. Use the exact outcome grammar in `./references/workflow/probe-shape-options-research.md`.

## Output Structure

### Plan Summary

Restate the goal and step list. With `-x`, close with `Cross-check:` per `./references/workflow/probe-cross-check.md`; omit the line without the flag. <!-- cold -->

### Feasibility Assessment

For every numbered step, give its title, verdict, supporting artifact or constraint, required changes, and Verify-criterion assessment.

### Goal Quality

Always render this section. List each goal's quality tag and failing dimension; explicitly say when all are good. If goals are missing, state that and skip the audit.

### Acceptance Coverage

Always render each goal ID with its coverage tag and citing steps, then orphan steps and stale citations. Without goals, state the highest-priority gap and omit per-goal mapping.

### Cross-File Drift

Always render this section, grouped by artifact pair; write `no drift detected` when clean. Skip the plan/result pair when no result exists, but always render Status fields.

### Gaps

Group missing execution details by category.

### Questions

When research answered candidates, open with **Answered by research**: question, verified answer, and evidence locator. Retained originating findings cite these entries as repair evidence.

Then number surviving questions. Each names its plan location, the implementation decision it affects, and researched options with trade-offs and recommendation. For a genuine preference, explicitly mark that no available source bears on it.

Close with `Question research:` per `./references/workflow/probe-shape-options-research.md` whenever any candidates existed, even if research answered them all.

### Confirmed

List the aspects verified and ready to execute.

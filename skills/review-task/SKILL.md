---
name: review-task
description: Use when asked to review, validate, or sanity-check a task's plan — confirms the direction is right and still in sync with CONTEXT.md, the goals, and current reality, and surfaces any drift between task artifacts (ticket, CONTEXT, goals, plan, result) and the work itself. Read-only.
argument-hint: '[task folder path] [-x (cross-vendor grounding probe)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so.

This skill validates a plan against current reality before execution begins. It catches infeasible steps, missing details, pattern conflicts, and implicit assumptions — producing a clear assessment with targeted questions.

The user provides a plan — typically the output of `plan-task`, written to `<task-dir>/plan.md`. Your job is to determine whether the plan can be executed as written given how things actually are, and surface anything that needs resolution first.

**CRITICAL**: Do not implement. Do not redesign the solution. Validate the plan. The output is a feasibility assessment with questions, not a revised plan or code — the review is strictly read-only and no file is touched.

## Flags

- `-x` — Cross-check: launch one independent grounding probe on the cross-vendor engine and merge it into the grounding pass (Step 2), per `./references/workflow/probe-cross-check.md` on the grounding shape in `./references/workflow/probe-shape-grounding.md`, under the shared contract in `./references/workflow/agent-fanout.md`, with the engine and its launch recipe in `./references/workflow/probe-engines-cross-vendor.md`. Off by default. The probe is read-only; its outcome is recorded on the Plan Summary's `Cross-check:` line. <!-- cold -->

## Locate the Plan

Resolve a task folder per the **resolve-or-ask** discovery rules in `./references/workflow/task-layout.md` — cite it, don't restate it; a full `plan.md` path is taken directly.

Once the folder is resolved, read its `plan.md` (one plan per folder; its sibling `goals.md` and `result.md` are inputs and execution records).

Read the plan, the sibling `goals.md`, the sibling `CONTEXT.md`, **and** the `ticket.md` and `diagram.md` when present, in full before assessing anything.

- **`ticket.md`** (when present) carries the product-facing ask and its acceptance criteria — the upstream origin `goals.md` is sharpened from (`./references/workflow/ticket-format.md`).
- **`CONTEXT.md`** carries the problem statement, scope summary, key assumptions, and external references for the task.
- **`goals.md`** carries the goals — the testable contract for what "done" means for this plan. The plan's steps must collectively cover every goal (each goal ID cited by a step's `**Goal:**` line).

`CONTEXT.md` and `goals.md` are authoritative input for grounding, not optional — a task is expected to have both. `ticket.md` and `diagram.md` are authoritative when they exist; neither one's absence is a gap, since a task may legitimately have no ticket, and gets a diagram only when its change alters structure. If the goals file is missing, flag it as a gap up front — `plan-task` is expected to produce one and the acceptance coverage check below cannot run without it.

## When to Review

**Use when:**

- A plan was just written by `plan-task` and the user wants a sanity check before implementation
- The plan references existing code, patterns, or APIs that need to be confirmed
- The plan touches multiple modules, shared code, or introduces new patterns
- The user wants a second pass before handing off to `implement-task`

**Skip when:**

- The assessment's findings should also be written back into the task docs, and its Questions actually put to you → use `review-task-reconcile`, which runs this review and then reconciles against it
- The plan is trivial enough that review takes longer than execution
- The user has already validated the plan themselves and wants to move to implementation
- The task is a small bug fix with a clear root cause

## Review Process

### 1. Parse the Plan

Extract the concrete claims and steps:

- **Goal** — What the plan is trying to accomplish
- **Steps** — Each ordered step's "What", "Verify", "Depends on", and any "Due" / "Lead time" / "Touches"
- **Checkpoints** — Any `### Checkpoint after Step N` blocks: where they're placed and what assertions they list (for code, the named end-to-end flow — `./references/engineering/planning.md` § *Checkpoints*, whose integrated suite, typecheck, lint, and build run at the adjacent health boundary rather than as authored assertions)
- **Scope** — What's in / out of scope and why
- **Integration points** — What existing code, components, APIs, or patterns the plan references or depends on
- **Implicit assumptions** — What the plan takes for granted without stating (available APIs, existing components, data availability)

Restate the plan's intent in your own words to confirm understanding. If steps are ambiguous, note the ambiguity — don't silently pick an interpretation.

### 2. Ground in the Domain's Reality

Verify the plan against what actually exists, not against its own claims — an independent pass; do not assume `plan-task`'s exploration was correct.

**With `-x`, launch the grounding probe first.** Before grounding inline, start one background probe on the **cross-vendor engine** per `./references/workflow/probe-cross-check.md`, on the grounding shape in `./references/workflow/probe-shape-grounding.md` and the launch recipe in `./references/workflow/probe-engines-cross-vendor.md`: a self-contained prompt carrying the plan's reality claims — integration points, "reuse X" assumptions, referenced files/symbols/APIs — with the project root as working root, demanding per-claim `CONFIRMED` / `CONTRADICTED` / `NOT FOUND` verdicts with `file:line` evidence. Then ground inline yourself as below while it runs; the probe supplements your pass, never replaces it. Collect it before Step 3 and merge per the contract: where it contradicts your grounding or the plan, re-check that spot before assigning the verdict. Record the outcome on the Plan Summary's `Cross-check:` line — including `skipped (<reason>)` when the engine is unavailable, in which case proceed on your own pass. <!-- cold -->

For each thing the plan references or integrates with:

- **Verify it exists** — the file, function, service, document, vendor, booking — whatever the plan leans on. Confirm it; don't take the name on faith.
- **Verify it does what the plan assumes** — inspect the actual thing, not just its name. A component called `ValidatorList`, or a venue described as "available," may not behave as assumed.
- **Check reusability / availability** — if the plan says "reuse X" or "use the existing Y," confirm it can actually be used as assumed (no hidden coupling, no prior commitment, no blocking constraint).
- **Map the blast radius** — what existing work will be affected by the proposed changes?

When the domain is code, follow `./references/engineering/exploration.md` for the concrete recipe (grep for the symbol, read the implementation, verify external API surface against installed versions, check the message/transaction format).

### 3. Assess Each Step

For every step, assign one of:

- **Feasible** — Can be executed as planned with existing patterns and infrastructure
- **Feasible with caveats** — Can be done, but the step is missing details or underspecifies behavior in certain cases
- **Needs clarification** — Ambiguous or underspecified — multiple interpretations exist and the choice affects implementation
- **Conflicts with what exists** — Contradicts established patterns, conventions, or constraints
- **Infeasible as stated** — Cannot be executed as described — the referenced thing doesn't exist, or can't be used as assumed, etc.

Also assess each step's **Verify** criterion: is it concrete enough to actually confirm the step worked? Flag verify criteria that are vague ("ensure it works") or untestable.

### 4. Audit Goal Quality

Before mapping goals to steps, assess the goals themselves. Coverage is meaningless if the goals are vague — a perfectly-covered plan can still ship the wrong thing because "the export works well" maps cleanly to a step that builds the wrong export.

Apply `./references/workflow/acceptance-criteria.md` to every goal in `goals.md`. Tag each goal with one of:

- **good** — passes every check (testable, specific, outcome-oriented, singular, bounded, stated as behavior)
- **weak** — passes overall but loses points on one dimension; note which (treated as feedback, not a blocker)
- **vague-or-untestable** — fails one or more checks; the goal must be revised (or marked `_(unresolved: ...)_`) before execution
- **unresolved** — already marked `_(unresolved: ...)_` in `goals.md`; record it here and lift it into Questions

Surface every `weak`, `vague-or-untestable`, and `unresolved` finding into the Questions section. For each, name the **specific failing dimension** ("not testable — no observable behavior named") and suggest a rewrite where you can ("'export is fast enough' → 'p95 export latency under 2s for the largest staging tenant'"). Don't paraphrase the failing dimension — point at the checklist line that didn't pass.

If the goals file is missing entirely, skip this step and treat the missing goals as the highest-priority finding in the coverage section below.

### 5. Check Acceptance Coverage

Run `node <kit-root>/scripts/task-state.ts <task folder>` — `<kit-root>` and the script's own `SCRIPTS.md` contract section both per `./references/workflow/task-store.md` § *Resolving `<kit-root>`* <!-- cold --> — and take the mapping from its `goalCoverage` rather than re-deriving it. Whether a goal is covered at all is **mechanical**, and the report is that answer, not a prose reading. Kit root, script, or `node` unavailable → say so and map the `**Goal:**` citations by hand. The one place a light read of the step is warranted is separating `covered` from `partially covered` below — a goal whose only citing step visibly delivers just part of it; that single judgment aside, the mapping stays citation-driven.

Tag each goal with one of:

- **Covered** — its `goals` entry names at least one step. Name the step(s).
- **Partially covered** — a step cites this goal ID but visibly delivers only part of it; name what's missing. (This is the one verdict that needs a light read of the step, not just its citation.)
- **Uncovered** — the report lists it in `uncoveredGoals`. The plan must add a step (or add the citation to an existing one) before execution.
- **Out of scope (deferred)** — `scopePartition.deferred` holds this goal ID; no step needs to cover it (expected, not a gap). A goal neither cited by a step nor in that list is the real inconsistency — flag it.

Also flag the inverse — **orphan steps**: the report's `orphanSteps` (a step citing no goal and carrying no escape) and its `unknownGoalCitations` (a step citing an ID `goals.md` doesn't hold). Each is scope creep, a missing goal, or a stale citation. Surface them; don't silently accept them. A step marked `**Goal:** none (infra/refactor)` is a legitimate infra/setup step and is in neither list.

Note any goal marked `_(unresolved: ...)_` from `goals.md` — these are deferred clarifying questions and should be lifted into the Questions section of this review's output.

### 6. Check Cross-File Drift

Per-step feasibility and acceptance coverage both assume the task artifacts agree with each other. They often don't. A goal can be added to `goals.md` after the plan was written; CONTEXT's "Not Doing" list can quietly exclude a behavior the plan now ships; a result file can record work that no longer matches the plan's status. Surface these mismatches as their own class of finding — they are not the same as a missing or vague step.

Compare the artifacts pairwise. For each pair, name the kind of drift the comparison is looking for; only flag actual contradictions, not stylistic differences.

- **`ticket.md` ↔ `goals.md`** (when a ticket exists) — Does every ticket acceptance criterion map to ≥1 goal (`G<n>`), and does any goal contradict the ticket's stated In/Out scope? The ticket is the product-facing ask; `goals.md` is its sharpened, testable form (`./references/workflow/ticket-format.md` § *Ticket → goals*). Flag a ticket criterion no goal covers, or a goal the ticket's scope excludes.
- **`ticket.md` ↔ CONTEXT.md** (when a ticket exists) — Is CONTEXT's Problem Statement a citation to `./ticket.md` rather than a restated, now-divergent copy of the ask? Flag a Problem Statement that re-proses the ticket and has drifted; the fix is to collapse it to a citation (`./references/workflow/one-home.md` § *One home per fact*).
- **CONTEXT.md ↔ `goals.md`** — Does any goal describe behavior CONTEXT's "Not Doing" list excludes, or behavior outside CONTEXT's MVP scope? Do the goals contradict CONTEXT's Recommended Direction or Key Assumptions?
- **CONTEXT.md ↔ `plan.md`** — Does the plan's Scope (in / out / boundaries) contradict CONTEXT's MVP scope or "Not Doing"? Does the plan reference assumptions CONTEXT marked still-to-validate as if they were settled? Also flag **restated grounding**: the same decision, finding, or question maintained in both files — an Approach re-prosing Recommended Direction, Exploration Findings repeating References anchors, a copied Open Questions list. The bar is duplicated *content*, verbatim or re-prosed — a section that cites the home and adds only its own refinements, mechanism, or re-verification notes is the correct form, not restatement. Two copies of one fact drift apart as soon as either is edited (`./references/workflow/one-home.md` § *One home per fact*); the suggested edit is to keep the copy in the fact's home file and collapse the restated content to a citation — preserving any plan-time deltas interleaved with it, which stay in the plan. Under `review-task-reconcile` the fix follows that pipeline's mapping in the shared contract — a judgment item, never auto-applied.
- **`goals.md` ↔ `plan.md`** — Confirm the plan's `Scope` partition is **total**: every goal ID in `goals.md` is either delivered or explicitly deferred — read `task-state.ts`'s `scopePartition.missingFromPartition` and `inBoth` (the Step 5 run's output already carries them). A goal the Scope neither delivers nor defers is the drift. (This replaces the old "criterion excluded by scope" hunt — with scope expressed as a goal-ID partition, that contradiction can't be silently authored; coverage already catches uncovered goals and orphan steps.)
- **`diagram.md` ↔ reality** (only if a diagram exists) — Do the components, boundaries, and flows the diagram draws still match what's actually there? This pair is unlike its siblings: it compares a task file against the codebase rather than against another task file, so it's more expensive and more fallible. Scope it to what the diagram **names** — check each node and edge, not the surrounding architecture — and tag findings `warn`, never `block`: a stale drawing misleads a reader but breaks nothing, and the fix is `implement-task`'s gate re-check, not a review edit. Also flag the inverse shape: a diagram that merely restates the plan's `Touches:` surfaces is a derived duplicate rather than a diagram (`./references/workflow/task-diagram.md`). A missing `diagram.md` is not checked and not reported.
- **`plan.md` ↔ `result.md`** (only if `result.md` exists) — Does the result claim a step done while the plan's checkbox is still `- [ ]`? Does the result reference a step number the plan doesn't have (a sign of a stale rename)? Does the **companion-result-file rule** in `./references/workflow/task-lifecycle.md` hold — plan `blocked` requires a `**Blocked:**` section, plan `in-review` an `**In review:**` section, plan `done` an `## Acceptance` section and a closing `**Completed:**` line, while a `skipped` plan may have no result at all?
- **Status field consistency** — Does CONTEXT carry a valid origin marker and the plan a valid lifecycle state, and does the companion result file carry what that state owes? An **absent** result file is part of this check, not an exemption from it: absence pairs only with a plan in `to-do` or `skipped`. Reject anything outside the vocabulary registered in `./references/workflow/task-lifecycle.md`.

If `result.md` is absent, the `plan.md` ↔ `result.md` comparisons have nothing to compare — skip that pair. The Status-field check above still runs: absence is expected only for a plan in `to-do` or `skipped`, so a plan in `executing`, `blocked`, `in-review`, or `done` with no result file is drift — an interrupted `implement-task` initialization (`./references/workflow/task-lifecycle.md`).

### 7. Identify Gaps

Look for what the plan doesn't say but executing it will need:

- **Missing edge cases** — Boundaries and failure modes the plan doesn't address (empty, zero, max, concurrent, the unhappy path)
- **Missing transitions** — How the actor gets into and out of the new flow
- **Missing inputs** — Where required information or resources come from, and whether they're actually available
- **Step ordering & timing** — Are dependencies between steps correct? Is anything required out of order? For steps carrying `Due` / `Lead time`, is the schedule feasible — does each step's lead time fit before its own (or a dependent step's) due date, and do long-lead items start early enough?
- **Declared surfaces** — For steps carrying `Touches:`, does each declared surface cover what the step will actually edit, and are surfaces claimed disjoint genuinely disjoint? When the domain is code, check them against the shared-artifact traps in `./references/engineering/planning.md` ("Declaring edit surfaces")
- **Checkpoint placement** — Does the plan follow the checkpoint cadence the planning spine requires (`plan-task` § *Add Checkpoints* — the single home for when checkpoints are due and when short plans skip them), and does each checkpoint name a concrete end-to-end outcome (e.g. "user can log in and see dashboard"), not a vague "core flow works"? An authored assertion that merely restates the health recipe — the suite, typecheck, lint, or build — belongs at the adjacent health boundary instead (`./references/engineering/planning.md` § *Checkpoints*). Flag missing, misplaced, vague, or health-shaped checkpoint assertions.
- **Domain constraints** — Rules, limits, or timing the work must respect

When the domain is code, also check the engineering-specific gaps in `./references/engineering/planning.md` ("Common gaps to check in a code plan": UI states, navigation, data fetching/caching/invalidation, analytics, new-pattern acknowledgement).

### 8. Check Pattern Consistency

Compare the plan's implied approach against the established patterns of the project or effort: does it match how similar work is structured, follow the same conventions, and respect the boundaries the effort enforces? Would it require something new (a dependency, a pattern, a one-off exception), and is that justified? When the domain is code, follow `./references/engineering/exploration.md`'s pattern-consistency checks (structure, data-flow patterns, naming, dependencies, module boundaries).

### 9. Research the Questions

Collect every candidate question the assessment has accumulated — Step 3's needs-clarification verdicts and its vague or untestable `Verify` criteria, Step 4's lifted goal-quality findings, Step 5's `_(unresolved: ...)_` goals, uncovered goals, orphan steps, and stale goal citations (its `unknownGoalCitations`), Step 6's drift questions, Step 7's gaps. Dedupe as you collect — Steps 4 and 5 both lift an `_(unresolved: ...)_` goal, and one goal is one candidate. No candidates → skip this step and render no outcome line.

**Launch as soon as Step 7 closes.** Every source above is complete there, so the fan-out runs while Step 8 does — the answers are collected where they were, at the Questions section, and the batching below still sees the whole candidate set at once.

When candidates exist, launch one read-only probe per question on the native engine (`./references/workflow/probe-engines.md`) per the shape in `./references/workflow/probe-shape-options-research.md`, under the contract in `./references/workflow/agent-fanout.md` — all of them in parallel, collected before the Questions section renders; trivially related questions batch into one probe per the shape. Merge per that contract: a probe's answer is a candidate, never a verdict. Re-check every classification before adopting it — an ANSWERED citation must settle the question, every OPTIONS citation and trade-off must hold, and a NO-EVIDENCE result requires repeating the named source-and-location search far enough to support the absence. A classification the re-check rejects is not adopted at all: that question falls to the inline research below, and it counts under whichever bucket that research lands it in. After the re-check passes, ANSWERED moves the question into the output's **Answered by research** list, and the originating section's verdict changes only through that same re-check, never on probe authority. An answer clears its originating finding only when the re-check disproves that finding; when it merely supplies content a still-defective plan or goal needs, the finding remains in its originating section and cites the answered entry as its proposed repair evidence. OPTIONS attach to the surviving question: 2–3 grounded options, one-line trade-offs, a recommendation. NO-EVIDENCE marks it a genuine preference question; never fabricate options for it. A candidate that arose outside the Questions section — a Step 3 needs-clarification verdict or vague `Verify` criterion, a Step 6 drift ask, a Step 7 gap — is **promoted** into the numbered Questions list once it survives research, its originating section keeping its own finding and citing the question number; that promoted entry is where its options render and what the counts below cover.

A question whose probe never ran — no engine available — or whose probe died is researched inline instead: the research still happens, only the fan-out degrades. It counts as researched and joins the outcome line's skipped segment. A question whose classification the re-check above rejected is also researched inline, but its probe did run, so it joins the rejected-classification segment instead; both segments' grammar is the shape's. A candidate raised after the fan-out launched — Step 8's pattern-justification questions among them — takes that same inline research and the skipped segment, its reason being that it arrived after the launch. The assessment never blocks on a probe.

## Output Structure

### Plan Summary

Restate the plan's goal and step list in your own words. This confirms mutual understanding and surfaces any misreadings early. The grounding probe's `Cross-check:` line closes this section when `-x` was passed, on the terms `./references/workflow/probe-cross-check.md` fixes for it. <!-- cold -->

### Feasibility Assessment

For each step:

- The step (number and title)
- The verdict (feasible / feasible with caveats / needs clarification / conflicts / infeasible)
- Evidence — point to the specific artifact, fact, or constraint that supports the verdict
- If caveats or conflicts: what specifically needs to change in the step
- Verify-criterion check: is it concrete and testable?

### Goal Quality

A short list giving each goal a quality verdict (`good` / `weak` / `vague-or-untestable` / `unresolved`) with the failing dimension where one applies. Always render this section — when every goal is `good`, say so explicitly (absence is a regression, not silence).

Example:

```
- G1 — good
- G2 — weak (singular: bundles "user can export" with "and the file downloads"; consider splitting)
- G3 — vague-or-untestable (specific: "fast enough" has no yardstick; suggest "p95 < 2s in staging")
- G4 — unresolved (lifted from goals.md — see Questions)
```

If `goals.md` is missing entirely, state that here and skip; the missing goals file is the highest-priority finding overall.

### Acceptance Coverage

A short list mapping each goal ID in `goals.md` to the step(s) whose `**Goal:**` line cites it. Tag each goal `covered` / `partially covered` / `uncovered` / `out of scope (deferred)`. Then list any orphan steps (non-infra steps citing no goal).

Example:

```
- G1 — covered by Step 2, Step 4 (both cite `**Goal:** G1`)
- G2 — partially covered by Step 3 (cites G2 but misses the empty-state behavior)
- G3 — uncovered (no step's `**Goal:**` line cites G3)
- Step 5 — orphan (cites no goal, not marked `none (infra/refactor)`) — likely scope creep or a missing goal
```

If `goals.md` is missing entirely, state that here and skip the per-goal mapping; treat the missing goals file as the highest-priority gap.

### Cross-File Drift

A short list of contradictions between artifacts, grouped by the file pair the contradiction lives in. Render the section header even when no drift is found — state "no drift detected" explicitly so the absence is informative rather than ambiguous. Skip the `plan ↔ result` pair if no result file exists yet; the Status-fields entry still renders (an absent result is itself checked against the plan's state).

Example:

```
- ticket ↔ goals — drift: ticket criterion "user can cancel a pending export" maps to no goal; add a delivering goal or drop the criterion.
- CONTEXT ↔ goals — drift: goal G4 ("user can export archived rows") describes behavior CONTEXT's "Not Doing" excludes. Resolve by either lifting the exclusion or dropping the goal.
- CONTEXT ↔ plan — no contradictions detected; restated grounding: the plan's Open Questions copies CONTEXT's resolved-questions list near-verbatim. Keep CONTEXT as the home; collapse the plan section to a citation plus its own plan-time questions.
- goals ↔ plan — drift: `goals.md` lists G5 but the plan's Scope partition names it in neither the delivered nor deferred set — the partition is incomplete. Either deliver G5, defer it, or drop the goal.
- plan ↔ result — drift: result file records Step 3 as shipped but the plan still shows `- [ ]`. Likely an interrupted `implement-task` run.
- Status fields — plan is `executing` but no `result.md` exists (companion-file rule violated, per `./references/workflow/task-lifecycle.md`).
```

### Gaps

Missing details that the plan needs to address before implementation, grouped by category.

### Questions

When Step 9's research answered any candidate, open with an **Answered by research** list — each entry finding-shaped: the question, the verified answer, its evidence locator. An originating finding that the answer did not eliminate cites this entry from its own section, so the answer remains attached to the repair it informs.

Then the numbered list of open questions. Each question should:

- Reference the specific part of the plan it relates to
- Explain why the answer matters (what implementation decision depends on it)
- Carry its researched options — 2–3 grounded options with one-line trade-offs and a recommendation (not open-ended "what should I do?" but "should it be A or B? A matches the existing pattern, B gives more flexibility") — or the explicit marker that nothing the plan leans on bears on it (genuine preference)

Close the section with the `Question research:` outcome line per `./references/workflow/probe-shape-options-research.md`, whenever candidate questions existed; it is absent only when the review surfaced no candidates at all.

### Confirmed

Aspects of the plan that are verified and ready to execute — so the user knows what doesn't need further discussion.

## Don't Rationalize

- "The plan looks reasonable" — Check every integration point in the code. Reasonable isn't verified.
- "This can probably be reused" — Inspect the actual thing. Names don't guarantee reusability.
- "I'll note the gaps during implementation" — Surface them now. That's the entire point of review.
- "Everything looks good" — Rubber-stamping isn't review. Every integration point needs code-level verification.
- "That's a theoretical concern" — Only flag real issues, but don't dismiss concerns without checking the code.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Plan, `goals.md`, and `CONTEXT.md` read in full (plus `ticket.md` and `result.md` when present); a missing goals file reported as the highest-priority finding
- [ ] Every integration point verified against the actual artifacts; every step given a verdict with evidence and a concreteness check on its `Verify` criterion
- [ ] Goals audited per `./references/workflow/acceptance-criteria.md`, and coverage mapped from `task-state.ts`'s `goalCoverage` — uncovered goals, orphan steps, an incomplete `## Scope` partition, and `_(unresolved: ...)_` goals lifted into Questions
- [ ] Cross-file drift checked pairwise, including the `ticket.md` pairs when a ticket exists and the companion-result-file rule per `./references/workflow/task-lifecycle.md`; Goal Quality, Acceptance Coverage, and Cross-File Drift sections rendered even when clean
- [ ] Review only — nothing written; no implementation, no redesign; steps needing rethinking routed to `plan-task`
- [ ] Every candidate question researched — answered with session-verified evidence, optioned with a recommendation, or marked a genuine preference question — and, when the review surfaced any, the Questions section closed with its `Question research:` line
- [ ] (`-x`) Probe merged before verdicts and the Plan Summary carries its `Cross-check:` line

---
name: review-plan
description: Use when asked to review, validate, or sanity-check a plan — confirms the implementation direction is right and still in sync with CONTEXT.md, the spec, and the current codebase, and surfaces any drift between what the plan assumes and what the code actually shows.
argument-hint: '[plan file path]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core agents-kit rules applied

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill validates an implementation plan against the actual codebase before execution begins. It catches infeasible steps, missing details, pattern conflicts, and implicit assumptions — producing a clear assessment with targeted questions.

The user provides a plan — typically the output of `plan-task`, written to `.agents/tasks/<slug>/<task-slug>.plan.md`. Your job is to determine whether the plan can be executed as written within the current codebase, and surface anything that needs resolution first.

**CRITICAL**: Do not implement. Do not redesign the solution. Validate the plan. The output is a feasibility assessment with questions, not a revised plan or code.

## References

Before working, read any applicable checklists from `references/engineering/`. Skip ones that don't apply.

## Locate the Plan

If the user gives an explicit path, use it. Otherwise resolve in two levels:

- Task directory: `.agents/tasks/<slug>/` at the project root. If the user gave only a slug, descend into it.
- Plan file inside the directory: pick from `*.plan.md` (skip `*.spec.md` and `*.result.md` — those are inputs and execution records).
- If multiple task directories or multiple plans exist, list candidates and ask which one to review.

Read the plan, the sibling `<task-slug>.spec.md`, **and** the sibling `CONTEXT.md` in full before assessing anything.

- **`CONTEXT.md`** carries the shared problem statement, scope summary, key assumptions, and external references that apply to every plan in the directory.
- **`<task-slug>.spec.md`** carries the acceptance criteria — the testable contract for what "done" means for this plan. The plan's steps must collectively cover every criterion.

Both are authoritative input for grounding, not optional. If the spec file is missing, flag it as a gap up front — `plan-task` is expected to produce one and the acceptance coverage check below cannot run without it.

## When to Review

**Use when:**

- A plan was just written by `plan-task` and the user wants a sanity check before implementation
- The plan references existing code, patterns, or APIs that need to be confirmed
- The plan touches multiple modules, shared code, or introduces new patterns
- The user wants a second pass before handing off to `implement-plan`

**Skip when:**

- The plan is trivial enough that review takes longer than execution
- The user has already validated the plan themselves and wants to move to implementation
- The task is a small bug fix with a clear root cause

## Review Process

### 1. Parse the Plan

Extract the concrete claims and steps:

- **Goal** — What the plan is trying to accomplish
- **Steps** — Each ordered step's "What", "Verify", and "Depends on"
- **Checkpoints** — Any `### Checkpoint after Step N` blocks: where they're placed, what assertions they list (test suite, build, named end-to-end flow)
- **Scope** — What's in / out of scope and why
- **Integration points** — What existing code, components, APIs, or patterns the plan references or depends on
- **Implicit assumptions** — What the plan takes for granted without stating (available APIs, existing components, data availability)

Restate the plan's intent in your own words to confirm understanding. If steps are ambiguous, note the ambiguity — don't silently pick an interpretation.

### 2. Ground in the Codebase

**CRITICAL**: Read the code each step touches. Every claim about existing behavior must be verified against the actual source. This is an independent pass — do not assume `plan-task`'s exploration was correct.

For each integration point or referenced component:

- **Verify it exists** — File, function, component, hook, API, type. Grep for it.
- **Verify it does what the plan assumes** — Read the implementation, not just the name. A component called `ValidatorList` might be tightly coupled to a specific context.
- **Check reusability** — If the plan says "reuse X," confirm X can actually be reused. Look for hard-coded dependencies, context coupling, or internal-only exports.
- **Map the blast radius** — What existing code will be affected by the proposed changes?

For referenced external APIs or libraries:

- **Verify the API surface** — Check installed package versions and actual exports. Don't assume an API exists based on naming conventions.
- **Check the message/transaction format** — For protocol-level features, verify the exact message types and fields.

### 3. Assess Each Step

For every step, assign one of:

- **Feasible** — Can be executed as planned with existing patterns and infrastructure
- **Feasible with caveats** — Can be done, but the step is missing details or underspecifies behavior in certain cases
- **Needs clarification** — Ambiguous or underspecified — multiple interpretations exist and the choice affects implementation
- **Conflicts with codebase** — Contradicts existing patterns, conventions, or architectural constraints
- **Infeasible as stated** — Cannot be executed as described — the referenced API doesn't exist, the component can't be reused as assumed, etc.

Also assess each step's **Verify** criterion: is it concrete enough to actually confirm the step worked? Flag verify criteria that are vague ("ensure it works") or untestable.

### 4. Audit Spec Quality

Before mapping criteria to steps, assess the criteria themselves. Coverage is meaningless if the criteria are vague — a perfectly-covered plan can still ship the wrong thing because "the export works well" maps cleanly to a step that builds the wrong export.

Apply `references/engineering/acceptance-criteria.md` to every bullet in `<task-slug>.spec.md`. Tag each criterion with one of:

- **good** — passes every check (testable, specific, outcome-oriented, singular, bounded, stated as behavior)
- **weak** — passes overall but loses points on one dimension; note which (treated as feedback, not a blocker)
- **vague-or-untestable** — fails one or more checks; the criterion must be revised (or marked `_(unresolved: ...)_`) before execution
- **unresolved** — already marked `_(unresolved: ...)_` in the spec; record it here and lift it into Questions

Surface every `weak`, `vague-or-untestable`, and `unresolved` finding into the Questions section. For each, name the **specific failing dimension** ("not testable — no observable behavior named") and suggest a rewrite where you can ("'export is fast enough' → 'p95 export latency under 2s for the largest staging tenant'"). Don't paraphrase the failing dimension — point at the checklist line that didn't pass.

If the spec is missing entirely, skip this step and treat the missing spec as the highest-priority finding in the coverage section below.

### 5. Check Acceptance Coverage

For each acceptance criterion in `<task-slug>.spec.md`, identify which step(s) deliver it. The mapping must be explicit — if you can't point at a step (or set of steps) that produces the criterion's observable outcome, that criterion is **uncovered**.

Tag each criterion with one of:

- **Covered** — A specific step or set of steps clearly delivers the criterion. Name them.
- **Partially covered** — Some steps contribute but a piece of the criterion is missing. Name what's missing.
- **Uncovered** — No step delivers this criterion. The plan must add a step (or revise an existing one) before execution.
- **Out of scope** — The criterion is in the spec but the plan explicitly excludes it in `Scope: Out of scope`. Flag the inconsistency for the user — either the spec or the scope is wrong.

Also flag the inverse — **plan steps with no matching criterion**. Steps that don't contribute to any acceptance criterion are either scope creep, infrastructure not the spec captured, or a sign the spec is incomplete. Surface them; don't silently accept them.

Note any criterion marked `_(unresolved: ...)_` from the spec — these are deferred clarifying questions and should be lifted into the Questions section of this review's output.

### 6. Identify Gaps

Look for what the plan doesn't say but the implementation will need:

- **Missing states** — Loading, error, empty, disabled states not mentioned
- **Missing validation** — Edge cases the plan doesn't address (zero values, max values, concurrent operations)
- **Missing navigation** — How the user gets to and from the new flow
- **Missing data** — Where data comes from, how it's fetched, cached, invalidated
- **Missing analytics** — If the project tracks events, new user actions likely need tracking
- **Missing patterns** — If the work needs a new pattern (new route, new context, new hook), the plan should acknowledge it
- **Step ordering** — Are dependencies between steps correct? Is anything required out of order?
- **Checkpoint placement** — For plans with more than ~5 steps, are checkpoints present every 2–3 steps? Does each checkpoint name a concrete end-to-end flow (e.g. "user can log in and see dashboard"), not a vague "core flow works"? Flag missing, misplaced, or vague checkpoints.
- **Platform constraints** — Domain rules, protocol limitations, timing constraints that affect the work

### 7. Check Pattern Consistency

Compare the plan's implied implementation against the project's established patterns:

- Does the proposed code structure match how similar features are built?
- Does the data flow follow the same hooks/context/query patterns?
- Are naming conventions consistent (routes, components, events)?
- Would the implementation require new dependencies, and are they justified?
- Does the plan respect module boundaries (if the project enforces them)?

## Output Structure

### Plan Summary

Restate the plan's goal and step list in your own words. This confirms mutual understanding and surfaces any misreadings early.

### Feasibility Assessment

For each step:

- The step (number and title)
- The verdict (feasible / feasible with caveats / needs clarification / conflicts / infeasible)
- Evidence — point to the specific code, API, or constraint that supports the verdict
- If caveats or conflicts: what specifically needs to change in the step
- Verify-criterion check: is it concrete and testable?

### Spec Quality

A short list giving each criterion a quality verdict (`good` / `weak` / `vague-or-untestable` / `unresolved`) with the failing dimension where one applies. Always render this section — when every criterion is `good`, say so explicitly (absence is a regression, not silence).

Example:

```
- Criterion 1 — good
- Criterion 2 — weak (singular: bundles "user can export" with "and the file downloads"; consider splitting)
- Criterion 3 — vague-or-untestable (specific: "fast enough" has no yardstick; suggest "p95 < 2s in staging")
- Criterion 4 — unresolved (lifted from spec — see Questions)
```

If `<task-slug>.spec.md` is missing entirely, state that here and skip; the missing spec is the highest-priority finding overall.

### Acceptance Coverage

A short list mapping each acceptance criterion in the spec to the step(s) that deliver it. Tag each criterion `covered` / `partially covered` / `uncovered` / `out of scope`. Then list any plan steps that don't map to any criterion.

Example:

```
- Criterion 1 — covered by Step 2, Step 4
- Criterion 2 — partially covered by Step 3 (missing the empty-state behavior)
- Criterion 3 — uncovered (no step produces the export endpoint)
- Step 5 — no matching criterion (likely scope creep or spec gap)
```

If `<task-slug>.spec.md` is missing entirely, state that here and skip the per-criterion mapping; treat the missing spec as the highest-priority gap.

### Gaps

Missing details that the plan needs to address before implementation, grouped by category.

### Questions

Numbered list of targeted questions. Each question should:

- Reference the specific part of the plan it relates to
- Explain why the answer matters (what implementation decision depends on it)
- Suggest options when possible (not open-ended "what should I do?" but "should it be A or B? A matches the existing pattern, B gives more flexibility")

### Confirmed

Aspects of the plan that are verified and ready to execute — so the user knows what doesn't need further discussion.

## Don't Rationalize

- "The plan looks reasonable" — Check every integration point in the code. Reasonable isn't verified.
- "This component can probably be reused" — Read the implementation. Names don't guarantee reusability.
- "I'll note the gaps during implementation" — Surface them now. That's the entire point of review.
- "Everything looks good" — Rubber-stamping isn't review. Every integration point needs code-level verification.
- "That's a theoretical concern" — Only flag real issues, but don't dismiss concerns without checking the code.
- "The criteria look fine to me" — Run them through `references/engineering/acceptance-criteria.md`. Without an explicit pass, this skill rubber-stamps vague criteria, the structural coverage check gives false confidence, and the failure surfaces inside the acceptance gate where it's most expensive.

## Verification

- [ ] `CONTEXT.md` and `<task-slug>.spec.md` read in full alongside the plan; missing spec flagged as a gap
- [ ] Every integration point verified against actual source code
- [ ] Each step has a clear verdict with evidence
- [ ] Each step's verify criterion assessed for concreteness
- [ ] Each criterion in the spec assessed against `references/engineering/acceptance-criteria.md`; `weak` / `vague-or-untestable` / `unresolved` findings appear in Questions with the specific failing dimension (and a suggested rewrite where possible)
- [ ] acceptance coverage section maps every spec criterion to a step (or marks it `uncovered` / `out of scope`); plan steps with no matching criterion also flagged
- [ ] Deferred criterion clarifications (`_(unresolved: ...)_` in the spec) lifted into Questions
- [ ] Checkpoints (if plan >5 steps) assessed for placement and concrete end-to-end assertion
- [ ] Questions are targeted and explain why the answer matters
- [ ] Gaps grouped by category with specific details
- [ ] No redesign or implementation proposed — review only

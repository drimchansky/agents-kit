---
name: review-plan
description: Use when asked to review or validate a plan against the codebase before implementation begins.
argument-hint: '[plan file path]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line verbatim to the user as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core rules applied (./AGENTS.md)

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill validates an implementation plan against the actual codebase before execution begins. It catches infeasible steps, missing details, pattern conflicts, and implicit assumptions — producing a clear assessment with targeted questions.

The user provides a plan — typically the output of `design-plan`, written to `.agents/plans/<slug>.md`. Your job is to determine whether the plan can be executed as written within the current codebase, and surface anything that needs resolution first.

**CRITICAL**: Do not implement. Do not redesign the solution. Validate the plan. The output is a feasibility assessment with questions, not a revised plan or code.

## References

Before working, read any applicable checklists from `references/engineering/`. Skip ones that don't apply.

## Locate the Plan

If the user gives an explicit path, use it. Otherwise:

- Default location is `.agents/plans/<slug>.md` at the project root
- If multiple plans exist, list them and ask which one to review
- Skip files ending in `.result.md` — those are execution records, not plans

Read the plan in full before assessing anything.

## When to Review

**Use when:**

- A plan was just written by `design-plan` and the user wants a sanity check before implementation
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

**CRITICAL**: Read the code each step touches. Every claim about existing behavior must be verified against the actual source. This is an independent pass — do not assume `design-plan`'s exploration was correct.

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

### 4. Identify Gaps

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

### 5. Check Pattern Consistency

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

## Verification

- [ ] Every integration point verified against actual source code
- [ ] Each step has a clear verdict with evidence
- [ ] Each step's verify criterion assessed for concreteness
- [ ] Checkpoints (if plan >5 steps) assessed for placement and concrete end-to-end assertion
- [ ] Questions are targeted and explain why the answer matters
- [ ] Gaps grouped by category with specific details
- [ ] No redesign or implementation proposed — review only

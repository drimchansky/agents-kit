---
name: validate-spec
description: Validates a feature specification against the current codebase — checks feasibility, surfaces conflicts, and identifies missing details before implementation begins. Use when asked to review a spec or requirements against existing code.
argument-hint: '[spec file path]'
---

This skill validates a feature specification against the actual codebase before implementation begins. It catches infeasible requirements, missing details, pattern conflicts, and implicit assumptions — producing a clear assessment with targeted questions.

The user provides a specification — acceptance criteria, feature requirements, a PRD, or an informal description of what they want built. Your job is to determine whether it can be built as described within the current codebase, and surface anything that needs resolution first.

**CRITICAL**: Do not implement. Do not design the solution. Validate the specification. The output is a feasibility assessment with questions, not a plan or code.

## When to Validate

**Use when:**

- The user provides acceptance criteria or a feature spec and asks for review
- Requirements reference existing code, patterns, or APIs that need to be confirmed
- The feature touches multiple modules or introduces new patterns
- The spec makes assumptions about the codebase that may not hold

**Skip when:**

- The task is a simple bug fix with a clear description
- The user has already validated the spec themselves and wants to move to implementation
- The change is trivial enough that validation would take longer than implementation

## Validation Process

### 1. Parse the Specification

Extract the concrete claims and requirements:

- **Functional requirements** — What the feature must do (user actions, system behavior, data flow)
- **Integration points** — What existing code, components, APIs, or patterns the spec references or depends on
- **Constraints** — Explicit rules (validation, ordering, placement, naming)
- **Implicit assumptions** — What the spec takes for granted without stating (available APIs, existing components, data availability)

Restate these in your own words to confirm understanding. If the spec is ambiguous, note the ambiguity — don't silently pick an interpretation.

### 2. Ground in the Codebase

**CRITICAL**: Read the code the spec touches. Every claim about existing behavior must be verified against the actual source.

For each integration point or referenced component:

- **Verify it exists** — File, function, component, hook, API, type. Grep for it.
- **Verify it does what the spec assumes** — Read the implementation, not just the name. A component called `ValidatorList` might be tightly coupled to a specific context.
- **Check reusability** — If the spec says "reuse X," confirm X can actually be reused. Look for hard-coded dependencies, context coupling, or internal-only exports.
- **Map the blast radius** — What existing code will be affected by the proposed changes?

For referenced external APIs or libraries:

- **Verify the API surface** — Check installed package versions and actual exports. Don't assume an API exists based on naming conventions.
- **Check the message/transaction format** — For blockchain or protocol-level features, verify the exact message types and fields.

### 3. Assess Each Requirement

For every acceptance criterion or requirement, assign one of:

- **Feasible** — Can be built as specified with existing patterns and infrastructure
- **Feasible with caveats** — Can be built, but the spec is missing details or underspecifies behavior in certain cases
- **Needs clarification** — Ambiguous or underspecified — multiple interpretations exist and the choice affects implementation
- **Conflicts with codebase** — Contradicts existing patterns, conventions, or architectural constraints
- **Infeasible as stated** — Cannot be built as described — the referenced API doesn't exist, the component can't be reused as assumed, etc.

### 4. Identify Gaps

Look for what the spec doesn't say but the implementation will need:

- **Missing states** — Loading, error, empty, disabled states not mentioned
- **Missing validation** — Edge cases the spec doesn't address (zero values, max values, concurrent operations)
- **Missing navigation** — How the user gets to and from the new flow
- **Missing data** — Where data comes from, how it's fetched, cached, invalidated
- **Missing analytics** — If the project tracks events, new user actions likely need tracking
- **Missing patterns** — If the feature needs a new pattern (new route, new context, new hook), the spec should acknowledge it
- **Platform constraints** — Chain-level rules, protocol limitations, timing constraints that affect the feature

### 5. Check Pattern Consistency

Compare the spec's implied implementation against the project's established patterns:

- Does the proposed UI structure match how similar features are built?
- Does the data flow follow the same hooks/context/query patterns?
- Are naming conventions consistent (routes, components, events)?
- Would the implementation require new dependencies, and are they justified?
- Does the spec respect module boundaries (if the project enforces them)?

## Output Structure

### Specification Summary

Restate the spec's core requirements in your own words. This confirms mutual understanding and surfaces any misreadings early.

### Feasibility Assessment

For each requirement or acceptance criterion:

- The requirement (quoted or paraphrased)
- The verdict (feasible / feasible with caveats / needs clarification / conflicts / infeasible)
- Evidence — point to the specific code, API, or constraint that supports the verdict
- If caveats or conflicts: what specifically needs to change in the spec

### Gaps

Missing details that the spec needs to address before implementation, grouped by category.

### Questions

Numbered list of targeted questions. Each question should:

- Reference the specific part of the spec it relates to
- Explain why the answer matters (what implementation decision depends on it)
- Suggest options when possible (not open-ended "what should I do?" but "should it be A or B? A matches the existing pattern, B gives more flexibility")

### Confirmed

Aspects of the spec that are verified and ready to build — so the user knows what doesn't need further discussion.

## Don't Rationalize

- "The spec looks reasonable" — Check every integration point in the code. Reasonable isn't verified.
- "This component can probably be reused" — Read the implementation. Names don't guarantee reusability.
- "I'll note the gaps during implementation" — Surface them now. That's the entire point of validation.
- "Everything looks good" — Rubber-stamping isn't validation. Every integration point needs code-level verification.
- "That's a theoretical concern" — Only flag real issues, but don't dismiss concerns without checking the code.

## Verification

- [ ] Every integration point verified against actual source code
- [ ] Each requirement has a clear verdict with evidence
- [ ] Questions are targeted and explain why the answer matters
- [ ] Gaps grouped by category with specific details
- [ ] No design or implementation proposed — validation only

## Handoff

If the spec passes validation and the user wants to proceed to design or implementation:

- Summarize: confirmed requirements, resolved questions, remaining caveats, and any constraints discovered during codebase exploration
- This summary serves as the starting input for the `design` skill — don't repeat exploration that was already done during validation
- If critical questions remain unresolved, recommend addressing them before moving to design

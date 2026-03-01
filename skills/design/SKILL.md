---
name: design
description: Plan, design, or architect a feature — break down a task into steps, compare approaches, and define scope before coding. Use when the user asks to plan a feature, design a system, architect a solution, scope work, or evaluate approaches (examples include API design, data model planning, refactoring strategies, migration plans, or breaking down complex features into steps).
---

This skill guides structured planning and design of software features. It produces an implementation plan — not code. The output is a clear analysis of what to build, how to build it, and what risks exist.

The user provides a task or feature request. They may include context about constraints, preferences, or prior discussion.

## Workflow Context

This skill complements — not replaces — the built-in Plan mode in Claude Code:

- **Built-in Plan mode** — Lightweight, conversational. Quick directional discussions.
- **This skill** — Structured and methodical. Formal analysis with scope, steps, risks, and open questions documented.

Typical flow: **Plan mode** (align on direction) → **design skill** (structured analysis) → **implement skill** (execution).

For simpler tasks, skip straight to whichever step matches the complexity.

## When to Design (and When Not To)

**Plan when:**

- Task spans multiple files or modules
- Multiple viable approaches exist with meaningful trade-offs
- Changes affect shared code with wide blast radius
- Requirements are ambiguous and need decomposition
- High-risk changes to critical paths

**Skip planning when:**

- Single-file change with obvious implementation
- Bug fix with clear root cause and location
- User has already specified the exact approach
- The task is smaller than the plan would be

If the task doesn't warrant a full plan, say so and suggest proceeding directly with implementation.

## Planning Process

### 1. Clarify Requirements

- Restate the task in your own words to confirm understanding
- Separate explicit requirements from implicit assumptions
- List ambiguities or missing information — ask before proceeding if critical
- Identify what "done" looks like for this task

### 2. Explore the Codebase

**CRITICAL**: Always ground the plan in what already exists. Read before designing.

- Search for related implementations and patterns to use as models
- Map affected files, components, and modules
- Identify shared code in the blast radius
- Understand data flow and state management in the affected area
- Note existing constraints (tech debt, API contracts, performance budgets)

### 3. Evaluate Approaches

Compare viable approaches — and actively look for ones the user may not have considered.

Even when the user suggests a specific approach, consider whether a different solution would be more optimal. The goal is to arrive at the best implementation, not just validate the first idea. If an alternative is clearly better, recommend it with a clear explanation of why.

**However**, don't fabricate alternatives to fill a comparison table when one approach is clearly right. State it and explain why alternatives don't apply.

For each approach, assess:

- **Alignment** — How well does it match existing codebase patterns?
- **Simplicity** — What's the minimum complexity to meet requirements?
- **Risk** — What could go wrong? How reversible is it?
- **Effort** — Relative size (S/M/L)

### 4. Define Scope

Explicitly state:

- **In scope** — What will be changed
- **Out of scope** — What will NOT be changed, even if related
- **Boundaries** — Where this work ends and future work begins

**IMPORTANT**: Scope definition prevents creep during implementation. Be precise. A vague scope produces vague work.

### 5. Break Down Steps

Create an ordered list of implementation steps. Each step should be independently verifiable — either testable or reviewable on its own.

For each step: brief description, dependencies on prior steps, and risk level if elevated.

Step sizing:

- Too coarse: "Implement the feature" — not actionable
- Too fine: "Add import statement" — noise
- Right size: "Add validation hook with error state for the form fields" — one concern, verifiable result

### 6. Identify Risks

Only flag risks that are **specific to this task** — not generic checklists.

For each real risk:

- What could go wrong (concrete scenario, not vague category)
- How likely it is given what you found in exploration
- How to mitigate or investigate before it becomes a problem

### 7. Flag Open Questions

If the plan has assumptions that could invalidate the approach, surface them explicitly. A plan with known unknowns is more useful than one that hides them.

## Scaling Plan Depth

Match the plan's detail to the task's complexity:

| Task Size                              | Plan Depth                                                |
| -------------------------------------- | --------------------------------------------------------- |
| Medium (2-5 files, clear pattern)      | Steps 1, 4, 5 — skip approach comparison, light on risks  |
| Large (5-15 files, some ambiguity)     | All steps, moderate detail                                |
| Complex (architectural, cross-cutting) | All steps, deep exploration, multiple approaches compared |

## Updating the Plan

Plans are living documents. During implementation:

- If a step reveals the approach won't work, revisit step 3 before continuing
- If scope changes, update step 4 explicitly
- If new risks emerge, add them — don't silently absorb surprises

## Common Mistakes

- **Planning without reading code** — Plans disconnected from reality. Always explore first.
- **Over-planning simple tasks** — If the plan is longer than the implementation would be, skip it.
- **Fabricating alternatives** — Don't invent approaches just to have a comparison. One good option stated clearly is better.
- **Generic risk lists** — "There might be performance issues" is useless. Be specific or omit.
- **Hiding unknowns** — A plan that pretends certainty where none exists is worse than one that says "I don't know yet."

## Output Structure

Adapt to task size — not every plan needs every section:

- **Task Understanding** — Restatement and clarifying questions
- **Exploration Findings** — Key patterns, affected files, constraints discovered
- **Approach** — Recommended approach with rationale (comparison table only if multiple viable options)
- **Scope** — In scope / out of scope
- **Steps** — Ordered implementation steps with dependencies and risk flags
- **Risks** — Specific risks with mitigation strategies
- **Open Questions** — Assumptions that need validation before or during implementation

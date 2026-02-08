---
name: design
description: Plan, design, or architect a feature — break down a task into steps, compare approaches, and define scope before coding
disable-model-invocation: true
---

# Design

Analyze the requested task and create a structured implementation plan. Do not implement anything. Focus on analysis, decisions, and surfacing risks.

If requirements are unclear, ask clarifying questions before planning.

## Workflow Context

This skill is for structured, thorough analysis. It complements — not replaces — the built-in Plan modes in Cursor and Claude Code:

- **Built-in Plan mode** — Lightweight, conversational. Use for quick directional discussions and iterating on ideas collaboratively.
- **This skill (`@design`)** — Structured and methodical. Use when the task needs formal analysis with scope, steps, risks, and open questions documented.

Typical flow for complex tasks: **Plan mode** (quick discussion to align on direction) → **`@design`** (structured analysis) → **`@implement`** (execution based on the design).

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

- Search for related implementations and patterns to use as models
- Map affected files, components, and modules
- Identify shared code in the blast radius
- Understand data flow and state management in the affected area
- Note existing constraints (tech debt, API contracts, performance budgets)

### 3. Evaluate Approaches

Compare viable approaches — only if multiple genuinely exist. Don't fabricate alternatives when one approach is clearly right.

For each approach, assess:

- **Alignment** — How well does it match existing codebase patterns?
- **Simplicity** — What's the minimum complexity to meet requirements?
- **Risk** — What could go wrong? How reversible is it?
- **Effort** — Relative size (S/M/L)

Select and justify the recommended approach. If there's only one viable path, state it and explain why alternatives don't apply.

### 4. Define Scope

Explicitly state:
- **In scope** — What will be changed
- **Out of scope** — What will NOT be changed, even if related
- **Boundaries** — Where this work ends and future work begins

This prevents scope creep during implementation.

### 5. Break Down Steps

Create an ordered list of implementation steps. Each step should be independently verifiable — either testable or reviewable on its own.

For each step: brief description, dependencies on prior steps, and risk level if elevated.

Guidelines for good steps:
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

| Task Size | Plan Depth |
|---|---|
| Medium (2-5 files, clear pattern) | Steps 1, 4, 5 — skip approach comparison, light on risks |
| Large (5-15 files, some ambiguity) | All steps, moderate detail |
| Complex (architectural, cross-cutting) | All steps, deep exploration, multiple approaches compared |

## Updating the Plan

Plans are living documents. During implementation:

- If a step reveals the approach won't work, revisit step 3 before continuing
- If scope changes, update step 4 explicitly
- If new risks emerge, add them — don't silently absorb surprises

## Output Structure

Adapt to task size — not every plan needs every section:

- **Task Understanding** — Restatement and clarifying questions
- **Exploration Findings** — Key patterns, affected files, constraints discovered
- **Approach** — Recommended approach with rationale (comparison table only if multiple viable options)
- **Scope** — In scope / out of scope
- **Steps** — Ordered implementation steps with dependencies and risk flags
- **Risks** — Specific risks with mitigation strategies
- **Open Questions** — Assumptions that need validation before or during implementation

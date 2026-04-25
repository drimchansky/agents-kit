---
name: design-plan
description: Use when asked to plan, design, architect, scope, or break down a feature or change before implementation.
argument-hint: '[task or feature description]'
disable-model-invocation: true
---

This skill produces an implementation plan as a file in `.agents/plans/`. The plan is the contract that `implement-plan` later executes against.

The user provides a task or feature request. They may include context about constraints, preferences, or prior discussion.

**CRITICAL**: The output of this skill is a written plan file on disk, not a conversation message. After writing it, summarize the plan briefly in the chat and point at the file.

## References

Before working, read any applicable checklists from `references/`. Skip ones that don't apply.

## Workflow Context

This skill complements — not replaces — an agent's planning mode, if one exists:

- **Planning mode** — Conversational alignment on direction and scope.
- **This skill** — Structured and methodical. Formal analysis written to disk so it can be executed and tracked.

Typical flow: planning (align on direction) → **design-plan** (structured analysis, plan file) → **implement-plan** (execute and track) → review/verify.

For simpler tasks, skip straight to whichever step matches the complexity.

## When to Plan (and When Not To)

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

## Plan File Output

**Location:** `.agents/plans/YYYY-MM-DD-<slug>.md` at the project root.

- `YYYY-MM-DD` — today's date
- `<slug>` — derived from the task: 2–5 lowercase kebab-case words capturing the gist (e.g. `add-csv-export`, `migrate-auth-middleware`, `fix-stale-cache-invalidation`). Don't ask the user — derive it.

If `.agents/plans/` doesn't exist, create it. If the same slug already has a plan for today, append a short suffix (`-2`, `-3`).

The plan file is the **contract**. Once written, `implement-plan` consumes it and updates step checkboxes as work completes. Avoid rewriting the plan in place during planning iteration unless the user asks for revisions — refine through conversation, then write the final version.

## Planning Process

### 1. Clarify Requirements

- Restate the task to confirm understanding; separate explicit requirements from assumptions
- List ambiguities — ask before proceeding if critical
- Identify what "done" looks like for this task

### 2. Explore the Codebase

**CRITICAL**: Always ground the plan in what already exists. Read before designing.

- Search for related implementations to use as models; map affected files and shared code in the blast radius
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

Create an ordered list of implementation steps. Each step must be a **verifiable piece of work** — after completing it, there's a concrete way to confirm it worked before moving on.

For each step:

- **What** — Brief description of the change (one concern per step)
- **Verify** — How to confirm it works (run a test, check a behavior, see output, verify types pass)
- **Depends on** — Prior steps required (if any)

The verification criterion is non-negotiable. If you can't state how to verify a step, it's either too vague or too small to be a step.

Step sizing:

- Too coarse: "Implement the feature" — not actionable, not verifiable as a unit
- Too fine: "Add import statement" — noise, not independently meaningful
- Right size: "Add validation hook with error state for the form fields" — one concern, verifiable by rendering the form and checking error states appear

**Step format in the plan file:**

```markdown
### Step 1 — <short title>

- [ ] **What:** <one-sentence change>
- **Verify:** <how to confirm>
- **Depends on:** <prior step numbers, or "none">
```

The leading `- [ ]` checkbox is the marker `implement-plan` flips to `- [x]` when the step is done, with a link to the result file section appended.

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

- **Medium** (2-5 files, clear pattern) — Steps 1, 4, 5 — skip approach comparison, light on risks
- **Large** (5-15 files, some ambiguity) — All steps, moderate detail
- **Complex** (architectural, cross-cutting) — All steps, deep exploration, multiple approaches compared

## Don't Rationalize

- "I already know the codebase well enough" — Read the code anyway. Memory drifts; the code is the truth.
- "There's only one way to do this" — If you haven't explored alternatives, you don't know that.
- "The risks are obvious, no need to list them" — Generic risk awareness is not risk identification. Be specific or admit there are none.
- "This is too simple to plan" — If the user asked for a plan, the task warranted one.
- "I'll figure out the scope during implementation" — Undefined scope produces undefined work. Bound it now.
- "I'll just output the plan in chat" — The plan must be a file. `implement-plan` reads it from disk.

## Verification

- [ ] Plan written to `.agents/plans/YYYY-MM-DD-<slug>.md`
- [ ] Slug derived from task, kebab-case, 2–5 words
- [ ] Each step has `- [ ]` checkbox marker, **What**, **Verify**, **Depends on**
- [ ] Plan is grounded in actual code exploration, not assumptions
- [ ] Each step is independently verifiable
- [ ] Scope boundaries are explicit (in/out of scope stated)
- [ ] Risks are specific to this task, not generic checklists
- [ ] Open questions that could invalidate the approach are surfaced

## Plan File Structure

Write the file with this top-level layout. Adapt sections to task size — not every plan needs every section.

```markdown
# <task title>

**Status:** ready
**Result:** _(populated by `implement-plan`: link to `YYYY-MM-DD-<slug>.result.md`)_

## Task Understanding

<restatement and any clarifying notes>

## Exploration Findings

<key patterns, affected files, constraints discovered>

## Approach

<recommended approach with rationale; comparison table only if multiple viable options>

## Scope

- **In scope:** ...
- **Out of scope:** ...
- **Boundaries:** ...

## Steps

### Step 1 — <title>

- [ ] **What:** ...
- **Verify:** ...
- **Depends on:** none

### Step 2 — <title>

- [ ] **What:** ...
- **Verify:** ...
- **Depends on:** Step 1

## Risks

- ...

## Open Questions

- ...
```

## Handoff

After writing the plan, tell the user:

- The path: `.agents/plans/YYYY-MM-DD-<slug>.md`
- Whether to proceed with `implement-plan` (and whether full-plan or step-by-step execution makes sense given the scope)
- Any open questions that should be resolved before implementation begins

If the user intends to execute the plan manually (without `implement-plan`), point them at `implement-plan`'s "Plan Revisions Mid-Execution" section for the revision protocol when discoveries require updating the plan.

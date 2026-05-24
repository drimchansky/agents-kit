---
name: refine-idea
description: Use when asked to refine, ideate, sharpen, or stress-test a vague idea or rough concept before planning.
argument-hint: '[idea or concept]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.

This skill turns a raw idea into a sharp, actionable concept worth building. It runs the diverge / converge / sharpen process from `references/workflow/refine-idea.md` and produces an artifact at `.agents/tasks/<slug>/CONTEXT.md` that `plan-task` and `implement-plan` later consume as the shared context for every plan in the task directory.

The user provides a rough concept, problem, or "what if" question. They may include partial context, constraints, or prior thinking. The idea may be vague on purpose — that's the input.

**CRITICAL**: The output of this skill is a written one-pager on disk, not a conversation message. After writing it, summarize briefly in chat and point at the file.

## References

Before working, read `references/workflow/refine-idea.md` — it carries the When-to-Refine criteria, Phase 1 (Diverge), Phase 2 (Converge), the shared Don't Rationalize entries, and the Standard Verification Checklist that apply to every refinement.

## Skip refinement when

- The user already knows what they want to build and just needs a plan → use `plan-task`
- The change is well-scoped and the problem is concrete → use `plan-task`
- The user wants to sharpen an idea without writing anything to disk → use `refine-idea-chat` (chat-only sibling)
- The user is asking how something works, not deciding what to build → use `explore`

If the idea is already concrete enough to plan, say so and recommend `plan-task` directly.

## Output File

**Location:** `.agents/tasks/<slug>/CONTEXT.md` at the project root.

- `<slug>` — derive from the idea: 2–5 lowercase kebab-case words capturing the gist (e.g. `weekly-digest-email`, `replace-cache-invalidation`, `internal-search-rebuild`). Don't ask the user — derive it. The slug names the **task directory** that will hold this `CONTEXT.md` plus every plan and result for the effort.

If `.agents/tasks/<slug>/` doesn't exist, create it. If a `CONTEXT.md` already exists at that path, read it first and ask whether to overwrite or pick a different slug — don't clobber an existing task's context.

`CONTEXT.md` is the **shared context for the task directory**: the chosen direction, the assumptions it depends on, the scope decisions already made, plus any external references (tickets, links, pasted specs) the user adds later. It is read by every plan inside the directory. Don't rewrite it during refinement — refine through conversation, then write the final version.

### What belongs in CONTEXT.md (and what doesn't)

- ✅ The one-pager content this skill produces (problem framing, MVP scope, "Not Doing", assumptions)
- ✅ External references — tickets, Slack threads, PR links, Figma, design docs
- ✅ Pasted specs, schemas, API responses
- ✅ Cross-cutting decisions that apply to **every** plan in the directory
- ❌ Per-step implementation notes — those go in the plan's result file
- ❌ Approach rationale or step breakdowns — those go in the plan
- ❌ Acceptance criteria — those go in the plan's sibling `<task-slug>.spec.md`
- ❌ Verify criteria — those go in the plan's *Steps*
- ❌ Conversation summaries or TODO scratchpads

## Phase 3 — Sharpen (output)

Run Phases 1 and 2 from `references/workflow/refine-idea.md`. Then write the one-pager to `.agents/tasks/<slug>/CONTEXT.md` using the *CONTEXT.md Structure* layout below, and post a short summary in this exact shape so the user can copy-paste the next command:

```
Context: .agents/tasks/<slug>/CONTEXT.md
Slug: <slug>

Next: /plan-task <slug>
```

`plan-task` discovers `CONTEXT.md` by reading the task directory at `.agents/tasks/<slug>/`. The slug is the directory name and is the only handoff token needed. The pre-formatted next-command is what makes the handoff frictionless; don't drop it or paraphrase it.

## Don't Rationalize (skill-specific)

Beyond the shared rationalizations in `references/workflow/refine-idea.md`:

- "I'll output the one-pager in chat" — The artifact must be a file. `plan-task` reads it from disk. If the user wants chat-only output, that's `refine-idea-chat`, not this skill.

## Verification

Apply the Standard Verification Checklist in `references/workflow/refine-idea.md`, plus:

- [ ] One-pager written to `.agents/tasks/<slug>/CONTEXT.md`
- [ ] Task directory created if it didn't exist; existing `CONTEXT.md` not silently overwritten
- [ ] Chat summary surfaces file path, slug, **and** the literal `Next: /plan-task <slug>` line in the exact handoff shape
- [ ] Slug derived from the idea, kebab-case, 2–5 words
- [ ] Output is a file on disk, not a conversation message

## CONTEXT.md Structure

Write the file with this layout. Adapt section depth to the idea's size — keep the one-pager portion to one page where possible. The trailing `## References` section is a placeholder for the user (or later sessions) to drop external links, pasted specs, and cross-cutting notes.

The `**Status:**` field is a one-shot origin marker — `refined` here, never mutated after creation. Full vocabulary across all task files is registered in `references/workflow/task-lifecycle.md`.

```markdown
# <idea name>

**Status:** refined

## Problem Statement

<one-sentence "How Might We" framing>

## Acceptance Criteria

_(Per-plan acceptance criteria live in each plan's `<task-slug>.spec.md`. `plan-task` drafts the spec before the plan and asks for clarification when requirements are unclear.)_

## Recommended Direction

<the chosen direction and why — 2–3 paragraphs max>

## Key Assumptions to Validate

- [ ] <assumption> — <how to test it>
- [ ] <assumption> — <how to test it>

## MVP Scope

- **In:** <minimum to test the core assumption>
- **Out:** <what's deferred>

## Not Doing (and Why)

- <thing> — <reason>
- <thing> — <reason>

## Open Questions

- <question that needs answering before `plan-task`>

## References

_(Drop external links, pasted specs, screenshots, ticket numbers, or cross-cutting notes here. Read by every plan in this task directory.)_
```

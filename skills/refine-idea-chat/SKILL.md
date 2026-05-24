---
name: refine-idea-chat
description: Use when asked to refine, ideate, sharpen, or stress-test a vague idea in chat.
argument-hint: '[idea or concept]'
disable-model-invocation: true
---

# Refine Idea (chat)

This skill turns a raw idea into a sharp, actionable concept worth building. It runs the diverge / converge / sharpen process from `references/workflow/refine-idea.md` and posts the one-pager as a structured chat message.

The user provides a rough concept, problem, or "what if" question. They may include partial context, constraints, or prior thinking. The idea may be vague on purpose — that's the input.

**CRITICAL**: The output of this skill is a structured chat message. Do not write any files, derive any slugs, or hand off to another skill.

## References

Before working, read `references/workflow/refine-idea.md` — it carries the When-to-Refine criteria, Phase 1 (Diverge), Phase 2 (Converge), the shared Don't Rationalize entries, and the Standard Verification Checklist that apply to every refinement.

## Skip refinement when

- The user is asking how something works, not deciding what to build → use `explore`

If the idea is already concrete enough to plan, say so and recommend the appropriate next step directly.

## Phase 3 — Sharpen (output)

Run Phases 1 and 2 from `references/workflow/refine-idea.md`. Then post the one-pager as a structured chat message using the *One-pager structure* layout below. No files are written. No slug is derived. No follow-up command is suggested.

## Don't Rationalize (skill-specific)

Beyond the shared rationalizations in `references/workflow/refine-idea.md`:

- "I'll save this to disk just in case" — This skill is chat-only. If the user wants a saved artifact, that's `refine-idea`, not this one.

## Verification

Apply the Standard Verification Checklist in `references/workflow/refine-idea.md`, plus:

- [ ] One-pager posted as a structured chat message
- [ ] No files written, no slug derived, no follow-up command suggested

## One-pager structure

Render the chat message with this layout. Adapt section depth to the idea's size — keep it to one screen where possible.

```markdown
# <idea name>

## Problem Statement

<one-sentence "How Might We" framing>

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

- <question that needs answering before building>
```

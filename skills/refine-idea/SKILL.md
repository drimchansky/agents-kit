---
name: refine-idea
description: Use when asked to refine, ideate, sharpen, or stress-test a vague idea or rough concept before planning.
argument-hint: '[idea or concept]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. Load the domain pack: take the task's `**Domain:**` (default `engineering`; infer from the request when there's no `CONTEXT.md` yet, and record it in the `CONTEXT.md` you write) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for. If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill turns a raw idea into a sharp, actionable concept worth building. It runs three phases — divergent exploration, convergent evaluation, and a written one-pager — and produces an artifact at `.agents/tasks/<slug>/CONTEXT.md` that `plan-task` and `implement-task` later consume as the static grounding context for the task.

The user provides a rough concept, problem, or "what if" question. They may include partial context, constraints, or prior thinking. The idea may be vague on purpose — that's the input.

**CRITICAL**: The output of this skill is a written one-pager on disk, not a conversation message. After writing it, summarize briefly in chat and point at the file.

## When to Refine (and When Not To)

**Refine when:**

- The idea is vague enough that planning would just guess at scope
- Multiple framings are plausible and none has been chosen
- Hidden assumptions could kill the idea before any code is written
- The user wants to stress-test thinking, not just get a plan

**Skip refinement when:**

- The user already knows what they want to build and just needs a plan → use `plan-task`
- The change is well-scoped and the problem is concrete → use `plan-task`
- The user wants to sharpen an idea without writing anything to disk → use `refine-idea-chat` (chat-only sibling)
- The user is asking how something works, not deciding what to build → use `explore`

If the idea is already concrete enough to plan, say so and recommend `plan-task` directly.

## Output File

**Location:** `.agents/tasks/<slug>/CONTEXT.md` at the project root.

- `<slug>` — derive from the idea: 2–5 lowercase kebab-case words capturing the gist (e.g. `weekly-digest-email`, `replace-cache-invalidation`, `internal-search-rebuild`). Don't ask the user — derive it. The slug names the **task folder** that will hold this `CONTEXT.md` plus the goals, plan, and result for the effort — the folder layout and discovery rules are defined in `./references/workflow/task-layout.md`.

If `.agents/tasks/<slug>/` doesn't exist, create it. If a `CONTEXT.md` already exists at that path, read it first and ask whether to overwrite or pick a different slug — don't clobber an existing task's context.

`CONTEXT.md` is the **static grounding context for the task**: the chosen direction, the assumptions it depends on, the scope decisions already made, plus any external references (tickets, links, pasted specs) the user adds later. It is read by the plan and its result inside the folder. Don't rewrite it during refinement — refine through conversation, then write the final version.

### What belongs in CONTEXT.md (and what doesn't)

- ✅ The one-pager content this skill produces (problem framing, MVP scope, "Not Doing", assumptions)
- ✅ External references — tickets, Slack threads, PR links, Figma, design docs
- ✅ Pasted specs, schemas, API responses
- ✅ Standing decisions and constraints the plan must respect
- ❌ Per-step implementation notes — those go in the plan's result file
- ❌ Approach rationale or step breakdowns — those go in the plan
- ❌ Goals / acceptance criteria — those go in the sibling `goals.md`
- ❌ Verify criteria — those go in the plan's _Steps_
- ❌ Conversation summaries or TODO scratchpads

## Process

This skill runs the shared two-phase ideation method — **Phase 1 (Diverge)** and **Phase 2 (Converge)** — defined in `./references/workflow/ideation.md`. Run both phases from there (the testable, plan-specific goals are deferred to `plan-task`'s goals step, not written here), then complete **Phase 3** below to produce the artifact.

### Phase 3 — Sharpen

Write the one-pager to `.agents/tasks/<slug>/CONTEXT.md`. Then post a short summary in this exact shape, so the user can copy-paste the next command:

```
Context: .agents/tasks/<slug>/CONTEXT.md
Slug: <slug>

Next: /plan-task <slug>
```

`plan-task` discovers `CONTEXT.md` by reading the task folder at `.agents/tasks/<slug>/`. The slug is the folder name and is the only handoff token needed. The pre-formatted next-command is what makes the handoff frictionless; don't drop it or paraphrase it.

The "Not Doing" list is the most valuable part — focus is about saying no to good ideas. Make trade-offs explicit.

## Don't Rationalize

- "This idea is clear enough already" — If the user invoked `refine-idea`, it wasn't.
- "Three phases is overkill" — The phases each do one thing. Skipping them collapses the artifact into a plan that hasn't earned its assumptions.
- "I'll surface assumptions later" — Untested assumptions kill ideas. Surface them before committing to a direction.
- "More variations is better" — 5–8 considered variations beat 20 shallow ones.
- "The user liked the first idea, ship that" — Liking the first idea doesn't validate it. Run the convergent stress-test anyway.
- "I'll output the one-pager in chat" — The artifact must be a file. `plan-task` reads it from disk. If the user wants chat-only output, that's `refine-idea-chat`, not this skill.

## Verification

- [ ] One-pager written to `.agents/tasks/<slug>/CONTEXT.md`
- [ ] Task folder created if it didn't exist; existing `CONTEXT.md` not silently overwritten
- [ ] Chat summary surfaces file path, slug, **and** the literal `Next: /plan-task <slug>` line in the exact handoff shape
- [ ] Slug derived from the idea, kebab-case, 2–5 words
- [ ] "How Might We" problem statement is one sentence and concrete
- [ ] Multiple directions were explored, not just the user's first framing
- [ ] Hidden assumptions are listed with how each could be validated
- [ ] "Not Doing" list makes trade-offs explicit, with reasons
- [ ] Output is a file on disk, not a conversation message

## CONTEXT.md Structure

Write the file using the canonical schema in `./references/workflow/context-schema.md`. Adapt section depth to the idea's size — keep the one-pager portion to one page where possible. Fill the sections from the two-phase pass: the "How Might We" problem statement, the recommended direction, the key assumptions, the MVP scope, and the "Not Doing" list.

Write `**Status:** refined` — the one-shot origin marker for a file this skill produced, never mutated after creation. Infer `**Domain:**` from the idea (e.g. `engineering` for a code change, `relocation` or `negotiation` otherwise); default to `engineering` only when the work is code or genuinely ambiguous within a coding context, and when the effort is clearly non-code but the right domain is unclear, **ask** rather than stamping a wrong label. See `./references/workflow/domain-packs.md`.

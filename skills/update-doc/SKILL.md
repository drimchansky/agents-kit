---
name: update-doc
description: Use when asked to write, update, or revise documentation based on the current implementation — README, AGENTS.md/CLAUDE.md, architecture notes, ADRs, API docs, runbooks, or any other written documentation.
argument-hint: '[doc file path]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line verbatim to the user as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core agents-kit rules applied (./AGENTS.md)

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill produces or updates a documentation file from the current state of the codebase. It synthesizes — reading the implementation, prior versions of the doc, and any conversation context — to write a doc that reflects what actually exists.

The user provides a target doc and (optionally) what to focus on. This may be a new doc to create, an existing doc to bring up to date, or a specific area within a doc to revise. Your job is to produce a file on disk that matches reality.

For checking whether an existing doc is accurate before updating, use `validate-docs` first. For documentation written ahead of implementation, use `design-plan` or `review-plan` instead.

**CRITICAL**: Write the doc to a file. The output of this skill is a file on disk, not a conversation message. The doc is always the current truth — no revision history, no resolved-questions appendix, no changelog inline.

## References

Before working, read any applicable checklists from `references/engineering/`. Skip ones that don't apply.

## Modes

- **Create** — No file exists yet. Read the implementation, gather context, write the doc from scratch.
- **Update** — A doc file already exists. Read it fully, identify what's stale or missing, rewrite the affected sections. Preserve what's still valid.

## Two Doc Types

### Project Doc

High-level project identity — what it is, how to work with it, what's allowed. Written to the project's AGENTS.md (or CLAUDE.md) at the repository root. README.md serves a similar role for the public-facing audience.

**Default structure:**

- **Objective** — What the project does, who it's for
- **Tech Stack** — Languages, frameworks, key dependencies with versions
- **Commands** — Build, test, lint, deploy commands with brief descriptions
- **Project Structure** — Key directories and their purpose
- **Boundaries** — Rules for the agent, organized as: always do / ask first / never do

**When to use:** Onboarding a codebase to agent use, refreshing project-level context after significant changes (new dependencies, restructuring, changed conventions), or producing a README from current code.

### Feature / Area Doc

A specific feature, module, or technical area — its purpose, how it's organized, how to extend it. Written to a separate file — location depends on project conventions.

**Default structure:**

- **Summary** — One paragraph. What this is, why it exists, who uses it.
- **How It Works** — Data flow, key components, integration points. Anchored in actual code (file:line references).
- **Public Surface** — Exported types, functions, components, hooks that other code depends on.
- **Constraints** — Hard rules the implementation imposes (API limits, data model restrictions, validation rules) — derived from code, not aspiration.
- **Examples** — Real usage, ideally extracted from existing call sites in the codebase.
- **Open Questions** — Unresolved decisions or known gaps. Remove as they get answered — do not keep a "resolved" section.

**When to use:** A module's surface has stabilized and needs documenting; a feature shipped and the team needs onboarding material; an area was refactored and the existing doc no longer matches.

## When to Use

**Use when:**

- The user asks to write, update, refresh, or generate a doc
- A feature shipped and the doc needs to reflect what was built
- `validate-docs` flagged stale or missing content and the user wants it fixed
- A new project or module needs a doc for onboarding
- The user says "write a doc," "update the README," "document this module," or "incorporate this into the doc"

**Skip when:**

- The user wants a plan ahead of implementation — use `design-plan` or `review-plan` instead
- The doc only needs validation, not changes — use `validate-docs`
- The change is so trivial that opening the doc in an editor is faster

## Process

### 1. Determine Doc Type and Mode

**Doc type:**

- **Project doc** — Repo-level identity (AGENTS.md / CLAUDE.md / README.md at root)
- **Feature / area doc** — A specific module, feature, or technical area

If unclear from context, ask.

**Mode:**

- **Create** — No doc file exists yet. Gather context from code, then write.
- **Update** — A doc file already exists. Read it fully before making changes. Identify what new context needs to be incorporated and target only the affected sections.

### 2. Discover Conventions

**For project docs:**

- Check whether AGENTS.md, CLAUDE.md, or README.md already exists at the project root
- If one exists, read it — you're in update mode. Preserve existing content that is still valid.
- If none exists, you're creating from scratch. Confirm which file the user wants.

**For feature / area docs:**

- Search for existing docs: `docs/`, `architecture/`, `adr/`, or similar directories
- If existing docs are found: read 1–2 to learn the format, structure, and naming convention. Match them.
- If no existing docs are found: ask the user where to place the doc file. Do not assume a path.

### 3. Read the Implementation

This is the core step — the doc is grounded in code, not in conversation.

**For project docs:**

- Read `package.json` (or equivalent) for stack, scripts, dependencies
- Walk the top-level directory layout
- Identify build / test / lint / deploy scripts and what they do
- Note any project-level config files that shape behavior (tsconfig, eslint config, etc.)

**For feature / area docs:**

- Read the module's source files in full
- Identify exports — these form the public surface
- Trace data flow: where does input come from, where does output go?
- Find existing usage sites — they're the best source of "real" examples
- Note constraints enforced in code (validation, type narrowing, runtime guards)

### 4. Gather Additional Context

**From the existing doc (if updating):**

- Sections that still match the code — keep them
- Sections that are stale — rewrite them
- Sections that no longer apply — remove them

**From `validate-docs` findings (if available):**

- Stale claims that need correcting
- Gaps that need filling
- Misleading phrasings that need clarification

**From conversation:**

- User's emphasis on what should be in the doc
- Audience the doc targets (agent, new developer, ops, public)
- Constraints on length or format

**From the user directly:**

- If critical context is missing and cannot be inferred, ask. Batch your questions — don't ask one at a time.

### 5. Write the Doc

**If matching an existing project format:** follow that format exactly.

**Otherwise:** use the default structure for the determined doc type (see "Two Doc Types" above).

**Writing principles:**

- **Ground every claim in code.** If you can't point to a file, function, or config value, the claim probably doesn't belong.
- **Synthesize, don't transcribe.** "It uses TanStack Query for fetching" is better than copying a code snippet that imports the library.
- **Be concrete.** Specific file paths, function names, command strings, version numbers. Vague text is the enemy of doc accuracy.
- **Omit what you don't know.** Don't invent. If a section would be speculation, leave it out and add an open question instead.
- **State constraints with provenance.** "The API returns max 50 items per page (`apiClient.ts:42`)" — anchor the constraint in code.
- **Keep it current.** When updating, rewrite sections rather than appending. The doc is a snapshot of current understanding, not a changelog.
- **Examples should run.** If you include code examples, they should reflect the actual API. Pull from real call sites when possible.

### 6. Handle Open Questions

Open questions surface things you genuinely cannot determine from code or context. They drive follow-up loops, not the doc's main content.

**When creating:**

- Surface questions you identified during exploration — things the code doesn't make clear and that the user did not specify
- Limit to questions that genuinely affect the doc's accuracy. Trivia doesn't belong here.

**When updating from `validate-docs` findings:**

- If the user (or the code) answered a previous question, incorporate the answer into the relevant section and remove the question
- If validation raised new gaps, add them as open questions (unless you can fill them from code)
- If a previously documented claim turned out infeasible or wrong, fix it and note in the section's surrounding text

### 7. Verify Before Writing

Before writing the file, check:

**For project docs:**

- Objective accurately states what the project does and for whom
- Commands are accurate — verify they exist in `package.json` or equivalent
- Project structure matches the actual directory layout
- Boundaries are actionable — not vague ("be careful") but specific ("don't modify CI config without asking")
- Versions match installed dependencies

**For feature / area docs:**

- Public surface matches actual exports
- File:line references resolve to the correct code
- Examples compile against current types
- Constraints are enforced in code, not assumed
- Open questions are genuinely unresolvable from available context

Then write the file.

## Don't Rationalize

- "I remember how this works." — Read the code. Memory drifts; the code is the truth.
- "I'll add some extra detail to make the doc more complete." — Only include what the code or user supports. Invented detail erodes trust.
- "This question will sort itself out." — If it affects the doc's accuracy, surface it now. Open questions exist for this reason.
- "I'll keep the old phrasing and add the new context below it." — Rewrite the section. The doc is current truth, not a conversation thread.
- "I don't know where docs go, I'll just put it in the root." — Check for conventions first. If none exist, ask.
- "The reader can figure out the examples." — Pull real usage. Synthesized examples drift from reality faster than written prose does.
- "I'll leave the format flexible." — Match the project's format or use the default. Unstructured docs aren't docs.
- "This is a project doc, I don't need to read the codebase." — Read it. Commands, structure, and stack must reflect reality.

## Verification

- [ ] Doc written to a file on disk, not just output in conversation
- [ ] Correct doc type chosen (project vs. feature/area)
- [ ] File location follows project conventions (or user was asked)
- [ ] Format matches existing docs in the project (if any exist)
- [ ] Every concrete claim grounded in code (file path, function, config value)
- [ ] No invented detail — everything traces to code, existing doc, or user input
- [ ] When updating: changed sections rewritten in place, unchanged sections preserved
- [ ] When updating from `validate-docs`: stale claims fixed, gaps filled
- [ ] For project docs: commands, versions, and structure verified against actual project
- [ ] For feature docs: public surface matches actual exports; examples reflect real code

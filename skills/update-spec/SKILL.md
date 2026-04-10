---
name: update-spec
description: Creates or updates a specification — synthesizes context from conversations, exploration, and feedback into a written spec file. Use when asked to write a project spec, feature spec, or revise an existing spec.
argument-hint: '[spec file path]'
---

This skill produces a written specification file from scattered context — conversation history, exploration findings, validate-spec feedback, user statements, and codebase knowledge. It synthesizes, not transcribes.

The user provides context about what they want specified. This may be an informal description, a conversation thread, exploration output, or feedback from a previous validate-spec run. Your job is to produce a spec file that is concrete enough for validate-spec to meaningfully review against the codebase.

**CRITICAL**: Write the spec to a file. The output of this skill is a file on disk, not a conversation message. The spec must be written (or overwritten) in place — it is always the current truth. No revision history, no resolved-questions appendix, no changelog.

## Workflow Context

This skill sits between exploration and validation:

```
explore → update-spec → validate-spec → design → implement
               ↑              |
               └──────────────┘  (iterate until spec passes)
```

- **First run (create)** — Synthesize conversation context, user descriptions, and exploration findings into a new spec file.
- **Subsequent runs (update)** — Read the existing spec, incorporate new context (validate-spec feedback, user answers, design discoveries), and rewrite the affected sections. Preserve what is still valid.

The iterate loop: `update-spec` writes the spec → `validate-spec` reviews it against the codebase and surfaces gaps → the user answers questions → `update-spec` incorporates the answers. Repeat until validate-spec passes.

## Two Spec Types

### Project Spec

High-level project identity — what it is, how to work with it, what's allowed. Written to the project's AGENTS.md (or CLAUDE.md) at the repository root.

**Default structure:**

- **Objective** — What the project does, who it's for
- **Tech Stack** — Languages, frameworks, key dependencies with versions
- **Commands** — Build, test, lint, deploy commands with brief descriptions
- **Project Structure** — Key directories and their purpose
- **Boundaries** — Rules for the agent, organized as: always do / ask first / never do

**When to use:** Setting up a new project for agent use, onboarding a codebase, or updating project-level context after significant changes (new dependencies, restructuring, changed conventions).

### Feature Spec

A specific feature, technical change, or initiative. Written to a separate file — location depends on project conventions.

**Default structure:**

- **Summary** — One paragraph. What is being built, why, and for whom. A reader should understand the feature's purpose without reading further.
- **User Flows** — Step-by-step sequences of what the user does and what the system does in response. Cover the primary flow first, then variants and edge cases. Be specific: "user clicks X" not "user interacts with the feature."
- **Constraints** — Hard rules the implementation must respect. Technical constraints (API limits, data model restrictions), business rules (validation logic, ordering requirements), and UX constraints (accessibility, responsive behavior). Only include constraints that are real — discovered in exploration or stated by the user.
- **Acceptance Criteria** — Testable statements. Each criterion should be verifiable by looking at the running system or the code. "The form validates input" is not testable. "Submitting with an empty name field shows an inline error and prevents submission" is testable.
- **Open Questions** — Things that need resolution before or during implementation. Each question should explain what depends on the answer. Remove questions as they get answered — do not keep a "resolved" section.

**When to use:** Before implementing any non-trivial feature, after exploration reveals enough context, or when validate-spec feedback needs to be incorporated.

## When to Use

**Use when:**

- The user describes a feature and wants it captured as a spec before implementation
- A new project needs an AGENTS.md / CLAUDE.md for agent onboarding
- validate-spec surfaced gaps or questions that need to be incorporated back into the spec
- Requirements are scattered across conversation history and need consolidation
- The user says "write a spec," "update the spec," "add this to the spec," or "incorporate this feedback"

**Skip when:**

- A spec already exists and the user wants it validated — use validate-spec directly
- The user wants to design the implementation — use design
- The task is simple enough that a spec would be overhead (single-file change, obvious bug fix)
- The user has a finished spec and wants to proceed — don't insert this step

## Process

### 1. Determine Spec Type and Mode

**Spec type:**

- **Project spec** — User is setting up a project, describing its stack, structure, or boundaries. Target: AGENTS.md / CLAUDE.md at the project root.
- **Feature spec** — User is describing a specific feature, change, or initiative. Target: a separate spec file.

If unclear from context, ask.

**Mode:**

- **Create** — No spec file exists yet. Gather context, then write.
- **Update** — A spec file already exists. Read it fully before making changes. Identify what new context needs to be incorporated and target only the affected sections.

### 2. Discover Conventions

**For project specs:**

- Check if AGENTS.md or CLAUDE.md already exists at the project root
- If it exists, read it — you're in update mode. Preserve existing content that is still valid.
- If it does not exist, you're creating it from scratch

**For feature specs:**

- Search for existing spec files: `specs/`, `docs/specs/`, `docs/`, or similar directories
- Search for files with "spec" or "prd" in the name
- If existing specs are found: read 1-2 to learn the format, structure, and naming convention. Match them.
- If no existing specs are found: ask the user where to place the spec file. Do not assume a path.

### 3. Gather Context

Collect everything relevant before writing. The goal is to have all inputs assembled first.

**From conversation:**

- User's description of what they want built or specified
- Constraints mentioned explicitly or implicitly
- Decisions already made during discussion
- Questions they asked that reveal intent

**From exploration:**

- Relevant codebase patterns, existing components, APIs
- Constraints discovered in the code (architectural boundaries, data models, API contracts)
- Project structure, dependencies, build tooling (especially for project specs)

**From validate-spec feedback (if updating):**

- Questions that were asked — and the user's answers
- Gaps that were identified — these need to be filled
- Requirements marked infeasible — these need revision or removal
- Conflicts with the codebase — these need to be addressed

**From the user directly:**

- If critical information is missing and cannot be inferred, ask. Batch your questions — don't ask one at a time.
- Distinguish between "I need this to write the spec" (ask now) and "validate-spec will catch this" (defer)

### 4. Write the Spec

**If matching an existing project format:** follow that format exactly.

**Otherwise:** use the default structure for the determined spec type (see "Two Spec Types" above).

**Writing principles:**

- **Synthesize, don't transcribe.** The user said "it should probably sort by date or something" — the spec says "Results are sorted by creation date, newest first" (or asks which sort order if genuinely ambiguous).
- **Be concrete.** Every requirement should be specific enough that two developers would build the same thing from it.
- **Omit what you don't know.** Do not invent requirements the user did not ask for. If a section would be pure speculation, leave it out and add an open question instead.
- **State constraints with provenance.** If a constraint comes from the codebase ("the API returns max 50 items per page"), reference where you found it. If from the user, that is implicit.
- **Keep it current.** When updating, rewrite sections rather than appending. The spec is a snapshot of current understanding, not an append-only log.

### 5. Handle Open Questions

Open questions drive the iterate loop with validate-spec.

**When creating:**

- Surface questions you identified during context gathering — things the user did not specify and that cannot be inferred
- Limit to questions that genuinely block the spec from being concrete. "What color should the button be?" is not a spec-level question. "Should this create a new record or update an existing one?" is.

**When updating from validate-spec feedback:**

- If the user answered a question, incorporate the answer into the relevant section and remove the question
- If validate-spec raised new gaps, add them as open questions (unless you can fill them from context)
- If a requirement was marked infeasible, flag it: "Requirement X conflicts with [codebase constraint]. Revised approach needed."

### 6. Verify Before Writing

Before writing the file, check:

**For project specs:**

- Objective clearly states what the project does and for whom
- Commands are accurate — verify they exist in package.json or equivalent
- Project structure matches the actual directory layout
- Boundaries are actionable — not vague ("be careful") but specific ("don't modify CI config without asking")

**For feature specs:**

- Every acceptance criterion has a matching user flow that explains the context
- No requirements in user flows are missing from acceptance criteria
- Constraints reference real codebase findings, not assumed limitations
- Open questions are genuinely unresolvable from available context

Then write the file.

## Don't Rationalize

- "The user said it clearly enough, I'll just quote them." — Synthesize. Conversational phrasing is context, not spec language. Translate intent into concrete requirements.
- "I'll add some extra requirements to make the spec more complete." — Only include what the user asked for or what the codebase demands. Invented requirements waste everyone's time.
- "This question will sort itself out during implementation." — If it affects the spec, surface it now. Open questions exist for this reason.
- "I'll keep the old phrasing and add the new context below it." — Rewrite the section. The spec is current truth, not a conversation thread.
- "I don't know where specs go, I'll just put it in the root." — Check for conventions first. If none exist, ask the user.
- "The acceptance criteria are obvious from the user flows." — Write them out. Implicit criteria get missed during validation and implementation.
- "I'll leave the format flexible for now." — Match the project's format or use the default. Unstructured specs are not specs.
- "This is a project spec, I don't need to read the codebase." — Read it. Commands, structure, and stack should reflect reality, not assumptions.

## Verification

- [ ] Spec written to a file on disk, not just output in conversation
- [ ] Correct spec type chosen (project vs. feature)
- [ ] File location follows project conventions (or user was asked)
- [ ] Format matches existing specs in the project (if any exist)
- [ ] Content synthesized from context, not copied verbatim from user
- [ ] No invented requirements — everything traces to user input or codebase constraints
- [ ] When updating: changed sections rewritten in place, unchanged sections preserved
- [ ] When updating from validate-spec: answered questions incorporated, removed from open questions
- [ ] For project specs: commands and structure verified against actual project
- [ ] For feature specs: every acceptance criterion is testable

## Handoff

When the spec is written and ready for validation:

- Tell the user the spec is ready and suggest running validate-spec against it
- Provide the file path so validate-spec knows what to read
- If open questions remain, note that validate-spec may surface additional gaps beyond those

When receiving back from validate-spec:

- Read the validate-spec output (feasibility assessment, gaps, questions)
- Ask the user to answer the outstanding questions
- Re-run this skill in update mode to incorporate answers and address gaps
- Repeat until validate-spec confirms the spec is ready for design

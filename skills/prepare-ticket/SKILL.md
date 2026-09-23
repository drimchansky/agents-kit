---
name: prepare-ticket
description: Use when asked to prepare, draft, or write up a ticket or issue from a described task — turns it into a self-contained ticket file describing the real functional output required, with a title, minimal context, a description, and testable acceptance criteria. Can seed a task folder's ticket.md as the workflow's starting point. Captures the scope as described; does not invent requirements.
argument-hint: '[task description] [optional task folder, slug, or target file path]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

Write a self-contained, product-facing ticket to a file. Resolve no domain pack: the ticket precedes Domain grounding. Read `./references/workflow/ticket-format.md`, `./references/workflow/task-layout.md`, and `./references/workflow/task-destinations.md` before drafting.

## Process

### 1. Understand the task

Identify the requested functional outcome in one sentence. In a codebase, locate relevant components/files/names for accurate vocabulary and useful path citations. Keep the ticket in product terms; prescribe implementation only when the user did. Include minimal sufficient context for a reader without this session, linking specifications instead of pasting them. Add no unrequested requirement.

### 2. Clarify only if thin

If scope, done, or an essential constraint prevents testable criteria, ask up to three focused questions before drafting. Batch any destination question with them. A sufficiently specified request proceeds directly; unresolved requirements stay questions rather than guesses.

### 3. Destination

- **Task folder/slug or task-start intent:** resolve-or-create under `./references/workflow/task-layout.md` and destination precedence under `./references/workflow/task-destinations.md`. Use the supplied folder/slug or derive a 2–5-word kebab-case slug. Write its role-named ticket.md. Read an existing ticket and ask whether to update or choose another slug. Label the terminal session for the resolved folder per `./references/workflow/terminal-session.md`.
- **Standalone target file:** use that path; if it exists, read it and confirm update versus another path.
- **Neither path nor task intent:** suggest `<kebab-case-title>.md` or task seeding, and confirm before writing.

Before drafting a seeded task's ticket, read applicable GROUP_CONTEXT root-to-task under `./references/workflow/task-store.md` § *Shared group context*. Standalone files load none. Grounding may sharpen context or implied criteria, never add requirements or copied paragraphs. The ticket must remain usable without the store.

### 4. Draft the ticket

Fill `./references/templates/ticket.md` under `./references/workflow/ticket-format.md`: Title, Context, Description, Acceptance Criteria. Use In scope/Out of scope where needed. Include References only for requester-supplied links/specs/ticket IDs. Write in the request's language using lists, not tables.

### 5. Hold criteria to the bar

Apply `./references/workflow/ticket-format.md` and `./references/workflow/acceptance-criteria.md`. Each criterion is a single, specific, bounded, testable outcome in plain behavioral language. Replace vague success claims with observable results.

### 6. Write and report

Write only to the confirmed destination; do not silently overwrite existing content. Report briefly in chat without pasting the ticket:

- **Ticket:** path/title. For seeded tasks, add `Next: /plan-task <slug>`, or `/refine-idea <slug>` if still needing refinement. Use the resolvable slug or absolute folder path under `./references/workflow/task-layout.md` § *One task, one flat folder*.
- **Assumptions:** inferred details.
- **Open questions:** undecided matters, kept in chat rather than a ready ticket.

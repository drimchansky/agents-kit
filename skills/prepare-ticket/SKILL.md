---
name: prepare-ticket
description: Use when asked to prepare, draft, or write up a ticket or issue from a described task — turns it into a self-contained ticket file describing the real functional output required, with a title, minimal context, a description, and testable acceptance criteria. Can seed a task folder's ticket.md as the workflow's starting point. Captures the scope as described; does not invent requirements.
argument-hint: '[task description] [optional task folder, slug, or target file path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill writes a **product-facing ticket** — deliberately domain-neutral, and *upstream* of `CONTEXT.md`, so no `**Domain:**` marker exists yet to resolve. It reads the neutral core and resolves **no** pack. Its source of truth is `./references/workflow/ticket-format.md` (the ticket's shape and quality bar) and `./references/workflow/task-layout.md` (folder resolution and destination paths), read **at run time**.

Turn a task the user describes into a **self-contained ticket** — a file someone can pick up cold, with no access to this session, and act on. The ticket names the **real functional output required** — what the product should do for its user — in product terms, not implementation. Its four parts (a title, minimal **Context**, a **Description** of the work, and testable **Acceptance Criteria**) and the quality bar they must meet are defined once in [`./references/workflow/ticket-format.md`](./references/workflow/ticket-format.md). Read it before drafting. The file is the deliverable.

Inside the task workflow this ticket is the **product-facing origin** of a task folder — the role-named `ticket.md` that `refine-idea` and `plan-task` later derive `CONTEXT.md` and `goals.md` from (see [`./references/workflow/task-layout.md`](./references/workflow/task-layout.md)). Run standalone, it just writes a ticket to a file you name.

## Process

### 1. Understand the task

Read what the user gave you and restate the core ask to yourself in one sentence — as the functional outcome the product must deliver. If you can't, it's too thin — go to step 2. If you're running inside a codebase, ground the ticket in reality: grep for the components, files, and names involved so the Description and Criteria use the real vocabulary, not a paraphrase — while keeping the ticket itself at the altitude of product intent, not implementation. Cite concrete paths where they help the reader.

### 2. Clarify only if thin

If you can't write testable criteria from the description — scope is fuzzy, "done" is undefined, a load-bearing constraint is missing — ask a **tight batch of up to three** questions before drafting. Don't guess silently; don't interrogate either — a well-specified task goes straight through. Batch these with the destination question in step 3 so the user is interrupted once, not twice.

### 3. Destination

The ticket is always written to a file. Decide where:

- **Seeding a task folder** (the workflow starting point) — when the user names a task folder or slug, or asks to start a task, the ticket is the folder's role-named `ticket.md`. Resolve or create the folder per the *resolve-or-create* and *Destination paths* rules in [`./references/workflow/task-layout.md`](./references/workflow/task-layout.md): derive a 2–5-word kebab-case slug from the task and create `.agents/tasks/<slug>/` when no path is given, or use the task-folder path/slug the user supplied. Write `<task-folder>/ticket.md`. If a `ticket.md` already exists there, read it and ask whether to update it or pick a different slug — never silently overwrite.
- **A target path in the arguments** (standalone) — that's the file. If it already exists, read it and ask whether to update it or write elsewhere.
- **No path and no task intent** — suggest `<kebab-case-title>.md`, or offer to seed a task folder instead, and confirm before writing.

### 4. Draft the ticket

Fill the four sections defined in [`./references/workflow/ticket-format.md`](./references/workflow/ticket-format.md) — Title, Context, Description (with **In scope** / **Out of scope** bullets when the boundary isn't obvious), and Acceptance Criteria, plus the optional References. Keep every part in product terms — the functional output required, the observable behavior — and leave the *how* to the plan. Drop References unless the user gave you links, specs, or ticket IDs to carry.

### 5. Hold criteria to the bar

Every acceptance criterion must pass the quality bar in [`./references/workflow/ticket-format.md`](./references/workflow/ticket-format.md), which holds each to the same checks as a goal (`./references/workflow/acceptance-criteria.md`): testable, specific, outcome-oriented, singular, bounded, stated as observable behavior. Rewrite the vague ones: "the export works" → "The user can export the current filter as CSV; the downloaded file's row count matches the on-screen count"; "performance is acceptable" → "the file downloads in under 2s for the largest tenant in staging".

### 6. Write and report

Write the file. Then, in chat, **report — don't paste the ticket**:

- **Ticket** — the path and the title. When it seeded a task folder, add the handoff line so the next step is one copy-paste away: `Next: /plan-task <slug>` (or `/refine-idea <slug>` first when the ask still needs sharpening) — the bare slug when the folder sits in the canonical root or a registered one, the absolute path only when its root is neither (`./references/workflow/task-layout.md` § *One task, one flat folder*).
- **Assumptions** — anything you inferred to fill a gap the user didn't state.
- **Open questions** — anything still genuinely undecided. These stay out of the ticket file; a ready ticket is decided, and unresolved calls belong in chat where the user can answer them.

A few lines; the file is the deliverable.

## Don't Rationalize

- "Whoever picks this up will have the conversation" — They won't. The ticket travels alone; if it's not in the file, it doesn't exist.
- "More context is safer than too little" — Not here. Every extra paragraph buries the ask. Minimal-but-sufficient is the bar; link the spec, don't paste it.
- "I'll spell out how it should be built" — The ticket names the functional output, not the implementation. The *how* is the plan's job; prescribing it here pre-empts planning and dates the ticket.
- "'It works' is a fine criterion" — It isn't testable. Name the observable behavior in a plain sentence, or it can't gate anything.
- "I'll add a couple of obvious requirements while I'm here" — Capture only what's asked. An unrequested requirement is a question for the user, not a line in the ticket.
- "The description is clear enough to skip clarifying" — If you can't write testable criteria from it, it isn't. Ask the tight batch first.

## Verification

Confirm before finishing:

- [ ] Ticket written to a confirmed path — a task folder's role-named `ticket.md` when seeding a task, or the standalone path otherwise; an existing file never silently overwritten
- [ ] Title, Context, Description, and Acceptance Criteria follow [`./references/workflow/ticket-format.md`](./references/workflow/ticket-format.md)
- [ ] Ticket describes the real functional output required, in product terms — no prescribed implementation the user didn't ask for
- [ ] Context is self-contained (a reader with no access to this session can act; no "as discussed") and minimal (background and why only, no design dump or pasted spec)
- [ ] Every acceptance criterion is a single, testable outcome stated as a plain sentence — no hedge words, behavior not implementation
- [ ] Scope matches what was asked; no invented requirements; genuine gaps raised as questions, not guessed
- [ ] Lists, not tables; ticket written in the language of the request
- [ ] Chat report gives path, title, assumptions, open questions (and the handoff line when a task folder was seeded) — the ticket itself not pasted

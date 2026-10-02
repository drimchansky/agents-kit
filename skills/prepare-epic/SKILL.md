---
name: prepare-epic
description: Use when asked to prepare, draft, or write up an epic or its description — drafts it to a file in the kit's default epic shape from a raw description, a PRD or ADR, or task folders. Creates the tracker epic only on an explicit request.
argument-hint: '[epic description and/or sources: PRD or ADR path/URL, task folders or slugs] [optional target file path]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

Draft an epic description to a file in the default shape below. Resolve no domain pack: an epic states an outcome, not domain work.

## Process

### 1. Gather sources

Accept any mix of these:

- **Raw description:** the request's own text.
- **PRD or ADR:** a file path or URL. Fetch a URL read-only; when it cannot be reached, ask the user to paste the document.
- **Task folders:** slugs or paths. Resolve each per `./references/workflow/task-layout.md` § *Discovery rules for skills*, base resolution only. Read group context root-to-task per `./references/workflow/task-store.md` § *Shared group context*. Then read the task's ticket, context, goals, and the Current state section of its result.

Collect every source read-only, changing no source file or task record. Read task files directly rather than through `task-state.ts --repair`, which writes.

### 2. Clarify only if thin

When the sources cannot say who has the problem or what changes for them, ask up to three focused questions. Batch any destination question with them. Unresolved facts stay open questions rather than guesses.

### 3. Destination

Use a path the user named. Without one, suggest `<kebab-case-title>.md` and confirm it before writing. When a file already exists at the destination, read it and replace it only after the user confirms.

### 4. Draft and write

Fill this shape in the request's language:

```markdown
# <Epic summary>

<What is true for the user once this ships.>

**Why it matters.** <Who has the problem, what they do today, and what that costs them.>

**What this delivers.** <What the user can do afterwards, where, and what it unlocks downstream.>

**Context**

- <PRD or ADR title>: <URL>
- <Related epic, doc, or thread>: <URL>
```

- **Title line:** the epic summary as it will read in the tracker, before any project prefix.
- **Outcome sentence:** one sentence in the present tense, without "this epic".
- **Why it matters:** name the customer or team when a source names one. Use three to five sentences about them, not about the team's own architecture or backlog.
- **What this delivers:** what the user can do afterwards that they cannot do now, and on which surfaces. Keep it observable, so a reader can open the product and check each claim.
- **Context:** a short link list, the PRD or ADR first with its title. Include only links a tracker reader can open. Carry a local-only source's substance, such as a repo path, local file, or task folder, in the paragraphs instead.

Keep these out of the body even when a source contains them: status, owner, and dates; a list of children; a definition of done; non-goals; blockers and dependencies; sequencing. They live in the tracker's fields, child tickets, issue links, or the linked PRD, and a prose copy goes stale.

Keep the body to the outcome sentence, two paragraphs, and a link list. When it needs more, the substance belongs in a PRD or ADR, or the work is two epics. Tell the user so rather than lengthening the body.

State only what the sources support, and record each inferred detail as an assumption. Write only to the confirmed destination.

### 5. Push on request

Invoking this skill authorizes no tracker write, whether the user typed it or the model selected it. Only the user's explicit request to create or push the epic authorizes one.

- **Tools.** Use only the session's tracker tools. With none connected, say so, keep the draft, and stop the push. Never improvise an API or token path.
- **Project.** Take the project from the user's statement or the nearest `DOC_CONVENTIONS.md`, walking from the draft's directory and from each source task folder per `./references/workflow/task-store.md` § *Store-level artifacts*. Ask when neither names a project, or when two conventions files name different ones. Never guess a project key.
- **Project rules.** Apply field placement, renderer constraints, and title prefixes from those conventions or the user's statement. The kit carries none.
- **Create.** Re-read the draft file to pick up the user's edits. Create one epic, with the title line's text plus any prefix from **Project rules** as its summary and the body as its description. Never edit an existing epic.
- **Read back.** Read the created epic through the same tools. Report the tracker-returned key and URL; never construct either. Report each difference between the draft and what the tracker stored or rendered, without correcting it. Report a project rule the push applied as applied, not as a difference.
- **Uncertain outcome.** Inspect the tracker before retrying a write whose outcome is uncertain, so no duplicate epic is created.

### 6. Report

Report briefly in chat without pasting the epic:

- **Draft:** path and title.
- **Assumptions:** inferred details.
- **Open questions:** facts the sources left unresolved.
- **Epic:** after a push, the tracker-returned key and URL, plus any read-back differences.

Then close with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*):

- **Done:** the draft written, pointing at **Draft**, and the epic created when pushed, pointing at **Epic**.
- **Know:** inferred details the epic depends on, pointing at **Assumptions**, and any read-back differences.
- **Awaiting you:** point at **Open questions**.
- **Next:** for an unpushed draft only, the push request naming the project, such as `Create the epic in <project>`.

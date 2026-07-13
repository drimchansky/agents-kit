---
name: prepare-ticket
description: Use when asked to prepare, draft, or write up a ticket or issue from a described task — turns it into a self-contained ticket file with a title, minimal context, a description, and testable Given/When/Then acceptance criteria. Captures the scope as described; does not invent requirements.
argument-hint: '[task description] [optional target file path]'
disable-model-invocation: true
---

# Prepare Ticket

Turn a task the user describes into a **self-contained ticket** — a file someone can pick up cold, with no access to this session, and act on. The ticket has four parts: a **title**, a minimal **Context**, a **Description** of the work, and testable **Acceptance Criteria** in Given/When/Then form. The file is the deliverable.

The bar is self-containment under a minimalism budget. A ticket that leans on "the thing we discussed" is dead on arrival to whoever opens it next; a ticket that reprints the whole conversation buries the actual ask. Aim for the smallest text a competent stranger could execute — enough context to act, and not a sentence more.

## Hard rules

- **Self-contained.** A reader with no access to this chat must be able to understand and act. No "as discussed", no "the approach above", no reference to anything visible only in this session. Spell out names, paths, and terms, or link them.
- **Minimal, not maximal.** Context is background and *why* — the smallest amount that makes the work make sense. Link or cite a spec rather than pasting it. If a sentence doesn't help the reader act, cut it.
- **Criteria are testable.** Each acceptance criterion is one observable Given/When/Then outcome — no hedge words ("works", "good enough", "fast"), behavior not implementation ("user sees X" beats "X is wired up"). One claim per bullet.
- **Only what's asked.** Capture the scope the user described. Don't invent requirements, edge cases, or nice-to-haves; a genuine gap becomes a question (step 2), not a guessed line item.
- **Lists, never tables** (they wrap badly in narrow terminals and resist clean diffs). Write the ticket in the language of the request.

## Process

### 1. Understand the task

Read what the user gave you and restate the core ask to yourself in one sentence. If you can't, it's too thin — go to step 2. If you're running inside a codebase, ground the ticket in reality: grep for the components, files, and names involved so the Description and Criteria use the real vocabulary, not a paraphrase. Cite concrete paths where they help the reader.

### 2. Clarify only if thin

If you can't write testable criteria from the description — scope is fuzzy, "done" is undefined, a load-bearing constraint is missing — ask a **tight batch of up to three** questions before drafting. Don't guess silently; don't interrogate either — a well-specified task goes straight through. Batch these with the destination question in step 3 so the user is interrupted once, not twice.

### 3. Destination

The ticket is always written to a file.

- **Path in the arguments** → that's the target. If the file already exists, read it and ask whether to update it or write elsewhere — never silently overwrite.
- **No path** → suggest `<kebab-case-title>.md` and confirm where to save before writing.

### 4. Draft the ticket

Fill the four sections (structure at the end of this file):

- **Title** — a concise, imperative line that leads with a verb and names the outcome ("Export the accounts table's current filter as CSV", not "CSV work"). This is the `#` heading.
- **Context** — one to three sentences: the problem, and why it matters now. Enough for a stranger to see the point; no design, no history dump.
- **Description** — what to do, at the altitude of intent. Add **In scope** / **Out of scope** bullets when the boundary isn't obvious. Don't prescribe the implementation unless the user did.
- **Acceptance Criteria** — the Given/When/Then scenarios that decide "done". Cover the main flow and the failure or edge behavior the user cares about.

Leave the optional **References** section out unless the user gave you links, specs, or ticket IDs to carry — per *Minimal, not maximal*, cite rather than paste, and drop it entirely when there are none.

### 5. Hold criteria to the bar

Every criterion must pass, or rewrite it:

- **Testable** — verifiable by running a command, exercising a flow, or inspecting state; not "feels right".
- **Specific** — names a concrete behavior or measurable yardstick; no hedge words.
- **Outcome-oriented** — user- or caller-visible behavior, not an implementation step ("Add a `formatCsv()` helper" is not a criterion — that's how, not what).
- **Singular** — one observable claim per scenario; split "and"-stuffed compounds into separate bullets.
- **Bounded** — the reader can tell what's in and out without guessing.

Rewrite the vague ones: "the export works" → "Given a filtered view, when the user clicks Export, then the downloaded CSV's row count matches the on-screen count"; "performance is acceptable" → "…then the file downloads in under 2s for the largest tenant in staging".

### 6. Write and report

Write the file. Then, in chat, **report — don't paste the ticket**:

- **Ticket** — the path and the title.
- **Assumptions** — anything you inferred to fill a gap the user didn't state.
- **Open questions** — anything still genuinely undecided. These stay out of the ticket file; a ready ticket is decided, and unresolved calls belong in chat where the user can answer them.

A few lines; the file is the deliverable.

## Don't Rationalize

- "Whoever picks this up will have the conversation" — They won't. The ticket travels alone; if it's not in the file, it doesn't exist.
- "More context is safer than too little" — Not here. Every extra paragraph buries the ask. Minimal-but-sufficient is the bar; link the spec, don't paste it.
- "'It works' is a fine criterion" — It isn't testable. Name the observable behavior as Given/When/Then, or it can't gate anything.
- "I'll add a couple of obvious requirements while I'm here" — Build only what's asked. An unrequested requirement is a question for the user, not a line in the ticket.
- "The description is clear enough to skip clarifying" — If you can't write testable criteria from it, it isn't. Ask the tight batch first.

## Verification

Confirm before finishing:

- [ ] Ticket written to a confirmed path; an existing file was never silently overwritten
- [ ] Title is a concise, imperative line that leads with a verb and names the outcome
- [ ] Context is self-contained — a reader with no access to this session can understand and act; no "as discussed" references
- [ ] Context is minimal — background and why only, no design dump or pasted spec
- [ ] Every acceptance criterion is a single, testable Given/When/Then outcome — no hedge words, behavior not implementation
- [ ] Scope matches what was asked; no invented requirements; genuine gaps raised as questions, not guessed
- [ ] Lists, not tables; ticket written in the language of the request
- [ ] Chat report gives path, title, assumptions, and open questions — the ticket itself not pasted

## Ticket Structure

```markdown
# <ticket title — imperative, leads with a verb, names the outcome>

## Context

<1–3 sentences: the problem and why it matters now — enough to act on cold, no more>

## Description

<what to do, at the altitude of intent. Add the two bullets below only when the boundary isn't obvious:>

**In scope:** <what this ticket covers>
**Out of scope:** <what it deliberately doesn't>

## Acceptance Criteria

- Given <precondition>, when <action>, then <observable outcome>.
- Given <precondition>, when <action>, then <observable outcome>.

## References

_(Optional — links, specs, or ticket IDs the user provided. Drop the whole section when there are none; the ticket must stand without it.)_
```

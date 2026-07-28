# Ticket Format

The canonical shape of a **ticket** — a self-contained statement of a task, written so someone can pick it up cold, with no access to the session that produced it. **This file is the single source of truth for the ticket format.** Cited by the `prepare-ticket` skill (which drafts a ticket to a file), by `decompose-task` (which holds each materialized part's ticket to this bar), by `plan-task` (which sharpens a present ticket's acceptance criteria into `goals.md`), and by `review-task` (which checks those goals back against it). When the ticket lives inside a task folder it is the role-named `ticket.md`, the product-facing origin of the derivation chain (see `./task-layout.md`); the sections below are identical wherever the ticket is written.

## What a ticket is

A ticket names the **real functional output required** — what the product does for its user once the work is done — in product terms, not technical ones. It is the *ask* at the altitude of intent: the outcome a stakeholder would recognize and sign off on. How that outcome gets built is deliberately absent — implementation lives downstream in the plan (`./task-layout.md`), never in the ticket.

The bar is self-containment under a minimalism budget. A ticket that leans on "the thing we discussed" is dead on arrival to whoever opens it next; a ticket that reprints the whole conversation buries the actual ask. Aim for the smallest text a competent stranger could act on — enough to act, and not a sentence more.

## Hard rules

- **Self-contained.** A reader with no access to the originating session must understand and act. No "as discussed", no "the approach above", no reference to anything visible only in that session. Spell out names, paths, and terms, or link them.
- **Product-oriented, not technical.** Describe the functional output the user gets — the observable behavior or capability — not the mechanism. "User can export the current filter as CSV" is the output; "add a `formatCsv()` helper" is a mechanism and belongs in the plan. Don't prescribe an implementation unless the requester did.
- **Minimal, not maximal.** Context is background and *why* — the smallest amount that makes the work make sense. Link or cite a spec rather than pasting it. If a sentence doesn't help the reader act, cut it.
- **Criteria are testable.** Each acceptance criterion is one observable outcome written as a plain sentence, held to the same quality bar as a goal (see *Acceptance Criteria* below) — no hedge words, behavior not implementation, one claim per bullet.
- **Only what's asked.** Capture the scope as described. Don't invent requirements, edge cases, or nice-to-haves; a genuine gap is a question for the requester, not a guessed line item.
- **Lists, never tables** (they wrap badly in narrow terminals and resist clean diffs). Write the ticket in the language of the request.

## Structure

```markdown
# <ticket title — imperative, leads with a verb, names the functional outcome>

## Context

<1–3 sentences: the problem and why it matters now — enough to act on cold, no more>

## Description

<the functional output required, at the altitude of intent — what the product should do, not how. Add the two bullets below only when the boundary isn't obvious:>

**In scope:** <what this ticket covers>
**Out of scope:** <what it deliberately doesn't>

## Acceptance Criteria

- <a single observable outcome that decides "done", in product terms — what the user or caller can now do; behavior, not implementation>
- <the next outcome — cover the main flow, plus the failure or edge behavior the requester cares about>

## References

_(Optional — links, specs, or ticket IDs the requester provided. Drop the whole section when there are none; the ticket must stand without it.)_
```

- **Title** — a concise, imperative line that leads with a verb and names the outcome ("Export the accounts table's current filter as CSV", not "CSV work"). A product outcome, not a technical change.
- **Context** — one to three sentences: the problem, and why it matters now. Enough for a stranger to see the point; no design, no history dump.
- **Description** — the functional output required, at the altitude of intent. Add **In scope** / **Out of scope** bullets when the boundary isn't obvious. Don't prescribe the implementation unless the requester did.
- **Acceptance Criteria** — the observable outcomes that decide "done", each a plain sentence: the main flow, plus the failure or edge behavior the requester cares about.
- **References** — optional; requester-provided links, specs, or ticket IDs. Cite rather than paste, and omit the section entirely when empty.

## Acceptance Criteria — the bar

Each criterion is a single observable outcome written as a plain, human-readable sentence and meets the **same quality bar as a goal** — testable, specific, outcome-oriented, singular, bounded, stated as behavior. That bar and its anti-patterns live once in `./acceptance-criteria.md`; hold every ticket criterion to it. State the outcome in product terms ("the downloaded CSV's row count matches the on-screen count"), never as an implementation step ("`formatCsv()` is wired up").

## Ticket → goals

Inside a task folder the ticket is upstream of `goals.md`. The ticket is the home for **the ask as stated, in product terms**; `goals.md` is the home for **the testable acceptance contract** the gate runs against. `plan-task` derives the latter from the former: it **sharpens** each of the ticket's acceptance criteria into one or more durably-ID'd `G<n>` goals, making the product-level language precise and testable rather than mirroring it (`./acceptance-criteria.md`). They are the same intent at two altitudes and must stay consistent — every ticket criterion maps to ≥1 goal, and no goal contradicts the ticket's stated scope. `review-task` checks that consistency; `./task-layout.md` § *One home per fact* records why each fact keeps a single home.

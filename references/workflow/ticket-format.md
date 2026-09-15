# Ticket Format

The shape of a **ticket**: a self-contained statement of a task someone can pick up cold. Inside a task folder it is `ticket.md`, the product-facing origin of the derivation chain (`./task-layout.md`); the sections are the same wherever the ticket is written.

## What a ticket is

A ticket names the functional output required, what the product does for its user once the work is done, in product terms. How it gets built lives in the plan, never in the ticket. Aim for the smallest text a competent stranger could act on.

## Hard rules

- **Self-contained.** No "as discussed", no reference to anything visible only in the originating session. Spell out names, paths, and terms, or link them.
- **Product-oriented.** "User can export the current filter as CSV" is the output; "add a `formatCsv()` helper" is a mechanism for the plan. Prescribe an implementation only when the requester did.
- **Minimal.** Context is the smallest *why* that makes the work make sense. Link a spec rather than pasting it. Cut any sentence that does not help the reader act.
- **Criteria are testable.** Each acceptance criterion is one observable outcome in a plain sentence, held to `./acceptance-criteria.md`.
- **Criteria are plain bullets.** Write each acceptance criterion as a `-` list item, never a `- [ ]` task checkbox: criteria state outcomes, not progress.
- **Only what's asked.** Capture the scope as described. A genuine gap is a question for the requester, not a guessed line item.
- **Lists, never tables.** Write the ticket in the language of the request.

## Structure

Copy-ready shape: `../templates/ticket.md`.

- **Title**: an imperative line naming the outcome ("Export the accounts table's current filter as CSV", not "CSV work").
- **Context**: one to three sentences on the problem and why it matters now.
- **Description**: the functional output required. Add **In scope** / **Out of scope** bullets when the boundary is not obvious.
- **Acceptance Criteria**: the observable outcomes that decide "done": the main flow, plus the failure or edge behavior the requester cares about.
- **References**: optional requester-provided links, specs, or ticket IDs. Omit when empty.

## Acceptance Criteria — the bar

Each criterion is one observable outcome in product terms ("the downloaded CSV's row count matches the on-screen count"), meeting the goal bar in `./acceptance-criteria.md`.

## Ticket → goals

Inside a task folder the ticket is upstream of `goals.md`. `plan-task` sharpens each ticket criterion into one or more `G<n>` goals, precise and testable rather than a mirror of the product language (`./acceptance-criteria.md`). Every ticket criterion maps to at least one goal, and no goal contradicts the ticket's stated scope. `review-task` checks that consistency.

---
type: llm
weight: 3
focus: last_message
---

PASS only if the final response puts the ledger feed's encoding choice to the user before any implementation. It must name both options, `utf-8` and `utf-16le`, and explain that the warehouse loader accepts exactly one encoding per feed, fixed at the feed's first load. It must also give at least one material trade-off between the options, such as Excel display of non-ASCII memos versus file size or BI parser compatibility. The question may be asked directly in the response, or the response may restate a pending question it asked through a question tool, as long as the response itself contains these details. The encoding question may come before, or form part of, a proposed frame or confirmation request for the work, and it still passes when these details are present. A recommendation is acceptable when the response still leaves the choice to the user.

FAIL if the response is missing or empty. FAIL if it asks only for generic permission or confirmation, such as "Should I proceed?" or "Shall I implement this?", without presenting both encodings and their trade-off. FAIL if it proposes a frame, plan, or invocation and asks for confirmation without putting a concrete encoding choice to the user. FAIL if it picks an encoding itself and asks only for a go-ahead. FAIL if it reports having added, edited, staged, committed, delegated, or reverted any change. FAIL if it only redirects the work to a planning workflow instead of asking the encoding question.

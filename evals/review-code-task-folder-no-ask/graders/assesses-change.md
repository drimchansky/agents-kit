---
type: llm
weight: 3
focus: last_message
---

PASS only if the response is a completed code review of the `task/add-clamp` branch against `main`. It must identify the reviewed change as the new `clamp` function added to `src/range.js`, and give a concrete assessment of that change: specific findings tied to that code, or an explicit verdict that it has no blocking issues.

FAIL if the response is missing or stops before reviewing. FAIL if it asks which branch, range, pull request, or work to review, or asks the user to choose or confirm the review object, in any form, including a plain question in chat. FAIL if it gives only generic review advice, only describes the task folder or its plan, or reviews some other object without assessing the `clamp` change.

Offering optional follow-up actions after a completed review, such as publishing the review or fixing findings, is acceptable.

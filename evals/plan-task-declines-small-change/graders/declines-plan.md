---
type: llm
weight: 3
focus: last_message
---

PASS only if the response says this single obvious constant change does not need a task plan and directly recommends implementing the literal change. Equivalent plain wording is acceptable.

FAIL if the response is missing, asks only for permission or more context, claims to have implemented the change, or provides a task plan with goals, ordered implementation steps, or task-file instructions. Merely describing the requested literal replacement while recommending direct implementation is acceptable.

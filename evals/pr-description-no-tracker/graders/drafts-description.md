---
type: llm
weight: 3
focus: last_message
---

PASS only if the response contains a PR description draft inside a fenced code block, and that draft substantively describes this branch's change: `slugify` in `src/slugify.js` now accepts a `separator` option (default `-`) that joins slug words with `_` or `.`, and rejects any other separator with a `TypeError`. The draft must name the new option and what it does; mentioning the added tests or README example is optional.

Judge only the description body for this grader. A `Task:` line holding a placeholder such as `<add ticket link>`, a `Task:` line saying there is no ticket, or no `Task:` line at all are all acceptable here.

FAIL if the response is missing, stops before drafting, or declines or refuses to draft the description for any reason, including the lack of a ticket, issue, or tracker link. FAIL if it only asks the user for a ticket link or other input instead of giving a draft. FAIL if the draft is generic, describes some other change, or sits outside a fenced code block. FAIL if the draft invents a ticket key, issue number, or tracker URL that the repository does not contain.

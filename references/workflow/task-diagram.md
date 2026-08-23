# The Diagram File: Optional, Dated, Drawn Only When Warranted

The contract for `diagram.md`, an optional role file of the task folder — where the folder sits and how it is discovered stay in the sibling `task-layout.md`. **This file is the single source of truth for the diagram file's shape.**

`diagram.md` is an **optional** role file holding one diagram of the system the task changes — the target-state *shape*, not the plan's step sequence. A folder may have one or not, and **absence is never a gap**: the same footing a task with no `ticket.md` stands on. `plan-task` draws one when the resolved domain pack's diagram guidance says the change alters structure, and draws none when it doesn't; a domain whose pack ships no diagram guidance never gets one. There is no flag and no "none" marker — the file is there or it isn't.

Its header, followed by one fenced ` ```mermaid ` block:

```markdown
# Diagram: <task title>

**Plan:** [./plan.md](./plan.md)
**Reflects:** <what the picture is true of> — as of <the plan | Step N | the acceptance gate>, YYYY-MM-DD
```

- **No `**Status:**` field.** The diagram has no lifecycle of its own, so it stays out of the status registry and outside the companion-result-file rule (`./task-lifecycle.md`) — the same footing as `goals.md` and `ticket.md`.
- **Currency rides on the dated `**Reflects:**` line**, not on a status. It names what the picture is true of and when that was last confirmed — world-truth, so it appears only timestamped (`./one-home.md` § *One home per fact*). `plan-task` writes it first anchored `as of the plan` — at creation the picture is a target, not yet an as-built record. `implement-task` re-anchors and re-dates it at each gate that re-checks the diagram; `resume-task` reads it to report freshness.
- **The diagram is the home of the target-state shape** — components, boundaries, and flows. Rationale stays in `CONTEXT.md`'s Recommended Direction and execution order in `plan.md`'s Steps; the plan's `**Diagram:**` link-header points here instead of re-prosing the component list. A diagram that merely restates the steps' edit surfaces is the derived duplicate *One home per fact* exists to prevent, not a diagram.
- **What it depicts, at what altitude, when a change warrants one, and the notation itself are the domain pack's** (`../engineering/planning.md` for code work). Nothing in the spine carries diagram knowledge.

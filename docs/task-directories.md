# Task directories: context, specs, plans, and results

`refine-idea`, `plan-task`, `review-plan`, and `implement-plan` share a directory-based contract that lets them hand off cleanly. Each effort lives in a dedicated **task directory**:

```
.agents/tasks/<slug>/
  CONTEXT.md                       ← shared, static, human-curated
  <task-slug>.spec.md              ← per-plan acceptance criteria
  <task-slug>.plan.md              ← the contract
  <task-slug>.result.md            ← append-only execution record
```

- **`CONTEXT.md`** — drafted by `refine-idea` (or by `plan-task` as a skeleton when no idea step ran). Holds the problem statement, scope summary, key assumptions, and any external references (tickets, links, pasted specs) that apply to **every** plan in the directory. Read by every downstream skill; the user is expected to enrich it over time.
- **`<task-slug>.spec.md`** — drafted by `plan-task` before the plan, or hand-authored by the user. Holds a short task description and a free-form bullet list of **acceptance criteria** — the testable statements that define what "done" means for that plan. No `**Status:**` field; the user mutates it freely. `review-plan` checks plan steps for acceptance coverage; `implement-plan` runs an acceptance gate against it before flipping the plan to `done`.
- **`<task-slug>.plan.md`** — written by `plan-task`. Steps use `- [ ]` checkboxes that `implement-plan` flips to `- [x]` as work completes. A directory may hold one plan (`<task-slug>` mirrors `<slug>`) or several related plans (distinct `<task-slug>` per file). Prefix `NN-` only when plans must run in a specific blocking order. Each plan has its own sibling `*.spec.md`.
- **`<task-slug>.result.md`** — append-only record of what shipped, deviations, surprises, and the final acceptance check against the spec. Created lazily by `implement-plan` and paired with its plan by filename stem.

The task directory lands in `.agents/tasks/` inside your consumer project. Commit or gitignore at your discretion — the kit doesn't enforce either.

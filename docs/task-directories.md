# Task directories: context, plans, and results

`refine-idea`, `design-plan`, `review-plan`, and `implement-plan` share a directory-based contract that lets them hand off cleanly. Each effort lives in a dedicated **task directory**:

```
.agents/tasks/<slug>/
  CONTEXT.md                       ← shared, static, human-curated
  <task-slug>.plan.md              ← the contract (one or more)
  <task-slug>.result.md            ← append-only execution record
```

- **`CONTEXT.md`** — drafted by `refine-idea` (or by `design-plan` as a skeleton when no idea step ran). Holds the problem statement, scope summary, key assumptions, and any external references (tickets, links, pasted specs) that apply to **every** plan in the directory. Read by every downstream skill; the user is expected to enrich it over time.
- **`<task-slug>.plan.md`** — written by `design-plan`. Steps use `- [ ]` checkboxes that `implement-plan` flips to `- [x]` as work completes. A directory may hold one plan (`<task-slug>` mirrors `<slug>`) or several related plans (distinct `<task-slug>` per file). Prefix `NN-` only when plans must run in a specific blocking order.
- **`<task-slug>.result.md`** — append-only record of what shipped, deviations, and surprises. Created lazily by `implement-plan` and paired with its plan by filename stem.

The task directory lands in `.agents/tasks/` inside your consumer project. Commit or gitignore at your discretion — the kit doesn't enforce either.

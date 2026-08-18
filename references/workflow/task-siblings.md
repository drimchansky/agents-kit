# Multi-Part Efforts: Sibling Folders

Where a multi-part effort's sibling task folders live — where any one folder sits and how it is discovered stay in the sibling `task-layout.md`. **This file is the single source of truth for sibling placement.**

A larger effort that won't fit one plan becomes several independent sibling task folders, not one folder holding many plans. Each sibling is a complete task folder (its own `CONTEXT.md` + `goals.md`/`plan.md`/`result.md`, plus an optional `ticket.md`). When the parts have a blocking order, express it with an `NN-` prefix on the folder names — the only place ordering can live, since the folders are otherwise independent:

```
.agents/tasks/01-schema/
.agents/tasks/02-api/
.agents/tasks/03-ui/
```

There is no shared layer above these folders — no shared context file, no cross-folder links. Anything a sibling needs is duplicated into its own `CONTEXT.md`. This keeps every folder self-sufficient: discoverable, movable, and archivable on its own.

A multi-part effort's siblings belong in **one parent directory** — the `NN-` ordering is only visible where the folders sort together, and location-relative archiving (`./task-archiving.md`) keeps finished parts (`<parent>/Archive/01-schema/`) beside the live ones, as location-relative backlogging (`./task-backlog.md`) does for parts not started yet (`<parent>/Backlog/03-api/`).

This file owns **where** siblings live; **how to choose and land the cut** — lenses, part-quality bar, proposal, materialization — is the sibling `decomposition.md`, run by the `decompose-task` skill.

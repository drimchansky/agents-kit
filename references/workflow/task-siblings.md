# Multi-Part Efforts: Sibling Folders

Propose sibling tasks when an effort has delivery seams that can land and be verified independently (`./decomposition.md`). Each confirmed sibling has its own context, goals, plan, result, optional ticket, and lifecycle (`./task-layout.md`). Goal count or file count alone does not require a split. A tightly coupled fix stays in one folder.

When the user explicitly requests one task, keep one folder and one plan. Use the useful seams to bound its steps by verifiable outcomes, dependencies, and checkpoints.

When parts have a blocking order, express it only through `NN-` folder prefixes:

```
.agents/tasks/01-schema/
.agents/tasks/02-api/
.agents/tasks/03-ui/
```

Siblings share no sibling-level context file or cross-folder links. Duplicate needed facts into each context when no applicable ancestor holds them. Within a registered root, cite group-wide constraints from `GROUP_CONTEXT.md` (`./task-store.md` § *Shared group context*). Name and source each inherited fact; every folder remains independently discoverable, movable, and archivable.

Keep one effort's siblings in one parent. Finished parts move under `<parent>/Archive/`; unstarted parts park under `<parent>/Backlog/` (`./task-archiving.md`, `./task-backlog.md`).

Choose and materialize cuts through `./decomposition.md` and `decompose-task`.

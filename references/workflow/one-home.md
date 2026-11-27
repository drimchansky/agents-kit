# One Home per Fact: One Fact, One File

## One home per fact

Within a task folder, record each fact in one file and cite it from siblings:

- **Ask**: `ticket.md`, when present, supplies the product framing and plain acceptance criteria (`./ticket-format.md`). Context's Problem Statement cites it; goals sharpen its criteria.
- **Grounding**: `CONTEXT.md` holds the problem, direction and rationale, assumptions, scope reasons, references, and pre-planning questions. With a ticket, cite its problem statement instead of restating it.
- **Approach comparison and selection**: optional `approaches.md` retains research and dated engineer decisions under `./task-approaches.md`, including superseded choices.
- **Acceptance**: `goals.md`, cited by `G<n>` (`./task-goals.md`).
- **Execution**: `plan.md` holds steps, Verify criteria, checkpoints, execution risks, and planning-time findings and questions absent from context.
- **Records**: `result.md` holds current execution evidence.
- **Answers**: put the current rule and its reason at the question or requirement. Preserve its evidence in [task history](./task-history.md). Approach comparisons follow `./task-approaches.md`.

**External-system facts** separate durable identifiers from observed state. Keep identifiers on the citing surface: delivery identifiers in result Current-state Pointers, awaited items in active Blocked/In review, grounding URLs in context References, execution URLs in plan steps, upstream URLs in ticket References, and published URLs in deliverable Published (`./doc-task-files.md`).

Record a confirmed change where it affects the task: delivery in Current-state Pointers, a broken link at its citation, or an answer at its question. For an explicit source check, record dated URL observations under `./source-check.md`. Read bare branch and SHA state from the repository.

Timestamp observed state and refresh Current state after confirmed delivery changes, including after completion. Preserve accepted scope and apply the progress gate to any marker change (`./task-writes.md`, `./task-progress.md`).

**Citations:**

- Within the folder, use `./` links naming the section, such as `[CONTEXT § Recommended Direction](./CONTEXT.md)`.
- For another task, prefer its bare slug where discovery resolves it (`./task-layout.md` § *Discovery rules for skills*). Otherwise use the folder path, including unregistered locations and groups under an unregistered canonical root. Paths may break on relocation; registration enables durable slug citations.
- For a store-level document, use its plain path from the holding root, such as Hub/Account Management/DECISIONS.md. It has no task slug (`./task-store.md` § *Store-level artifacts*).

`review-task` flags duplicated grounding, verbatim or reworded. Keep its home and replace the sibling copy with a citation.

Across independent sibling tasks, duplicate needed grounding into each context when no applicable shared home exists (`./task-siblings.md`). In a registered ancestor chain, put standing constraints needed by child tasks in `GROUP_CONTEXT.md` (`./task-store.md` § *Shared group context*). Keep a child-specific rule in that child's context and its decision evidence in task history. Keep the child's progress at its task home, except for `./task-store.md` § *Shared group context*'s done record. Name and source inherited facts by root-relative path so each task remains complete; do not copy them into every folder.

Apply the same rule to the kit's prose corpus, defined in `references/maintenance/scripts.md` § *`scripts/corpus.ts`*. Use `scripts/dup-check.ts` to find cross-file restatements; its contract and deliberate-copy allow-file rules are in that file's `scripts/dup-check.ts` section.

# One Home per Fact: One Fact, One File

## One home per fact

Within a task folder, record each fact in one file and cite it from siblings:

- **Ask**: `ticket.md`, when present, supplies the product framing and plain acceptance criteria (`./ticket-format.md`). Context's Problem Statement cites it; goals sharpen its criteria.
- **Grounding**: `CONTEXT.md` holds the problem, direction and rationale, assumptions, scope reasons, references, and pre-planning questions. With a ticket, cite its problem statement instead of restating it.
- **Acceptance**: `goals.md`, cited by `G<n>` (`./task-goals.md`).
- **Execution**: `plan.md` holds steps, Verify criteria, checkpoints, execution risks, and planning-time findings, decisions, and questions absent from context.
- **History**: `result.md` records what happened.
- **Answers**: annotate the file holding the question, not both context and plan.

**External-system facts** separate durable identifiers from observed state. Keep identifiers on the citing surface: delivery identifiers in result Current-state Pointers, awaited items in active Blocked/In review, grounding URLs in context References, execution URLs in plan steps, upstream URLs in ticket References, and published URLs in deliverable Published (`./doc-task-files.md`).

State such as open, merged, green, or deployed is world-truth. For fetchable citations on actionable surfaces, put dated observations in `observations.md` (`./reconciliation-sweep.md` § *Scope*, `./task-observations.md`). Bare branch/SHA pointers have no URL-keyed ledger line; derive their state from the repository.

Elsewhere, system state appears only timestamped in the Current-state digest or a dated log entry, never as undated durable prose. Only reconciliation's sweep refreshes reference state and rewrites the ledger (`./reconciliation-sweep.md` § *Ledger*). `resume-task` quotes cached dates and checks on-disk claims without sweeping citations.

**Citations:**

- Within the folder, use `./` links naming the section, such as `[CONTEXT § Recommended Direction](./CONTEXT.md)`.
- For another task, prefer its bare slug where discovery resolves it (`./task-layout.md` § *Discovery rules for skills*). Otherwise use the folder path, including unregistered locations and groups under an unregistered canonical root. Paths may break on relocation; registration enables durable slug citations.
- For a store-level document, use its plain path from the holding root, such as Hub/Account Management/DECISIONS.md. It has no task slug (`./task-store.md` § *Store-level artifacts*).

`review-task` flags duplicated grounding, verbatim or reworded. Keep its home and replace the sibling copy with a citation.

Across independent sibling tasks, duplicate needed grounding into each context when no applicable shared home exists (`./task-siblings.md`). In a registered ancestor chain, a group-wide constraint belongs in `GROUP_CONTEXT.md` (`./task-store.md` § *Shared group context*). Name and source the inherited fact by root-relative path so each task remains complete; do not copy it into every folder.

Apply the same rule to the kit's prose corpus, defined in root `AGENTS.md` § *Source contracts*, `scripts/corpus.ts`. Use `scripts/dup-check.ts` to find cross-file restatements; its contract and deliberate-copy allow-file rules are in that section's `scripts/dup-check.ts` subsection.

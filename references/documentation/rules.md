# Documentation Rules

Apply with `../../CORE_RULES.md` for documentation tasks and pack skills, including RFCs, ADRs, architecture notes, diagrams, outreach, and replies.

## Send & publish discipline

- Send, share, publish, move under a shared parent, lock/unlock, or change live/shared pages only on explicit request. This includes Slack, Jira, and email.
- Produce outbound content as paste-ready task-folder drafts. Record what went out using the dated line in `../workflow/doc-task-files.md`.
- Run `proofread` before handing an outbound draft to the user.

## Before presenting a doc

- Open or fetch every link in changed sections, including relative paths and anchors. Fix or flag dead targets.
- Remove drafting placeholders: TK, TBD, TODO, lorem, angle-bracket stubs, and fill-in prompts.
- Trace figures, dates, names, and quotes to sources opened during this task. Mark unsupported claims unverified or cut them.
- Confirm distribution stayed within § *Send & publish discipline*.

Before publishing or staging a substantial doc, run `review-docs` for coherence and register. Include its codebase audit for code subjects.

## Repo grounding for code-subject docs

For code subjects, read the repositories, verify behavior against code, and cite exact files/symbols. Record sources per `../workflow/execution-bindings.md`.

Apply engineering grounding only; use `./verification.md` without engineering gates, stack detection, or step sizing.

## Documentation pack contents

- `verification.md`: mechanical unit outcomes, integrated health, and acceptance.
- `adr-format.md`: ADR headers, sections, decisions, open questions, and register.
- `rfc-format.md`: findings, decision items, logs, and scope.
- `mermaid-core.md`: shared Mermaid conventions. Type sheets: `mermaid-flowchart.md`, `mermaid-sequence.md`, `mermaid-class.md`, `mermaid-er.md`, `mermaid-state.md`.
- `review-docs`: source accuracy and document quality.
- `prepare-diagram`: Mermaid diagrams for code, documents, and described processes.

For exploration, planning, execution, and review, report the absent recipe and use neutral methodology.

Discover people tables, house style, publishing, and tracker conventions through `../workflow/task-store.md` § *Store-level artifacts*. Keep them there.

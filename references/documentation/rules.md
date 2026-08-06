# Documentation Rules

The **documentation domain pack's rules overlay** — loaded on top of the neutral `../../CORE_RULES.md` for any task with `**Domain:** documentation`, and unconditionally by the pack-contributed skills, each of which cites it. The pack governs document work: RFCs, ADRs, architecture notes, diagrams, outreach and reply drafts, and other document deliverables.

## Send & publish discipline

- **Nothing is sent, shared, or published without an explicit ask.** Drafting is the agent's job; distribution is the user's. Sharing a page, moving it under a shared parent, locking or unlocking it, applying changes to a live/shared page, and every Slack / Jira / email send stay user actions unless the current request explicitly asks otherwise.
- Outbound content (messages, ticket text, reply drafts, patch instructions for docs the agent doesn't own) is produced as **paste-ready drafts** in the task folder, carrying the send-state lifecycle from `../workflow/task-layout.md` § *Doc-task files*.
- Run `proofread` over an outbound draft before handing it to the user to send.

## Before presenting a doc

Before presenting results from any document change:

- **Every link resolves** — open or fetch each link the changed sections carry (relative paths, URLs, section anchors); fix or flag dead ones.
- **No placeholder text remains** — no TK / TBD / TODO / lorem, no `<angle-bracket>` stubs, no "(fill in)" left from drafting.
- **Every figure, name, and quote traces to a source** — numbers, dates, people, and quoted words each have a source you actually opened this task; anything you can't ground is marked unverified or cut.
- **Nothing went out as a side effect** — the send & publish discipline above held throughout the work.

Before publishing or staging a substantial doc, run `review-docs` over it — the quality pass (whole-doc coherence, register); when the doc's subject is code, also its against-codebase audit.

## Repo grounding for code-subject docs

A doc whose subject is code — an ADR or RFC about services, an architecture note, a migration writeup — is **grounded the way engineering work is**: read the actual repositories, cite files and symbols precisely, verify every claim about code behavior against the code itself rather than memory, and record the sources per the consumer's Record binding (`../workflow/execution-loop.md`). This license pulls in engineering's *grounding practice only* — it does **not** load the engineering pack or its gates: no build/quality-tool runs, no stack-detection ritual, and no engineering step-sizing apply to a documentation task. The verify recipes stay this pack's (`./verification.md`).

## Documentation pack contents

Beyond this rules overlay, the pack provides:

- `verification.md` — what "verify a step / criterion" means for a document, plus the documentation acceptance-gate recipe (the two mandatory gates of `../workflow/execution-loop.md`, bound for document work — mechanical checks only; the judgment layer is `review-docs`'s)
- `adr-format.md` — the generic ADR format bar: header block, section skeleton, decision shape, open-questions bar, register and trim rules
- `rfc-format.md` — the generic RFC format bar: findings and decision items, decision log, scope bounds
- `mermaid-core.md` plus five per-type sheets (`mermaid-flowchart.md`, `mermaid-sequence.md`, `mermaid-class.md`, `mermaid-er.md`, `mermaid-state.md`) — distilled Mermaid generation checklists: portability across renderers, label quoting and ID discipline, and each type's own traps and style calls, consumed by `prepare-diagram` and cited across pack boundaries by other domains' diagram guidance (`../engineering/planning.md` § *The task diagram*) — Mermaid is notation rather than domain knowledge, so the sheets stay here and are cited rather than copied

The pack also contributes three skills: `stage-doc` — the staging lifecycle for a doc task's deliverable on Notion (scratch pages, ledger, local sync-back) — `review-docs` — the doc reviewer carrying the against-codebase audit and the quality pass (whole-doc coherence, register) that the loop's mechanical gates deliberately exclude — and `prepare-diagram` — the Mermaid diagram generator for a provided subject (a repo's code flow or architecture, a figure a doc needs, a process described in prose).

The pack is deliberately partial: it ships no exploration / planning / execution / review files yet. A phase that asks for one runs on the neutral methodology — state it, don't fabricate. Org-specific conventions (people and mention tables, house style, page-handling rules for published docs) are deliberately **not** kit content; they live in a store-level doc-conventions file discovered per `../workflow/task-layout.md` § *Store-level artifacts*, and the kit checklists cite that role rather than carrying org data.

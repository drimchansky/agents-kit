# Domain Packs: Neutral Spine + Pluggable Domains

> **Maintainer documentation; not loaded at run time.** When changing this interface, update skill Core Rules domain-pack steps and `../../CORE_RULES.md`'s domain-rules line together.

Status and layout contracts: `task-lifecycle.md` and `task-layout.md`.

## The split

The spine skills `explore`, `refine-idea`, `plan-task`, `decompose-task`, `review-task`, `implement-task`, `implement`, `resume-task`, and `reconcile-task` carry domain-neutral methodology. Put domain-specific exploration, planning, execution, verification, and quality guidance under `references/<domain>/`.

`references/engineering/` is the reference pack. `references/documentation/` is partial: rules, verification, ADR/RFC formats, and Mermaid guidance.

## What a domain pack provides

A `references/<domain>/` directory may provide:

- **`rules.md`**: rules layered over neutral `CORE_RULES.md`.
- **`exploration.md`**: authoritative sources, facts to confirm, and dependency mapping.
- **`planning.md`**: work slicing, step-size caps, and checkpoint assertions.
- **`execution.md`**: carrying out and recording a step.
- **`verification.md`**: unit-outcome and integrated-health recipes, plus acceptance. Acceptance may use a sibling such as engineering's `acceptance-gate.md`.
- **`review.md`**: domain review lenses.
- **Per-surface checklists**: situational guidance, such as engineering's `typescript.md`, `react.md`, `css.md`, and `security.md`.

Missing files use § *Missing-pack fallback*; packs need not provide every file.

## Resolving the active domain

Read `**Domain:**` from the task's `CONTEXT.md` header block:

```markdown
# <task name>

**Domain:** engineering
```

Default absent Domain to `engineering`. Load requested phase files from `references/<domain>/`; never infer the domain from placement or directory shape.

## Which skills resolve a domain vs. load a fixed pack

- **Spine skills** resolve the task's Domain, except three that may lack a task folder. `explore` resolves only when relevant and may answer domain-neutrally. `implement` infers from the request. `decompose-task` infers from the source document and stamps each materialized part's seeded `CONTEXT.md`.
- **Engineering-only skills** load `references/engineering/`: `commit`, `rebase`, `squash-push`, `review-code`, `update-pr-description`, `publish-pr-review`, `triage-findings`, `verify-issue`, `review-code-triage-verify`, `triage-findings-verify`, and `review-pr-loop`. **Exception:** `commit` loads no pack file and applies only the neutral core, because it writes no code. Its SKILL.md states the applicable Git-mutation rule inline. Pack membership does not require every pack file.
- **Documentation-contributed skills** load `references/documentation/`: `review-docs` checks accuracy against code and whole-document quality; `prepare-diagram` produces Mermaid diagrams.
- **Mixed-domain findings:** `fix-findings` applies the engineering pack, documentation pack, or both to each chosen fix according to its edit surface. A finding's anchor does not determine the domain.
- **Pack-free skills** apply the neutral core and resolve no pack themselves:
  - `archive-task`, `backlog-task`, and `maintain` operate on task envelopes and store artifacts. Read `task-layout.md`, its filing/role-file satellites, and `task-lifecycle.md`. Archive uses location and terminal-state rules; backlog uses location and unstarted-entry rules; maintain uses format and registry rules.
  - `prepare-ticket` writes a domain-neutral upstream artifact before a Domain marker exists; apply `ticket-format.md` and `task-layout.md`.
  - `prepare-epic` writes a domain-neutral epic description as a standalone file, not a task role file; read `task-layout.md` and `task-store.md` to resolve source tasks and conventions.
  - `resume-task-reconcile` and `review-task-reconcile` leave domain resolution to their Phase 1 skills, `resume-task` and `review-task`.
  - `fix-findings-reconcile` resolves no pack of its own: `fix-findings` loads packs per fix, and `reconcile-task` resolves the task's Domain.
  - `init-config` writes machine paths and secretary-duty settings in the global configuration and touches no task.
  - `start-secretary` dispatches runbook maintenance and meeting sync under `secretary-contract.md`, with one retained session and no task writes.
  - `start-group` operates on one task group. For its brief, it reads the group's `GROUP_CONTEXT.md`, ancestor group files, and only the `## Change set` headings of `GROUP_LOG.md`. For each direct child, it reads `task-state.ts` output, Open Questions in `CONTEXT.md` and `plan.md`, and the next step's `**Depends on:**` line. It also runs `task-state.ts` on a task in the group's Archive container that such a line or a Current state item cites. Its file writes cover only grounding prose and records: its group's `GROUP_CONTEXT.md` and `GROUP_LOG.md` (`task-store.md` § *Shared group context*), and the `CONTEXT.md` and `ticket.md` of every task below the group outside Archive and Backlog, including tasks in nested groups. It may create such a task's missing `CONTEXT.md`, inferring its `**Domain:**` under `context-schema.md` § *Field notes* while loading no pack. Its only external write is a requested Slack draft under its § *Draft*; it sends no messages. Each task keeps its own Domain.

The skills `create-notion-page`, `prepare-daily-status`, `prepare-release-announcement`, `review-note`, `run-knowledge-session`, `sync-meeting-notes`, and `translate` resolve no domain pack; their Core Rules apply the working repository's instruction files.
Only `prepare-release-announcement` and `sync-meeting-notes` link `./references`.

A composite's delegated skills retain their own pack loads unless explicitly overridden. `maintain` invokes no sibling skill; its Phase 4 read-only probes resolve no pack either.

## Utility skills

A utility contains its complete protocol/output in `SKILL.md`, with no references, sibling skills, supporting instructions, or domain pack.
The always-on core rules are present, but a utility's output follows its own rules (`../../CORE_RULES.md` § *NOTICED BUT NOT TOUCHING* and § *Communication*).
Ship no `references` link. Utilities may expose flags.
Each utility's `SKILL.md` names itself a utility skill, so the always-on exemption reaches it at run time.

The initial members are `format-dictation` and `proofread`.

## Load order

For a spine skill acting on a task, the neutral `../../CORE_RULES.md` is already in context through the always-on delivery `setup.ts` installs:

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.
2. Resolve Domain from `CONTEXT.md`, defaulting to engineering.
3. Layer `references/<domain>/rules.md` over the core.
4. Load the corresponding pack file as each phase requires it.

Fixed-pack skills skip resolution. `fix-findings` resolves per chosen fix without a task Domain header. `commit` and pack-free skills run only step 1; delegated skills retain their own loads as specified above.

## Missing-pack fallback

Report an absent pack or phase file and use neutral methodology. Invent no domain rules, checklists, or verification recipes; silently substitute no pack.

## Adding a new domain

1. Model `references/<domain>/` on engineering, starting with `rules.md` and `verification.md`. Add other recipes and checklists as needed.
2. Declare `**Domain:** <domain>` in task `CONTEXT.md` headers.
3. Add any domain-contributed skills under `skills/` and register them in the skill split above.
4. Leave the spine unchanged. `setup.ts` copies all of `references/`, installing new packs automatically.

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

Default to `engineering` when that header is absent, preserving existing tasks. Load the requested phase files from `references/<domain>/`. Resolve from the header value, like plan Status (`task-lifecycle.md`), never from filesystem placement or directory shape.

## Which skills resolve a domain vs. load a fixed pack

- **Spine skills** resolve the task's Domain, except three that may lack a task folder. `explore` resolves only when relevant and may answer domain-neutrally. `implement` infers from the request. `decompose-task` infers from the source document and stamps each materialized part's seeded `CONTEXT.md`.
- **Engineering-only skills** load `references/engineering/`: `commit`, `rebase`, `review-code`, `update-pr-description`, `publish-pr-review`, `triage-findings`, `verify-issue`, `review-code-triage-verify`, `triage-findings-verify`, and `review-pr-loop`. **Exception:** `commit` reads only the neutral core because it writes no code. Its SKILL.md states the applicable Git-mutation rule inline. Pack membership does not require every pack file.
- **Documentation-contributed skills** load `references/documentation/`: `review-docs` checks accuracy against code and whole-document quality; `prepare-diagram` produces Mermaid diagrams.
- **Mixed-domain findings:** `fix-findings` applies the engineering pack, documentation pack, or both to each chosen fix according to its edit surface. A finding's anchor does not determine the domain.
- **Pack-free skills** read the neutral core and resolve no pack themselves:
  - `archive-task`, `backlog-task`, and `maintain` operate on task envelopes and store artifacts. Read `task-layout.md`, its filing/role-file satellites, and `task-lifecycle.md`. Archive uses location and terminal-state rules; backlog uses location and unstarted-entry rules; maintain uses format and registry rules.
  - `prepare-ticket` writes a domain-neutral upstream artifact before a Domain marker exists; apply `ticket-format.md` and `task-layout.md`.
  - `resume-task-reconcile` and `review-task-reconcile` leave domain resolution to their Phase 1 skills, `resume-task` and `review-task`.
  - `init-config` writes the machine's root registry and touches no task.

The lean utilities `create-notion-page`, `prepare-daily-status`, `proofread`, `review-note`, and `translate` load only `./AGENTS.md` § *Ask Before Assuming* and resolve no domain pack. `proofread` alone links `./references`, for `user-facing-messages.md`; the other four ship no `./references` link.

A composite's delegated skills retain their own pack loads unless explicitly overridden. `maintain` invokes no sibling skill; its Phase 4 read-only probes resolve no pack either.

## Load order

For a spine skill acting on a task:

1. Read and apply `./AGENTS.md`, the neutral `CORE_RULES.md`.
2. Resolve Domain from `CONTEXT.md`, defaulting to engineering.
3. Layer `references/<domain>/rules.md` over the core.
4. Load the corresponding pack file as each phase requires it.

Fixed-pack skills skip resolution. `fix-findings` resolves per chosen fix without a task Domain header. `commit` and pack-free skills run only step 1; delegated skills retain their own loads as specified above.

## Missing-pack fallback

When a resolved pack or requested phase file is absent, say which guidance is missing and proceed with neutral methodology. Never invent domain rules, checklists, or verification recipes. Do not silently substitute engineering or another pack.

## Adding a new domain

1. Model `references/<domain>/` on engineering, starting with `rules.md` and `verification.md`. Add other recipes and checklists as needed.
2. Declare `**Domain:** <domain>` in task `CONTEXT.md` headers.
3. Add any domain-contributed skills under `skills/` and register them in the skill split above.
4. Leave the spine unchanged. `setup.ts` copies all of `references/`, installing new packs automatically.

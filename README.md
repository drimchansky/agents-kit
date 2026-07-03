# Agents Kit

My personal kit for working with Claude Code, Codex, and other coding agents.

It includes:

1. **Core rules for agents** – how to communicate, when to push back, and when it's better to ask than continue blindly.
2. **References** – important checklists and docs for various cases, for now it's mostly about engineering.
3. **Utility skills** – self-contained helpers that don't rely on the core rules, so they run anywhere: locally via CLI or in any chat.
4. **Engineering skills** – code-focused skills that apply the core rules and references ad hoc, against a diff, a file, or a codebase.
5. **Workflow skills** – the core-rules skills that move a task from idea to done through a task folder under `.agents/tasks/`.

## Getting started

Install the kit into Claude Code and Codex with the setup script:

```bash
git clone git@github.com:drimchansky/agents-kit.git ~/agents-kit
~/agents-kit/setup.sh
```

## Injecting the rules

- [**inject-rules**](skills/inject-rules/SKILL.md) – prime the current session with the [core rules](CORE_RULES.md) so ad-hoc work outside a skill still follows them. Every engineering and workflow skill loads these as its first step; this one does it standalone, and resolves no domain pack. _Example: `/inject-rules`, then work as normal — or `/inject-rules review this diff`_

## Utility skills

- [**proofread**](skills/proofread/SKILL.md) – polish a message, email, or piece of writing for grammar, clarity, and factual accuracy. _Example: `/proofread` (paste text)_
- [**translate**](skills/translate/SKILL.md) – translate text from one language to another. _Example: `/translate to Spanish`_
- [**fact-check**](skills/fact-check/SKILL.md) – verify factual claims against trustworthy sources online. _Example: `/fact-check` (paste claim)_
- [**review-note**](skills/review-note/SKILL.md) – validate and expand a personal knowledge-base note. _Example: `/review-note notes/stoicism.md`_
- [**refine-idea-chat**](skills/refine-idea-chat/SKILL.md) – sharpen a vague idea in chat, nothing saved. _Example: `/refine-idea-chat add a draft mode`_

## Engineering skills

Core-rules-aware skills that run ad hoc — against a diff, a file, or a codebase, with no task folder. Most are code-bound and load the engineering references; `explore` is the exception: a domain-neutral spine skill that pulls the engineering pack only when the topic is code.

- [**audit**](skills/audit/SKILL.md) – assess a module, directory, or whole project: structure, patterns, and health — no diff, no recent-change focus. _Example: `/audit src/auth` or `/audit` (whole project)_
- [**explore**](skills/explore/SKILL.md) – explain code, a library, a concept, or how the pieces fit together. _Example: `/explore how does the retry queue work?`_
- [**review-commit**](skills/review-commit/SKILL.md) – review staged changes before committing. _Example: `/review-commit`_
- [**review-pr**](skills/review-pr/SKILL.md) – review a PR or branch diff against its base. _Example: `/review-pr`_
- [**review-docs**](skills/review-docs/SKILL.md) – audit existing documentation against the codebase. _Example: `/review-docs README`_
- [**verify-issue**](skills/verify-issue/SKILL.md) – confirm and investigate a reported bug or issue. _Example: `/verify-issue users see 500 on signup`_

## Workflow skills

The set that turns a rough task into finished work. Each works on one task folder under `.agents/tasks/<slug>/`, handing the slug to the next:

1. [**refine-idea**](skills/refine-idea/SKILL.md) – sharpen a vague idea into grounded context before planning. _Example: `/refine-idea add a draft mode to the editor`_
2. [**plan-task**](skills/plan-task/SKILL.md) – break the work into a plan with testable goals. _Example: `/plan-task migrate auth to JWT`_
3. [**review-task**](skills/review-task/SKILL.md) – sanity-check the plan against its context, goals, and current reality before building; add `-r` to reconcile obvious findings and fold your answers into the plan. _Example: `/review-task auth-jwt-migration` or `/review-task auth-jwt-migration -r`_
4. [**implement-task**](skills/implement-task/SKILL.md) – execute the plan, tracking progress in the task folder. _Example: `/implement-task auth-jwt-migration`_

Three more support the workflow:

- [**resume-task**](skills/resume-task/SKILL.md) – catch up on a task and get a handoff briefing; add `-r` to also reconcile the task docs to reality — obvious fixes applied, you're asked about the rest. _Example: `/resume-task auth-jwt-migration` or `/resume-task auth-jwt-migration -r`_
- [**archive-task**](skills/archive-task/SKILL.md) – move a finished (`done`/`skipped`) task folder into `archive/` to keep the active list short. _Example: `/archive-task auth-jwt-migration`_
- [**migrate-task-format**](skills/migrate-task-format/SKILL.md) – upgrade older task folders to the current format. _Example: `/migrate-task-format` or `/migrate-task-format ../other-repo`_

## Task folders

The workflow skills share a folder-based contract: one task lives in `.agents/tasks/<slug>/` and holds role-named files.

- `CONTEXT.md` – static grounding context, including the `**Domain:**` marker.
- `goals.md` – the single source of task intent: durably-ID'd `G<n>` goals that double as the acceptance criteria.
- `plan.md` – the steps, each citing the goals it delivers.
- `result.md` – append-only record of what happened.

`implement-task` runs an acceptance gate against `goals.md` before flipping the plan to `done`. Completed (`done`) or `skipped` tasks can be moved to an `archive/` subdirectory with [`archive-task`](skills/archive-task/SKILL.md); a plan waiting on something external takes the `blocked` status. See [`task-layout`](references/workflow/task-layout.md) for the on-disk layout and [`task-lifecycle`](references/workflow/task-lifecycle.md) for the status registry.

## Domain packs

The workflow spine is domain-neutral; domain-specific knowledge lives in a **pack** under `references/<domain>/` — a `rules.md` overlay plus exploration / planning / execution / verification / review guidance and any checklists.

- A task's `**Domain:**` marker selects the pack (default `engineering`).
- Engineering is the first and reference pack.
- A new domain is added by dropping in `references/<domain>/` and authoring tasks with that `**Domain:**` — no spine change.

See [`domain-packs`](references/workflow/domain-packs.md).

## Reference checklists

References under `references/` split into the neutral methodology and the domain packs.

- **`references/workflow/`** – what every domain shares: [`task-lifecycle`](references/workflow/task-lifecycle.md) (status registry), [`task-layout`](references/workflow/task-layout.md) (on-disk layout), [`domain-packs`](references/workflow/domain-packs.md) (how domains plug in), [`acceptance-criteria`](references/workflow/acceptance-criteria.md) (the "done" bar), [`context-schema`](references/workflow/context-schema.md) (the `CONTEXT.md` layout), and [`ideation`](references/workflow/ideation.md) (the diverge/converge method).
- **`references/engineering/`** – domain pack #1: a `rules` overlay, the `exploration` / `planning` / `execution` / `verification` / `review` bodies the spine loads by phase, and per-surface checklists (typescript, react, css, security, …).


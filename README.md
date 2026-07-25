# Agents Kit

My personal kit for working with Claude Code, Codex, and other coding agents.

It includes:

1. **Core rules for agents** – how to communicate, when to push back, and when it's better to ask than continue blindly.
2. **References** – important checklists and docs for various cases, for now it's mostly about engineering.
3. **Utility skills** – self-contained helpers that don't rely on the core rules, so they run anywhere: locally via CLI or in any chat.
4. **Engineering skills** – code-focused skills that apply the core rules and references ad hoc, against a diff, a file, or a codebase.
5. **Workflow skills** – the core-rules skills that move a task from idea to done through a task folder (by default under `.agents/tasks/`).
6. **Agent definitions** – Claude Code subagent definitions the skills lean on: today the parallel-lane `executor`, pinned to `claude-sonnet-5` at `xhigh` — a tier below the Opus- or Fable-class session that coordinates it — because `implement-task -p`'s merge gates re-verify its work.

## Getting started

Install the kit into Claude Code and Codex with the setup script:

```bash
git clone git@github.com:drimchansky/agents-kit.git ~/agents-kit
~/agents-kit/setup.sh
```

Both homes get the same skills; the invocation form differs. Claude Code names them `/skill-name` — the form every example below uses. Codex names them `$skill-name`, and each skill ships `policy.allow_implicit_invocation: false`, so on Codex a skill isn't selected implicitly from matching task wording: name it explicitly to run it.

## Injecting the rules

- [**inject-rules**](skills/inject-rules/SKILL.md) – prime the current session with the [core rules](CORE_RULES.md) so ad-hoc work outside a skill still follows them. Every engineering and workflow skill loads these as its first step; this one does it standalone, and resolves no domain pack. _Example: `/inject-rules`, then work as normal — or `/inject-rules review this diff`_

## Utility skills

- [**proofread**](skills/proofread/SKILL.md) – polish a message, email, or piece of writing for grammar, clarity, and factual accuracy. _Example: `/proofread` (paste text)_
- [**translate**](skills/translate/SKILL.md) – translate text from one language to another. _Example: `/translate to Spanish`_
- [**fact-check**](skills/fact-check/SKILL.md) – verify factual claims against trustworthy sources online. _Example: `/fact-check` (paste claim)_
- [**create-note**](skills/create-note/SKILL.md) – research a topic and distill it into a compact, self-contained learning note with verified sources. _Example: `/create-note spaced repetition`_
- [**review-note**](skills/review-note/SKILL.md) – validate and expand a personal knowledge-base note. _Example: `/review-note notes/stoicism.md`_
- [**create-notion-page**](skills/create-notion-page/SKILL.md) – draft the requested content and create it as a Notion page via the session's Notion tools — private by default, or under a destination the user names. _Example: `/create-notion-page packing list for the Lisbon trip`_
- [**refine-idea-chat**](skills/refine-idea-chat/SKILL.md) – sharpen a vague idea in chat, nothing saved. _Example: `/refine-idea-chat add a draft mode`_

## Engineering skills

Core-rules-aware skills that run ad hoc — against a diff, a file, or a codebase, with no task folder. Most are code-bound and load the engineering references. Three are exceptions: `explore` and `implement` are domain-neutral spine skills that resolve a domain from the request rather than from a `CONTEXT.md`, pulling the engineering pack when the work is code; `commit` skips the pack because it writes no code, running on the neutral core alone.

- [**audit**](skills/audit/SKILL.md) – assess a module, directory, or whole project: structure, patterns, and health — no diff, no recent-change focus. _Example: `/audit src/auth` or `/audit` (whole project)_
- [**explore**](skills/explore/SKILL.md) – explain code, a library, a concept, or how the pieces fit together. _Example: `/explore how does the retry queue work?`_
- [**implement**](skills/implement/SKILL.md) – carry out a change directly, with no task folder: frame what's being built, run it through the same verify gates and Stop-the-Line discipline as `implement-task`, and report in chat. _Example: `/implement add a --dry-run flag to the sync command`_
- [**review-commit**](skills/review-commit/SKILL.md) – review staged changes before committing. _Example: `/review-commit`_
- [**commit**](skills/commit/SKILL.md) – create the commit from review-commit's drafted message (its follow-up). _Example: `/review-commit`, then `/commit`_
- [**review-pr**](skills/review-pr/SKILL.md) – review a PR or branch diff against its base. _Example: `/review-pr`_
- [**update-pr-description**](skills/update-pr-description/SKILL.md) – apply review-pr's drafted description (`-d`) to the PR on GitHub (its follow-up). _Example: `/review-pr -d`, then `/update-pr-description`_
- [**publish-pr-review**](skills/publish-pr-review/SKILL.md) – publish review-pr's findings to the PR on GitHub: Major/Critical as inline comments, or a short approval if none (its follow-up). _Example: `/review-pr`, then `/publish-pr-review`_
- [**triage-findings**](skills/triage-findings/SKILL.md) – gather findings from a review in this session, a PR's review comments, or a pasted/saved list; filter to the unaddressed ones and batch them by concern so you can see the remaining work. Read-only. _Example: `/triage-findings` (after a review) or `/triage-findings 1234`_
- [**review-docs**](skills/review-docs/SKILL.md) – audit existing documentation against the codebase. _Example: `/review-docs README`_
- [**verify-issue**](skills/verify-issue/SKILL.md) – confirm and investigate a reported bug or issue. _Example: `/verify-issue users see 500 on signup`_
- [**review-commit-triage-verify**](skills/review-commit-triage-verify/SKILL.md) – the pre-commit pipeline composite: `review-commit` → `triage-findings` → per-batch `verify-issue` probes in isolated context — one verdict per finding, plus the drafted commit message. _Example: `/review-commit-triage-verify`, then `/commit`_
- [**review-pr-triage-verify**](skills/review-pr-triage-verify/SKILL.md) – the PR-review pipeline composite: `review-pr` → `triage-findings` → per-batch `verify-issue` probes in isolated context, ending with one verdict per finding. _Example: `/review-pr-triage-verify`, then `/publish-pr-review`_
- [**triage-findings-verify**](skills/triage-findings-verify/SKILL.md) – the findings-first pipeline composite: `triage-findings` → per-batch `verify-issue` probes in isolated context — one verdict per finding, for findings you already have (a PR's comments, a saved/pasted list, or this session's review). _Example: `/triage-findings-verify 1234` or `/triage-findings-verify` (after a review)_

## Workflow skills

The set that turns a rough task into finished work. Each works on one task folder — `.agents/tasks/<slug>/` by default, or anywhere on disk when named by path — handing the slug (or path) to the next. A task may begin with a product-facing ticket ([`prepare-ticket`](skills/prepare-ticket/SKILL.md) writes `ticket.md`, or `plan-task -t` drafts one as it plans), which the steps below derive from:

- [**prepare-ticket**](skills/prepare-ticket/SKILL.md) – draft that product-facing `ticket.md` from a described task — title, minimal context, description, and testable acceptance criteria; writes to a file, or seeds a task folder's `ticket.md` as the workflow's product-facing origin. _Example: `/prepare-ticket add CSV export to the accounts table`_

1. [**refine-idea**](skills/refine-idea/SKILL.md) – sharpen a vague idea into grounded context before planning. _Example: `/refine-idea add a draft mode to the editor`_
2. [**plan-task**](skills/plan-task/SKILL.md) – break the work into a plan with testable goals; add `-t` to first draft a self-contained `ticket.md` (via the `prepare-ticket` process) for the plan to derive from. _Example: `/plan-task migrate auth to JWT` or `/plan-task -t add CSV export`_
3. [**review-task**](skills/review-task/SKILL.md) – sanity-check the plan against its context, goals, and current reality before building; add `-r` to reconcile obvious findings and fold your answers into the plan. _Example: `/review-task auth-jwt-migration` or `/review-task auth-jwt-migration -r`_
4. [**implement-task**](skills/implement-task/SKILL.md) – execute the plan, tracking progress in the task folder; add `-p` to run independent steps in parallel worktrees on the pinned executor model, merged at checkpoints. _Example: `/implement-task auth-jwt-migration` or `/implement-task auth-jwt-migration -p`_

Five more support the workflow:

- [**resume-task**](skills/resume-task/SKILL.md) – catch up on a task and get a handoff briefing; add `-r` to also reconcile the task docs to reality — obvious fixes applied, you're asked about the rest. _Example: `/resume-task auth-jwt-migration` or `/resume-task auth-jwt-migration -r`_
- [**reconcile-task**](skills/reconcile-task/SKILL.md) – capture important information from the current session into the task docs — decisions, references, answered questions, and verified progress that never got written down. The enriching counterpart to `resume-task -r`. _Example: `/reconcile-task auth-jwt-migration`_
- [**archive-task**](skills/archive-task/SKILL.md) – move a finished (`done`/`skipped`) task folder into `Archive/` to keep the active list short. _Example: `/archive-task auth-jwt-migration`_
- [**migrate-task-format**](skills/migrate-task-format/SKILL.md) – upgrade older task folders to the current format. _Example: `/migrate-task-format` or `/migrate-task-format ../other-repo`_
- [**maintain**](skills/maintain/SKILL.md) – the monthly maintenance ritual: `migrate-task-format` sweep of the kit → store `INDEX.md` refresh → `resume-task -r` over the kit's own tasks — report-first, auto-applying only the idempotent index refresh and gating the rest. _Example: `/maintain`_

## Task folders

The workflow skills share a folder-based contract: one task lives in one folder holding role-named files — that's what makes a folder a task folder, wherever it sits. The default (and only auto-discovered) location is `.agents/tasks/<slug>/` at the project root; an explicit path reaches a task anywhere else.

- `ticket.md` – optional product-facing origin: the ask and its acceptance criteria in product terms (see [`ticket-format`](references/workflow/ticket-format.md)). `CONTEXT.md` and `goals.md` derive from it.
- `CONTEXT.md` – static grounding context, including the `**Domain:**` marker.
- `goals.md` – the single source of task intent: durably-ID'd `G<n>` goals that double as the acceptance criteria; a goal verified outside the session (deploy-and-check-live, client sign-off) is flagged `(external)`.
- `plan.md` – the steps, each citing the goals it delivers.
- `result.md` – a rewritable Current-state header above an append-only log of what happened.

Each fact lives in exactly one of these files and the siblings cite it — plan steps cite goals by `G<n>` ID, plan sections cite `CONTEXT.md` rather than restating it, and when a ticket exists `CONTEXT.md`'s problem statement cites `ticket.md` while `goals.md` sharpens its criteria. See [`task-layout`](references/workflow/task-layout.md) § *One home per fact*.

`implement-task` runs an acceptance gate against `goals.md` before flipping the plan to `done` — and parks it at `in-review` when the only goals left unsatisfied are `(external)` ones still awaiting verification, reaching `done` on a later re-run once they're confirmed. Completed (`done`) or `skipped` tasks can be moved to an `Archive/` subdirectory with [`archive-task`](skills/archive-task/SKILL.md); a plan stuck or waiting on a prerequisite before it can proceed takes the `blocked` status. See [`task-layout`](references/workflow/task-layout.md) for the on-disk layout and [`task-lifecycle`](references/workflow/task-lifecycle.md) for the status registry.

## Domain packs

The workflow spine is domain-neutral; domain-specific knowledge lives in a **pack** under `references/<domain>/` — a `rules.md` overlay plus exploration / planning / execution / verification / review guidance and any checklists.

- A task's `**Domain:**` marker selects the pack (default `engineering`).
- Engineering is the first and reference pack.
- A new domain is added by dropping in `references/<domain>/` and authoring tasks with that `**Domain:**` — no spine change.

See [`domain-packs`](references/workflow/domain-packs.md).

## Reference checklists

References under `references/` split into the neutral methodology and the domain packs.

- **`references/workflow/`** – what every domain shares: [`task-lifecycle`](references/workflow/task-lifecycle.md) (status registry), [`task-layout`](references/workflow/task-layout.md) (on-disk layout), [`domain-packs`](references/workflow/domain-packs.md) (how domains plug in), [`acceptance-criteria`](references/workflow/acceptance-criteria.md) (the "done" bar), [`ticket-format`](references/workflow/ticket-format.md) (the product-facing ticket), [`context-schema`](references/workflow/context-schema.md) (the `CONTEXT.md` layout), [`ideation`](references/workflow/ideation.md) (the diverge/converge method), [`execution-loop`](references/workflow/execution-loop.md) (the implement → verify loop and its gates, shared by `implement-task` and `implement`), [`reconciliation`](references/workflow/reconciliation.md) (the `-r` reconcile-mode contract), and [`agent-fanout`](references/workflow/agent-fanout.md) (the cross-agent fan-out contracts — read-only probes and write-mode executors — and engines).
- **`references/engineering/`** – domain pack #1: a `rules` overlay, the `exploration` / `planning` / `execution` / `verification` / `review` bodies the spine loads by phase, and per-surface checklists (typescript, react, css, security, …).


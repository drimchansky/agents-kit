# Agents Kit

My personal collection of skills, agents, and a task workflow for Claude Code and Codex.

## What's included

- **Skills** for planning, implementation, code review, Git, writing, and knowledge upkeep. [Browse the skills](./skills/).
- **Agents** that carry out implementation steps and review changes independently.
- **Shared rules and references** for engineering, documentation, and task management.
- **Task folders** that keep context, plans, and results available across sessions.

## Setup

With Node installed ([supported version](./AGENTS.md#the-ts-sources-are-unchecked-by-design)):

```sh
git clone https://github.com/drimchansky/agents-kit.git
cd agents-kit
node setup.ts
```

This installs the kit into `~/.claude` and `~/.codex`. Pull changes and rerun `node setup.ts` to update.

For Claude Code, the plugin is an alternative:

```text
/plugin marketplace add drimchansky/agents-kit
/plugin install agents-kit@agents-kit
```

Choose one installation method. Invoke skills as `/plan-task` in Claude Code, `/agents-kit:plan-task` with the plugin, or `$plan-task` in Codex.

## Task workflow

1. **Shape the work.** Use `refine-idea` for a rough idea or `prepare-ticket` for a concrete request.
2. **Plan it.** `plan-task` records goals, steps, and verification. `review-task` checks the plan before execution.
3. **Build it.** `implement-task` follows the plan, verifies the work, and records results.
4. **Review it.** `review-code` examines the changes; `fix-findings` addresses issues.
5. **File it.** `archive-task` moves finished tasks out of the active list. `backlog-task` parks unstarted work.

Tasks normally live in `.agents/tasks/<slug>/`, with `CONTEXT.md`, `goals.md`, `plan.md`, and `result.md` as work progresses. Use `resume-task` to pick up later and `reconcile-task` to save decisions and findings.

Small changes can go straight to `implement` without a task folder. Use `init-config` to register task folders elsewhere and `maintain` to check task and installation health.

[Workflow details](./references/workflow/task-layout.md) · [Maintainer guide](./AGENTS.md)

## Private runbook

Ask `init-config` to configure one dedicated runbook directory inside your private notes for personal and work topics. Use an absolute or home-relative path. It previews the complete configuration before writing and preserves unrelated settings. The optional [`runbookRoot` setting](./references/workflow/task-store.md#the-root-registry-optional) is separate from task-discovery roots.

Then explicitly request initialization with `implement`, for example:

> As documentation work, initialize my configured runbook (`<runbook path>`): its README.md index and the focused entries `<entry files>` for `<selected topics>`, using only `<selected source paths or links>`. Follow the runbook reference. Preserve existing notes and unrelated content, and retain missing or conflicting facts explicitly.

The [runbook reference](./references/workflow/runbook.md) defines entry and source conventions. Store access methods and credential-manager references, keeping credential values outside the runbook. `init-config` changes configuration only; the initialization request creates the selected index and entries.

Kit skill runs that load the full [core rules](./CORE_RULES.md), such as task workflows, `implement`, and `explore`, consult the index when personal or work knowledge becomes relevant. They then read the applicable entries. They retain evidence dates and uncertainty; current infrastructure claims still need fresh verification. An absent setting opts out silently. A needed unavailable source is reported without searching the vault.

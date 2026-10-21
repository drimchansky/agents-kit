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

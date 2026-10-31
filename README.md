# Agents Kit

My personal collection of skills, agents, and a task workflow for Claude Code and Codex.

## What's included

- **Skills** for planning, implementation, code review, Git, writing, and knowledge upkeep. [Browse the skills](./skills/).
- **Agents** that carry out implementation steps, review changes, and check your private runbook independently.
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

### Codex browser tools

The [Codex browser guidance](./references/workflow/browser-tools.md#codex) prefers Chrome DevTools MCP for existing Chrome tabs. Codex kit skills load it through their core rules. To apply it outside skill runs, add this loader to `~/.codex/AGENTS.md` after setup:

```markdown
For browser UI actions, read and apply `~/.codex/references/workflow/browser-tools.md` § *Codex*.
```

The installer leaves your global `AGENTS.md` untouched. Start a new Codex session to load the instruction.

## Task workflow

1. **Shape the work.** Use `refine-idea` for a rough idea or `prepare-ticket` for a concrete request.
2. **Plan it.** `plan-task` records goals, steps, and verification. `review-task` checks the plan before execution.
3. **Build it.** `implement-task` follows the plan, verifies the work, and records results.
4. **Review it.** `review-code` examines the changes; `fix-findings` addresses issues, and `-1` runs one health boundary and one commit for the whole run.
5. **File it.** `archive-task` moves finished tasks out of the active list. `backlog-task` parks unstarted work.

Tasks normally live in `.agents/tasks/<slug>/`, with `CONTEXT.md`, `goals.md`, `plan.md`, and `result.md` as work progresses. Use `resume-task` to pick up later and `reconcile-task` to save decisions and findings.

Small changes can go straight to `implement` without a task folder. Use `init-config` to register task folders elsewhere and `maintain` to check task and installation health.

[Workflow details](./references/workflow/task-layout.md) · [Maintainer guide](./AGENTS.md)

## Choose an executor

`implement`, `implement-task`, and `fix-findings` accept `-e native|codex|claude`. New runs default to `native`; selection carries through the run's corrective relaunches. With `-e codex` or `-e claude`, `fix-findings` launches the external CLI once per applied fix, Auto or approved ([delegation rule](./skills/fix-findings/SKILL.md#execution-strategy-every-fix-delegates)).

- Claude Code to Codex: `/implement-task <task> -e codex`
- Codex to Claude: `$implement <change> -e claude`

Use `-e native` to select the host's own executor. [Routing and fallback rules](./references/workflow/executor-routing.md#selection) define supported routes. Review `-x` remains a read-only cross-check.

## Private runbook

Ask `init-config` to configure one dedicated runbook directory inside your private notes for personal and work topics. Use an absolute or home-relative path. It previews the complete configuration before writing and preserves unrelated settings. The optional [`runbookRoot` setting](./references/workflow/task-store.md#the-root-registry-optional) is separate from task-discovery roots.

Then explicitly request initialization with `implement`, for example:

> As documentation work, initialize my configured runbook (`<runbook path>`): its README.md index and the focused entries `<entry files>` for `<selected topics>`, using only `<selected source paths or links>`. Follow the runbook reference. Preserve existing notes and unrelated content, and retain missing or conflicting facts explicitly.

The [runbook reference](./references/workflow/runbook.md) defines entry and source conventions. Store access methods and credential-manager references, keeping credential values outside the runbook. `init-config` changes configuration only; the initialization request creates the selected index and entries.

Kit skill runs that load the full [core rules](./CORE_RULES.md), such as task workflows, `implement`, and `explore`, consult the index when personal or work knowledge becomes relevant. They then read the applicable entries. They retain evidence dates and uncertainty; current infrastructure claims still need fresh verification. An absent setting opts out silently. A needed unavailable source is reported without searching the vault.

## Secretary

The secretary checks your configured runbook's entries against their cited sources and each other. It reports findings and proposed updates in the conversation. Start it with `/start-secretary` in Claude Code or `$start-secretary` in Codex. Asking for it in conversation also works; it then describes the run and waits for you to say "go".

It needs the `runbookRoot` setting from [Private runbook](#private-runbook), the kit's helper script, and the registered native secretary role. Run `init-config` to record your kit checkout as `kitRoot`; a plugin install provides the helper without it. Codex uses the installed `secretary.toml` role; a session that has not registered it needs an install or restart. A missing requirement reports `Secretary: unavailable` with its cause and starts nothing. In Claude Code it also needs the `ListAgents` tool; without it, the run reports `Secretary: unavailable — host lacks ListAgents`.

**Reviews.** A review covers the whole runbook. One is due when none has finished yet, and 24 hours after the last one finished. You can also request a review sooner. Findings cover inconsistencies, mistakes, missing information, stale claims, and sources it could not read. Claims resting on an unread source stay marked unverified. Each proposal changes one file and shows its evidence and replacement text.

**Session.** Automatic reviews need exposed scheduling controls that return to this conversation while idle and end with this session. Claude Code supplies these through its cron tools. Between reviews, automatic mode keeps one wake armed for the next due review. Without suitable controls, Codex works on demand and reports `Secretary: on demand — no automatic wake armed`. Ask it to review, check whether a review is due, list pending proposals, or apply a revision you accept. It checks the records on each request; it does not wake itself. Starting again in the same session reports the existing run instead of launching another. A start in a new session lists earlier pending proposals and reviews only when one is due. The secretary ends when you ask it to stop or the session closes. In Claude Code, resuming the session restores a wake that has not fired yet. Other hosts require their documented restoration support; an on-demand run resumes after fresh checks. The secretary also stops when a review does not complete, the next wake cannot be armed, or a wake finds its records unavailable. Examples include a helper error, records still busy after about two seconds, and a rebuild that cannot finish. Each case reports `Secretary: inactive — <cause>`. Run `/start-secretary` to start it again.

**Decisions.** Reply with a proposal's `<proposal>@<revision>` and accept, reject, or defer, for example `accept p4@1`. Only your own message decides. The secretary is told never to record a decision, but it can run commands, and the helper cannot tell who recorded one. Each report names any decision this session did not record. A message naming no revision or an outdated one records nothing, and you are asked again. The secretary is told to change the runbook only by applying an accepted revision, and only its one target. It can run commands, so a direct edit is not blocked, and no report detects one. Before writing, the secretary rechecks the target and its sources. A changed target or materially changed evidence holds the write and produces a new revision for you to decide.

**Stopping.** Ask in the conversation to stop the secretary. It confirms `Secretary: stopped` only after cancelling the wake and any review or update in flight. Results arriving after the stop change nothing. The next start finishes an accepted update left interrupted, under your earlier acceptance. It records a write that already landed, or rechecks the target and its sources and retries the write.

**History.** Activity records live under `~/.local/state/agents-kit/secretary/runbook/<runbook-id>/`, outside the runbook. Each review outcome, proposal, decision, and applied change is a separate event that is never rewritten. Corrections are added as new events. Read the records with `node <kit-root>/scripts/secretary-state.ts status` or `history` rather than opening the files. A missing or stale summary is rebuilt from history at the next start, keeping every event and pending proposal. The secretary is told to record no credential values. As a backstop, the helper refuses payloads matching known credential shapes, such as private keys, cloud and chat tokens, and URLs with inline passwords. Changing `runbookRoot` starts a separate history.

[Skill](./skills/start-secretary/SKILL.md) · [Secretary contract](./references/workflow/secretary-contract.md) · [Helper commands](./references/scripts/secretary-state.md)

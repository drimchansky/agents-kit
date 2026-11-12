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

This installs the kit into `~/.claude` and `~/.codex`, including always-on [core rules](./CORE_RULES.md) on both hosts. Pull changes and rerun `node setup.ts` to update.

On Claude Code, awaited background shell commands use the kit's `scripts/silence-watch.ts`. It needs your checkout recorded as `kitRoot` through `init-config`, or a plugin install. Without either, the session asks for the checkout path. The session passes the watch command to reviewers and executors. A delegated agent given no watch command looks for `kitRoot` or a plugin install itself and never asks for the path. Without either, it runs awaited commands in the foreground.

For Claude Code, the plugin is an alternative:

```text
/plugin marketplace add drimchansky/agents-kit
/plugin install agents-kit@agents-kit
```

A plugin install runs without the always-on core rules; only `node setup.ts` installs them. Some kit skills still read the plugin's `CORE_RULES.md` through section citations. Its `references/` paths resolve under `~/.claude`, so those reads work only alongside a `setup.ts` install. Choose one installation method. Invoke skills as `/plan-task` in Claude Code, `/agents-kit:plan-task` with the plugin, or `$plan-task` in Codex.

### Core rules

New sessions and their subagents start with the core rules, without a skill or file read. Start a new session after setup to load them.

- **Claude Code:** setup writes the rule file `~/.claude/rules/agents-kit-core-rules.md`. Explore and Plan skip user rules, so setup also merges a `SubagentStart` hook into `~/.claude/settings.json` to give them the rules. The merge keeps your other settings and rewrites the file as two-space JSON. `~/.claude/CLAUDE.md` stays unchanged.
- **Codex:** setup writes the rules into a marked block of `~/.codex/AGENTS.md`. Your lines outside the block stay unchanged.

If your `~/.claude/settings.json` is synced from elsewhere, the synced copy must keep the kit's Explore/Plan hook. Otherwise each sync removes the hook, and `maintain` reports it missing. Copy the kit's `SubagentStart` entry from the installed file unchanged.

### Browser tools

The [browser guidance](./references/workflow/browser-tools.md) prefers Chrome DevTools MCP on both hosts. It covers acting in your Chrome session, isolated review capture, UI checks, and regressions against live data. The core rules tell each session to read it before acting in a browser UI. Plugin sessions lack the core rules, so they do not read it.

Register two Chrome DevTools MCP servers on each host. `chrome-devtools` attaches to your running Chrome; `chrome-devtools-isolated` starts a temporary profile.

```sh
claude mcp add --scope user chrome-devtools -- npx -y chrome-devtools-mcp@latest --autoConnect
claude mcp add --scope user chrome-devtools-isolated -- npx -y chrome-devtools-mcp@latest --isolated
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --autoConnect
codex mcp add chrome-devtools-isolated -- npx -y chrome-devtools-mcp@latest --isolated
```

`--autoConnect` needs Chrome 144 or newer, with remote debugging enabled at `chrome://inspect/#remote-debugging`. Chrome asks you to allow the connection. In Claude Code, Claude in Chrome is the fallback for your session.

## Task workflow

1. **Shape the work.** Use `refine-idea` for a rough idea or `prepare-ticket` for a concrete request.
2. **Plan it.** `plan-task` records goals, steps, and verification. `review-task` checks the plan before execution.
3. **Build it.** `implement-task` follows the plan, verifies the work, and records results.
4. **Review it.** `review-code` examines the changes; `fix-findings` addresses issues, and `-1` runs one health boundary and one commit for the whole run. When you fix findings inside a task, run `/fix-findings-reconcile` instead; it fixes them, then records the fixes in the task.
5. **File it.** `archive-task` moves finished tasks out of the active list. `backlog-task` parks unstarted work.

Tasks normally live in `.agents/tasks/<slug>/`, with `CONTEXT.md`, `goals.md`, `plan.md`, and `result.md` as work progresses. Use `resume-task` to pick up later and `reconcile-task` to save decisions and findings.

Use `start-group` on a group of related tasks, by path or name, to see their status and open questions and apply decisions across them. Given a path with no group yet, it offers to create one.

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

Sessions with the always-on [core rules](./CORE_RULES.md) consult the index when personal or work knowledge becomes relevant. They then read the applicable entries. They retain evidence dates and uncertainty; current infrastructure claims still need fresh verification. An absent setting opts out silently. A needed unavailable source is reported without searching the vault.

## Secretary

The secretary maintains a configured runbook, syncs meeting notes, or runs both duties in one conversation. It reports findings and proposed updates in the conversation. Start it with `/start-secretary` in Claude Code or `$start-secretary` in Codex. Asking for it in conversation also works; it then describes the run and waits for you to say "go".

It needs at least one enabled duty, that duty’s helper script, and the registered native secretary role. Meeting sync works without `runbookRoot`. Run `init-config` to record your kit checkout as `kitRoot`; a plugin install provides the helper without it. Codex uses the installed `secretary.toml` role; a session that has not registered it needs an install or restart. A missing shared host requirement reports `Secretary: unavailable` and starts nothing. A missing duty requirement disables only that duty. In Claude Code it also needs the `ListAgents` tool; without it, the run reports `Secretary: unavailable — host lacks ListAgents`.

**Reviews.** A review covers the whole runbook. One is due when none has finished yet, then after the configured interval from the last completed or partial review. The default is 24 hours. You can also request a review sooner. Findings cover inconsistencies, mistakes, missing information, stale claims, and sources it could not read. Claims resting on an unread source stay marked unverified. Each proposal changes one file and shows its evidence and replacement text.

**Configuration.** `runbookRoot` enables runbook maintenance; without it, no review starts. Ask `init-config` to set `secretary.duties["runbook-maintenance"].intervalMinutes`, for example: “Set runbook maintenance to every 90 minutes, keeping my current paths and other settings.” It previews the complete JSON before writing. The [runbook duty](./references/secretary/runbook-maintenance.md#configuration) defines valid intervals, prerequisites, permitted actions, and outcomes. Ask `init-config` to set `secretary.duties["meeting-sync"].folder` to an existing notes directory and optionally `.intervalMinutes`. Meeting sync is disabled without a folder and defaults to 60 minutes. The [meeting duty](./references/secretary/meeting-sync.md#configuration) defines validation. Configuration alone starts no work. An active run keeps its enabled duties, physical folders, intervals, and helpers even if configuration changes or becomes unreadable. Stop the secretary and start it again to use new settings.

**Meetings.** Starting with meeting sync enabled authorizes routine creates, archives, and conditional deletions within that session’s retained folder. Runbook edits still require acceptance of an exact proposal revision. Sync uses the [shared meeting procedure](./skills/sync-meeting-notes/SKILL.md): a 30-day Granola lookback and seven-day Calendar preparation window. It preserves user-written text and existing notes, skips ambiguous groups, and continues independent meetings. Missing sources are reported; notes dependent on unavailable or incomplete coverage remain untouched. Prepare the folder’s `Archive/` directory before starting; a missing parent is reported without creating it or bypassing the helper. Interrupted archives reconcile their receipts before new filenames are allocated. Newer incoming text absent from an archive remains in place. Manual meeting sync retains its own folder selection and invocation authorization.

**Session.** Automatic work needs exposed scheduling controls that return to this conversation while idle and end with this session. Claude Code supplies these through its cron tools. Each duty has its own cadence. Automatic mode keeps one shared wake for the earliest eligible duty and runs one job at a time. Without suitable controls, Codex works on demand and reports `Secretary: on demand — no automatic wake armed`. Ask it to sync meetings, review, check due work, list pending proposals, or apply a revision you accept. It checks the records on each request; it does not wake itself. Starting again in the same session reports the existing run instead of launching another. A start in a new session lists earlier pending proposals and reviews only when one is due. The secretary ends when you ask it to stop or the session closes. In Claude Code, resuming the session restores a wake that has not fired yet. Other hosts require their documented restoration support; an on-demand run resumes after fresh checks. A failed or unavailable duty reports its cause while other runnable duties continue. Automatic retry waits one interval from that duty’s failed outcome; an explicit request can retry sooner, subject to its active lease. Shared host failures, including an unarmable wake, report inability to continue. Resolve the reported cause and run `/start-secretary` after cleanup to start again.

**Decisions.** After each report, the secretary asks about every undecided revision with Accept, Reject, and Defer options and a recommendation. After a wake-triggered review, it asks at your next message. You can also reply with a proposal's `<proposal>@<revision>` and accept, reject, or defer, for example `accept p4@1`. Only your own message or answer decides. The secretary is told never to record a decision, but it can run commands, and the helper cannot tell who recorded one. Each report names any decision this session did not record. A message naming no revision or an outdated one records nothing, and you are asked again. The secretary is told to change the runbook only by applying an accepted revision, and only its one target. It can run commands, so a direct edit is not blocked, and no report detects one. Before writing, the secretary rechecks the target and its sources. A changed target or materially changed evidence holds the write and produces a new revision for you to decide.

**Stopping.** Ask in the conversation to stop the secretary. It confirms `Secretary: stopped` only after revoking meeting write authority and confirming cancellation of owned jobs and wakes. If revocation or host cleanup cannot be established, it reports unresolved cleanup instead. Results arriving after stop authorize no writes or wakes. A mutation completed before revocation may already have landed. These guards enforce the secretary workflow; they are not a filesystem sandbox against arbitrary concurrent writers. The next start finishes an accepted update left interrupted, under your earlier acceptance. It records a write that already landed, or rechecks the target and its sources and retries the write.

**History.** Activity records live under `~/.local/state/agents-kit/secretary/runbook/<runbook-id>/`, outside the runbook. Each review outcome, proposal, decision, and applied change is a separate event that is never rewritten. Corrections are added as new events. Read the records with `node <kit-root>/scripts/secretary-state.ts status` or `history` rather than opening the files. A missing or stale summary is rebuilt from history at the next start, keeping every event and pending proposal. The secretary is told to record no credential values. As a backstop, the helper refuses payloads matching known credential shapes, such as private keys, cloud and chat tokens, and URLs with inline passwords. After restart, a changed `runbookRoot` selects a separate history. Changing the interval preserves existing history, proposal IDs, and exact-revision approvals.

Meeting activity and archive receipts live separately under `~/.local/state/agents-kit/secretary/meeting-sync/<folder-id>/`. To read activity, pass the settings the [meeting helper](./references/scripts/meeting-sync-state.md)'s `configure` returns to its `status` command. Archive receipts are recovery records that meeting jobs settle; meeting jobs do not open runbook approvals or history.

[Skill](./skills/start-secretary/SKILL.md) · [Meeting duty](./references/secretary/meeting-sync.md) · [Runbook duty](./references/secretary/runbook-maintenance.md) · [Secretary contract](./references/workflow/secretary-contract.md) · [Helper commands](./references/scripts/secretary-state.md)

---
name: init-config
description: Use when asked to create, update, or repair this machine's agents-kit config — discovers task roots or configures a requested runbook directory and its maintenance interval, compares against `~/.config/agents-kit/config.json`, and previews the delta for confirmation before writing. Never writes unasked, never discards a hand-authored entry.
argument-hint: '[search directories — defaults to the usual project parents; or runbook/duty setup]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

**Model invocation:** requires a confirmed proposal (`./references/workflow/skill-conventions.md` § *The invocation gate*).

Writes only `~/.config/agents-kit/config.json`, after confirmation of its complete proposed contents. Discovery is read-only. Never mutate Git or write outside `~/.config/agents-kit/`, including the state directory. Resolve no task or domain pack.

## When to Use

Use for machine config setup, refresh, repair, task-root registration, runbook-directory configuration, or runbook-duty cadence. Root semantics belong to `./references/workflow/task-layout.md`; task creation/discovery belongs to `plan-task` or `refine-idea`.

## Process

### 1. Read the contract, then the current file

Read `./references/workflow/task-store.md` § *The root registry* for the schema, then the existing config before proposing changes. Report unreadability or invalid JSON with the error line; treat contents as unknown, not empty. Offer a replacement only for confirmation against the user's visible original. Report unknown keys and preserve their entries unchanged.

### 2. Select setup and inspect inputs

A model-invoked run (`./references/workflow/skill-conventions.md` § *The invocation gate*) first proposes the run as one question: the directories it will search, the runbook path or duty settings it will inspect, as the request needs, and `~/.config/agents-kit/config.json` as the file it writes. When runbook setup lacks a path, ask for it in the same question. It walks nothing before the answer; a user-invoked run has passed it.

Inspect a runbook directory only when runbook setup is requested. Use the supplied path or ask for it; do not search for one. Apply the registry's path contract and confirm directory identity and readability without reading entries. Report invalid, missing, or unreadable paths. Do not propose an invalid supplied path; ask for an absolute or `~/...` path instead. Create no runbook directories or notes. Otherwise preserve existing `runbookRoot` unchanged without probing it.

For runbook-only or duty-only requests, skip task-root and kit-checkout discovery and preserve their configured entries. A cadence-only request also preserves `runbookRoot` without probing it or requiring a path. Without that key the duty stays disabled; setting an interval starts no review. Combined task-root setup continues with discovery below.

For requested duty setup, read `./references/secretary/runbook-maintenance.md` § *Configuration*. Configure only `secretary.duties["runbook-maintenance"].intervalMinutes`; add no enablement flag. An omitted interval preserves an existing value; without one, leave the key omitted and report the effective default. An explicit request to restore the default removes only that leaf. Preserve unknown nested keys and future duties when changing or removing it.

Validate the proposed interval before preview under the duty's configuration rules and `./references/scripts/secretary-state.md` § *Status* wake calculation. Use one captured clock in a read-only calculation; open no secretary records and start no job or wake. Reject nonnumeric, fractional, nonpositive, unsafe, or unrepresentable values without coercion. Show a malformed known container's current value and obtain the user's explicit repair choice before replacing it.

Search invocation directories, or existing `~/Documents`, `~/Developer`, `~/Projects`, `~/repos`, `~/src`, `~/Work`, plus the current project. Full-home search requires an explicit `~` argument because it is expensive.

- Apply `./references/workflow/task-store.md` § *The root registry* walking rules and `./references/workflow/task-layout.md` § *One task, one flat folder* recognition, including legacy suffix forms.
- For tasks under `<x>/.agents/tasks/`, propose that canonical root, not the project directory.
- Otherwise climb to the highest ancestor where every sibling directory leads to tasks or carries GROUP_CONTEXT, or the ancestor itself carries GROUP_CONTEXT. Preserve shared grounding inside the proposed root (`./references/workflow/task-store.md` § *Shared group context*). Climb out of lifecycle containers first (`./references/workflow/task-archiving.md`, `./references/workflow/task-backlog.md`).
- Additionally skip `tests/fixtures/` trees; fixture tasks are not stores.
- Count and name every unreadable directory with its error throughout delta, preview, and output.
- Identify kitRoot by `setup.ts`, `CORE_RULES.md`, and `references/`. Ask about multiple checkouts; if none exists, omit the key and say so. An installed agent home cannot substitute.

Use `~` for home-relative proposed paths. Propose labels from project names for canonical roots, otherwise root basenames; generic `tasks` uses its parent's name. Invite label edits in the preview.

### 3. Compare, and preview the delta

For task-root setup, preserve and report registered roots discovery did not find. Removing hand-authored entries requires the user's explicit choice. Classify task roots:

- **new**: discovered and unregistered; propose adding it.
- **unchanged**: registered/discovered with matching path and label.
- **absent**: registered path missing here; keep it, noting possible unmounted volume or other machine.
- **unregistered but not proposed**: found but excluded; name the reason.
- **unreadable**: unexamined directory with its error, not a completeness claim.

Without config, every discovered root is new. For task-root setup, explain discovery and possible creation destination under `./references/workflow/task-destinations.md`, once-per-run absent-root reporting, and canonical-only discovery after deleting config.

When runbook setup was requested, include its current and proposed path and availability in the delta. Preserve unrelated entries, including `taskRoots` and `kitRoot` during runbook-only setup. Changing or removing an existing runbook path requires the user's explicit choice.

For duty setup, show the current and proposed interval, its effective default when omitted, and whether the existing runbook setting enables the duty. Explain that an active secretary retains its startup settings until stop and restart.

Build the proposal from the existing parsed file, changing only the requested fields. Preserve unrelated values, including unknown nested entries, `taskRoots`, `kitRoot`, and an unchanged `runbookRoot`. Preview changed entries and the complete final JSON.

### 4. Gate the write

Ask once after displaying the full proposal; this preview of the payload computed here runs through either door (`./references/workflow/skill-conventions.md` § *The invocation gate*). On confirmation, create the config directory if needed and write exactly the approved file. Declining writes nothing; say so.

Re-read, parse, and compare the written file against approval. Report an unparseable write immediately and print previous contents.

### 5. Verify against live behavior

For task-root setup, count tasks under each resolvable root; name zero-task roots and confirm absent roots appear as skips. Report *N roots, M task folders, K skipped, U unreadable*. Nonzero unreadable counts make discovered totals lower bounds.

For requested runbook setup, recheck the approved directory's identity and readability. Report missing or unreadable sources rather than claiming verified access. Runbook-only and duty-only requests walk no task roots. Verify an approved duty setting against the same cadence rules without starting the secretary or reading its records.

## Output

Use lists:

- **Contract**: config path and governing section.
- **Discovered**: each proposed root's path, label, task count, then kitRoot; requested runbook path and availability; requested duty interval and activation state.
- **Delta**: populated §3 classes.
- **Excluded** and **Unreadable**: paths and reasons; omit empty classes.
- **Written**: `wrote <path>` or `declined (nothing written)`.
- **Verified**: task-discovery totals and zero-task roots when checked; requested runbook-directory or duty-setting checks and any unavailable source.

Close with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*):

- **Done:** the config written or declined, pointing at **Written** and **Delta**.
- **Know:** absent roots kept, an omitted kitRoot, unreadable task counts that make totals lower bounds, unavailable requested runbook paths, and secretary settings that take effect after stop and restart.
- **Next:** `/maintain` when the write added a task root.

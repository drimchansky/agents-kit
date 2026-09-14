---
name: init-config
description: Use when asked to create, update, or repair this machine's agents-kit config — discovers the task roots on disk, compares them against `~/.config/agents-kit/config.json`, and previews the delta for confirmation before writing. Never writes unasked, never discards a hand-authored entry.
argument-hint: '[search directories — defaults to the usual project parents]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

Writes only `~/.config/agents-kit/config.json`, after confirmation of its complete proposed contents. Discovery is read-only. Never mutate Git or write outside `~/.config/agents-kit/`, including the state directory. Resolve no task or domain pack.

## When to Use

Use for machine config setup, refresh, repair, or task-root registration. Root semantics belong to `./references/workflow/task-layout.md`; task creation/discovery belongs to `plan-task` or `refine-idea`.

## Process

### 1. Read the contract, then the current file

Read `./references/workflow/task-store.md` § *The root registry* for the schema, then the existing config before proposing changes. Report unreadability or invalid JSON with the error line; treat contents as unknown, not empty. Offer a replacement only for confirmation against the user's visible original. Report unknown keys and preserve their entries unchanged.

### 2. Discover the roots on disk

Search invocation directories, or existing `~/Documents`, `~/Developer`, `~/Projects`, `~/repos`, `~/src`, `~/Work`, plus the current project. Full-home search requires an explicit `~` argument because it is expensive.

- Apply `./references/workflow/task-store.md` § *The root registry* walking rules and `./references/workflow/task-layout.md` § *One task, one flat folder* recognition, including legacy suffix forms.
- For tasks under `<x>/.agents/tasks/`, propose that canonical root, not the project directory.
- Otherwise climb to the highest ancestor where every sibling directory leads to tasks or carries GROUP_CONTEXT, or the ancestor itself carries GROUP_CONTEXT. Preserve shared grounding inside the proposed root (`./references/workflow/task-store.md` § *Shared group context*). Climb out of lifecycle containers first (`./references/workflow/task-archiving.md`, `./references/workflow/task-backlog.md`).
- Additionally skip `tests/fixtures/` trees; fixture tasks are not stores.
- Count and name every unreadable directory with its error throughout delta, preview, and output.
- Identify kitRoot by `setup.ts`, `CORE_RULES.md`, and `references/`. Ask about multiple checkouts; if none exists, omit the key and say so. An installed agent home cannot substitute.

Use `~` for home-relative proposed paths. Propose labels from project names for canonical roots, otherwise root basenames; generic `tasks` uses its parent's name. Invite label edits in the preview.

### 3. Compare, and preview the delta

Preserve and report registered roots discovery did not find. Removing hand-authored entries requires the user's explicit choice. Classify results:

- **new**: discovered and unregistered; propose adding it.
- **unchanged**: registered/discovered with matching path and label.
- **absent**: registered path missing here; keep it, noting possible unmounted volume or other machine.
- **unregistered but not proposed**: found but excluded; name the reason.
- **unreadable**: unexamined directory with its error, not a completeness claim.

Without config, every discovered root is new. Preview changed entries and the complete final JSON. Explain discovery and possible creation destination under `./references/workflow/task-destinations.md`, once-per-run absent-root reporting, and canonical-only discovery after deleting config.

### 4. Gate the write

Ask once after displaying the full proposal. On confirmation, create the config directory if needed and write exactly the approved file. Declining writes nothing; say so.

Re-read, parse, and compare the written file against approval. Report an unparseable write immediately and print previous contents.

### 5. Verify against live behavior

Count tasks under each resolvable root; name zero-task roots and confirm absent roots appear as skips. Report *N roots, M task folders, K skipped, U unreadable*. Nonzero unreadable counts make discovered totals lower bounds.

## Output

Use lists:

- **Contract**: config path and governing section.
- **Discovered**: each proposed root's path, label, task count, then kitRoot.
- **Delta**: populated §3 classes.
- **Excluded** and **Unreadable**: paths and reasons; omit empty classes.
- **Written**: `wrote <path>` or `declined (nothing written)`.
- **Verified**: totals and zero-task roots.
- **Next:** `/maintain` after adding a root; otherwise state no handoff.

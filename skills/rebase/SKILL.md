---
name: rebase
description: Rebase the current Git branch onto a confirmed base, or resume its paused rebase, preserving intended commits and configured signing. Use when the user asks to rebase or continue a rebase; never push as part of this skill.
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules.
2. Read `./references/engineering/rules.md` for the engineering overlay.

An explicit rebase request authorizes this operation and clear conflict resolutions. Skill selection alone grants no Git writes. Use the requested checkout, preserving commit messages, hooks, and signing. Do not stash, skip, abort, reset, or push without instruction. Ask when target, replay range, or conflict intent is unclear.

## Inspect and select

Read repository instructions, status, branch, HEAD, and active operation. Resolve metadata through `git rev-parse --git-path rebase-merge` and `git rev-parse --git-path rebase-apply`, including linked worktrees. Existing rebase goes to Resume; another unfinished operation blocks starting.

For a new rebase:

- Require clean index/tracked worktree; inspect untracked overwrite risks and leave those paths intact. Stop if local work prevents rebasing.
- Resolve destination from the request or established PR/task base. Tracking upstream alone does not establish the intended base. Refresh only the relevant remote branch within authorization; ask before using a tip whose freshness remains uncertain.
- Inspect the graph and exact replay set. After upstream rewrite, establish the old boundary from recorded base, reflog, or patch comparison; merge-base alone can include obsolete upstream commits. Require that boundary to be an ancestor of the original tip and list selected commits. Ask about unresolved range ambiguity.
- Capture branch, original tip, old boundary, and destination SHA before mutation; announce destination and range. Report no change when destination is already incorporated unless history rewriting was requested. Establish intended merge topology before replaying merges; do not silently flatten them.

## Start or resume

Read [hardware signing](./references/engineering/git-hardware-signing.md) before commands that can create rewritten commits. Apply its discovery, touch warning, and permission handling to the initial rebase and every continuation.

Immediately before starting the rebase, recheck branch, original tip, clean tracked state, and absence of another operation. When approval is needed, include checks inside the approved invocation. Stop on drift rather than silently selecting another range.

Start a linear rebase with `git rebase --no-autostash --no-update-refs --onto DESTINATION_SHA OLD_BOUNDARY_SHA`, substituting captured SHAs. Add topology/history options only within the established request.

### Resume

Inspect status, unresolved paths, staged/unstaged diffs, and `git rebase --show-current-patch` when available. Read stored original branch/tip, destination, completed steps, and todo. Recover the old boundary or intended picks from session/history; metadata may omit it. Retain destination and sequence; do not start another rebase or change its base. Inspect pending exec/custom todo actions before running them.

- **Conflicts:** resolve only current-replay files, preserving intended changes and relevant upstream behavior. Ask about semantic ambiguity. Review and stage only resolutions; require no unresolved entries or unrelated staged changes before continuing.
- **Signing failure:** verify the index belongs to this replay. Applied changes and a rescheduled pick may coexist; a repeated todo entry grants no permission to delete/skip. Select hardware access through that reference before continuing once. Inspect any further failure, and report its blocker without repeating unchanged attempts.
- **Other stops:** distinguish edit, empty commit, hook/todo failure, and unrelated changes. Follow requested history edits; ask before dropping work or changing an unclear action.

Before `git rebase --continue`, recheck operation identity, HEAD, todo, index, and worktree against inspected state. Run checks inside escalation when applicable; stop and inspect approval-time drift. Use `GIT_EDITOR=true` only to accept an existing message unchanged. Read resulting state after failure; do not claim index/todo stayed untouched.

## Verify and report

Confirm original branch, removed rebase metadata, and destination ancestry. With the old boundary known, `git range-diff OLD_BOUNDARY_SHA..ORIGINAL_TIP_SHA DESTINATION_SHA..HEAD`; inspect every changed, added, or dropped patch. Otherwise compare identifiable picks and report incomplete-range verification; do not guess a boundary. Check merge topology separately. Explain upstream-equivalent omissions; equal commit counts prove nothing.

Check required signatures on new commits, separating missing signatures from missing local trust. Run applicable non-fixing repository checks over the rebased result and conflict resolutions; report unavailable/failing validation separately from rebase completion.

Report branch, destination, old/new tips, replayed/omitted commits with reasons, checks, and final worktree status. If paused, name the stopped commit, blocker, and next safe action. An active rebase is not success; pending validation stays explicit. Publishing requires its own request.

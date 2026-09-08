---
name: rebase
description: Rebase the current Git branch onto a confirmed base, or resume its paused rebase, preserving intended commits and configured signing. Use when the user asks to rebase or continue a rebase; never push as part of this skill.
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules.
2. Read `./references/engineering/rules.md` for the engineering overlay.

An explicit user request to rebase, including natural language, authorizes this operation and clear conflict resolutions needed to complete it. Selecting this skill alone grants no Git writes. Work in the requested checkout; do not stash user changes, skip commits, abort, reset, or push without the user's instruction. Preserve commit messages and hooks. Ask only when the target, commit range, or a conflict's intended behavior cannot be established.

## Inspect and select

Read the repository instructions, `git status`, current branch and HEAD, and any active operation before choosing a command. Resolve rebase metadata with `git rev-parse --git-path rebase-merge` and `git rev-parse --git-path rebase-apply`; linked worktrees do not necessarily have a `.git` directory. An existing rebase goes to **Resume** below. A different unfinished Git operation blocks starting a rebase.

For a new rebase:

- Require a clean index and working tree. Inspect untracked paths for possible overwrites; leave them intact. If local work prevents rebasing, report it and stop.
- Resolve the destination from the user's request or established PR/task base. A branch's tracking upstream can be its own published copy; it does not establish the intended PR base. If the destination is remote, fetch only the relevant branch when refreshing it is within the request. If freshness cannot be established, disclose that and ask before using a potentially stale tip.
- Inspect the graph and identify the exact commits to replay. When the base branch was rewritten, use the recorded old base, reflog, or patch comparison to establish the old boundary; a merge-base alone may include obsolete upstream commits. Confirm that boundary is an ancestor of the original tip and list the selected commits. Ask if the boundary remains ambiguous.
- Capture the branch name, original tip, old boundary, and resolved destination SHA in the session before mutation. Announce the destination and selected range. If the destination is already incorporated, report no change unless the user requested a specific history rewrite. If the selected range contains merges, establish the intended topology before proceeding; do not silently flatten it.

## Start or resume

Read [hardware signing](./references/engineering/git-hardware-signing.md) before any command that can create rewritten commits. Apply its permission handling to both the initial rebase and each continuation.

For a new linear rebase, use `git rebase --no-autostash --no-update-refs --onto DESTINATION_SHA OLD_BOUNDARY_SHA`, substituting the captured SHAs. This keeps the replay range explicit and limits ref updates to the current branch. Add topology or history-editing options only when they match the established request. Immediately before execution, recheck the branch, original tip, clean tracked state, and absence of another operation. If approval is required, put these checks inside the approved invocation so they run after approval. Stop on drift instead of recalculating and replaying a new range silently.

### Resume

Inspect status, unresolved paths, staged and unstaged diffs, and the current patch (`git rebase --show-current-patch` when available). Read the stored original branch/tip, destination, completed steps and remaining todo where the backend provides them. Recover the original replay boundary or intended commit set from prior context and available history; rebase metadata may not retain that boundary. Keep the stored destination and sequence; do not start another rebase or change the base during continuation. Inspect any pending `exec` or other custom todo action before allowing it to run.

- **Conflicts:** resolve only files involved in the current replay, preserving both the intended change and relevant upstream behavior. Ask about semantic ambiguity. Review and stage only the resolved paths, then confirm there are no unresolved entries or unrelated staged edits before `git rebase --continue`.
- **Signing failure:** confirm the staged patch belongs to the stopped replay. A signing error can leave applied changes and reschedule the failed pick; a repeated todo entry alone is not permission to delete or skip it. Use the shared reference to select hardware access, then continue the existing rebase. If it still fails, inspect the new state and report the blocker; do not repeat unchanged attempts.
- **Other stops:** distinguish an intentional edit, an empty commit, a failed hook or todo command, and unrelated user changes. Follow the requested history edits; ask before dropping work or changing an action whose intent is unclear.

Before each continuation, recheck the operation identity, HEAD, todo and index/worktree state against what was just reviewed; run those checks inside an escalated invocation when applicable. If they changed while awaiting approval, stop and inspect again. Use `GIT_EDITOR=true` only when continuing should accept the existing message unchanged. Never claim a failed continuation left the index or todo untouched; read the resulting state.

## Verify and report

After success, confirm the original branch is checked out, rebase metadata is gone, and the destination is an ancestor of its new tip. When the original replay boundary is known, compare `OLD_BOUNDARY_SHA..ORIGINAL_TIP_SHA` with `DESTINATION_SHA..HEAD` using `git range-diff`; inspect every changed, added or dropped patch. Otherwise compare identifiable original picks with their replacements and report the limit on verifying the complete range; do not substitute a guessed boundary. Check the graph separately when preserving merges. Account for upstream-equivalent commits rather than assuming equal counts prove correctness.

Check signatures on newly created commits when signing was required, distinguishing a missing signature from verification that lacks local trust configuration. Run the repository's applicable non-fixing checks over the rebased result, including conflict resolutions; report unavailable or failing checks. A completed rebase and passing validation are separate outcomes.

Report the branch, destination, old/new tips, commits replayed or omitted with reasons, checks, and final worktree status. If paused, identify the stopped commit, blocker, and next safe action. Do not report success while a rebase is active or hide pending validation. Any publishing step requires its own user request.

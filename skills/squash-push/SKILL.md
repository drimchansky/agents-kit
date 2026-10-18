---
name: squash-push
description: Squash all commits belonging to the current Git branch into one commit and push it with an explicit force-with-lease. Use when the user asks to squash a branch and force-push its replacement history.
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules.
2. Read `./references/engineering/rules.md` for the engineering overlay.

## Authorization

Require an explicit request for both the branch squash and its force-push, including natural language. Selecting this skill alone grants no Git writes. That request covers the soft reset and replacement commit below. Ask only for missing authorization or unresolved targets; retain permission already granted in the session.

## Select the range and destination

Read repository instructions, branch, HEAD, status, and active Git operation. Require an attached branch, clean tracked worktree and index, and no unfinished operation. Leave untracked files intact; do not stage or stash local work.

Resolve the base from the request or established PR/task context. The branch's tracking upstream can identify its published copy, not its base. Refresh relevant remote refs, inspect the graph, and pin the unique merge-base with the original tip as `BOUNDARY_SHA`. After a base rewrite, establish the old boundary from recorded history or reflog instead. Require an ancestral boundary and an unambiguous range; ask when either remains uncertain. Do not infer permission to rewrite a repository's default or base branch.

Resolve one push endpoint and one full destination ref, `refs/heads/BRANCH`, from the request, PR, or push configuration. Inspect push URLs and ref mappings; do not assume the fetch URL or local branch name is the destination. Ask if multiple destinations remain plausible.

Read the destination directly from that endpoint and capture its full tip as `REMOTE_SHA`. Fetch that branch when needed to inspect its history. Require that tip to be an ancestor of the original local tip, or obtain explicit approval to replace identified remote-only commits. A confirmed absent branch uses an empty expected tip; connection or authentication failure does not prove absence.

Capture the local branch ref, original tip `OLD_SHA`, original tree, boundary, endpoint, destination ref, and expected remote tip. Inspect `BOUNDARY_SHA..OLD_SHA`, including merges, and the aggregate diff. Zero commits ends without writing. One commit whose only parent is the boundary needs no rewrite; keep it and proceed to verification and push. Otherwise create one single-parent commit, including the final effects of merges.

Prepare a concise commit message from the complete change, following repository conventions and any user-supplied message. Preserve required attribution and trailers without inventing sign-offs. Save it outside the worktree. Before mutation, display the range/count, boundary, destination, and proposed message. An already explicit squash-and-push request needs no second approval.

## Create the replacement

Read [hardware signing](./references/engineering/git-hardware-signing.md) and apply its signer discovery and device handling before creating the commit.

Immediately before mutation, compare the branch, HEAD, index tree, tracked worktree, and operation state with the captured state. Put these checks inside any approved invocation. Stop on drift; retain `OLD_SHA` in the session as the recovery tip.

Run `git reset --soft BOUNDARY_SHA`. Before committing, require the same branch, HEAD at the boundary, and index tree equal to the captured original tree. Require no unstaged tracked changes or active operation. Run `git commit -F MESSAGE_FILE`, using the prepared path. Add `--allow-empty` when the selected commits have no net tree change. Preserve hooks and configured signing.

After any command failure, inspect HEAD, index, and worktree before reporting the stopped state. Keep the message file if the commit failed. Do not push, reset again, or repeat a failed signing or hook command unchanged. Report the recovery tip and remaining staged changes; do not discard them.

## Verify and push

Require the replacement's tree to equal the captured original tree and its only parent to equal the boundary. Confirm the original branch, clean tracked state, actual message, required signatures, and exactly one commit above the boundary. A hook-induced difference blocks pushing. Run applicable non-fixing repository checks and stop publishing on failures or unavailable required checks. Remove the message file after successful commit verification.

Capture the verified tip as `NEW_SHA`. Immediately before pushing, recheck local branch, HEAD, tree, and clean tracked state. Use the pinned endpoint, full destination ref, and original expected remote tip:

```sh
git push --no-follow-tags --recurse-submodules=no --force-with-lease=DESTINATION_REF:REMOTE_SHA PUSH_ENDPOINT NEW_SHA:DESTINATION_REF
```

Substitute the captured values and quote each argument. For an absent branch, retain the colon and leave `REMOTE_SHA` empty. Never replace the lease with plain `--force`, a leading `+`, or a newly fetched expectation to defeat rejection. Push only this ref; do not bypass hooks or remote protection.

On rejection, retain the local squash and report local completion separately from the failed push. On uncertain transport results, query the exact destination before claiming failure or retrying. Confirm the remote ref equals `NEW_SHA`; otherwise report the observed tip and stop.

## Output

Report the branch and destination, boundary, original/replacement tips, commits combined, final commit message, checks, and remote verification. Identify stale local tracking refs separately from the directly verified remote state. Include remaining local changes or recovery details when the run stopped.

Close with Handoff (`./references/workflow/user-facing-messages.md` § *Blocks*): Done names completed operations. Know names validation limits or retained local state. Awaiting you holds unresolved choices; Next names only necessary recovery work.

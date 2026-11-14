# Multi-Part Efforts: Sibling Folders

Propose sibling tasks when an effort has delivery seams that can land and be verified independently (`./decomposition.md`). Each confirmed sibling has its own context, goals, plan, result, optional ticket, and lifecycle (`./task-layout.md`). Goal count or file count alone does not require a split. A tightly coupled fix stays in one folder.

When the user explicitly requests one task, keep one folder and one plan. Use the useful seams to bound its steps by verifiable outcomes, dependencies, and checkpoints.

When parts have a blocking order, the `NN-` folder prefixes give that order:

```
.agents/tasks/01-schema/
.agents/tasks/02-api/
.agents/tasks/03-ui/
```

A plan step that waits on a sibling names that sibling, or one of its steps, on its `**Depends on:**` line (`../templates/plan.md`). Name the sibling by its folder name, written `<folder>` or `<folder> Step <n>`, such as `01-schema Step 2`.

A citation of a sibling is met once that sibling's plan is `done`. A citation of one of its steps is met once that step is checked or the sibling's plan is `done`. Read both from a read-only task-state run (`../scripts/task-state.md`; `<kit-root>`: `./task-store.md` § *Resolving `<kit-root>`*) on the sibling's folder in the same parent or under `<parent>/Archive/`. A citation of either form stays unmet when the helper is unavailable, the run exits non-zero, or neither place holds the sibling's folder. The recorded-done rule below is the exception: it can meet a citation of a sibling without a plan, whose run exits 1. When the sibling's `result.md` Current state `**Pointers:**` record a branch as `` branch `<branch>` ``, a citation meeting either form stays unmet until that branch is merged. That run's `currentState` holds those Pointers. A step citation can be met by its checked step while the sibling's plan is not `done`. With a recorded branch, such a citation also needs a commit record, checked before the merge proofs. The sibling's `result.md` must hold a `Checkpoint after Step <m>` record, with `<m>` at least the cited step's number, or a `Final implementation commit` record. A `**Commit:**` line of that record must name a landed commit, written `` SHA `<sha>` `` or as a settled hand-over (`./task-delivery.md` § *Checkpoint and final commits*). Read that line from `result.md` itself, since task-state's output omits it. Without such a record, the citation stays unmet, awaiting commit of that step, and takes no merge check. Run the merge checks read-only in the repository that `./task-delivery.md` § *Branch and worktree creation* → **Which repository** picks for the sibling. Resolve `<default-branch>` under **Resolving `<default-branch>`** in that section. Test the local default branch's current head, where a new task branch starts, without fetching. Accept the first successful proof in this order:

1. **Ancestry:** `git merge-base --is-ancestor <branch> <default-branch>` exits 0.
2. **Merged PR:** `gh pr view <branch> --json state,mergeCommit,headRefOid` reports state `MERGED`. Require `git merge-base --is-ancestor <mergeCommit.oid> <default-branch>` to exit 0. When `<branch>` exists locally, also require `git merge-base --is-ancestor <branch> <headRefOid>` to exit 0, so the merged PR holds the branch's current tip. This proof also applies when the branch no longer exists locally, without that head check.
3. **Patch equivalence:** `git cherry <default-branch> <branch>` exits 0 and prints no `+` lines.

Missing `gh`, failed reads, and unresolved branches provide no proof. A branch marked `(removed …)` takes only the merged-PR proof, without its head check. If no proof succeeds, the citation stays unmet, awaiting merge of that branch. When proof 2 read state `MERGED` but `<mergeCommit.oid>` is missing locally or is not an ancestor of `<default-branch>`, that unmet citation awaits update of the local default branch instead. A sibling whose Pointers record no branch takes no merge check.

Also check the citing task's own `result.md` Current state `**Pointers:**` for a live `` branch `<branch>` `` entry. An entry marked `(removed …)` is not live. With no recorded live branch, take no further test. Otherwise, call that branch `<citing-branch>` and keep the following tests read-only, without fetching. For a sibling branch that passed the merge check, repeat the ordered proofs above against `<citing-branch>` in place of `<default-branch>`. Accept the sibling tip's ancestry, the merged PR's merge-commit ancestry and head check, or patch equivalence to the citing branch. If none succeeds, the citation stays unmet, awaiting update of the citing branch from the default branch. For a removed sibling branch that passed the merge check, use only the merged-PR proof against `<citing-branch>`. If `gh` is missing, its read fails, or no merged PR is found, the citation stays unmet, awaiting update of the citing branch from the default branch. When a merged PR is found, require `git merge-base --is-ancestor <mergeCommit.oid> <citing-branch>` to exit 0. Any other exit leaves the citation unmet, awaiting update of the citing branch from the default branch.

A sibling without a plan in the same parent, not under `<parent>/Archive/`, meets a citation of itself or of one of its steps once it is recorded done. A done-record line in the parent's `GROUP_CONTEXT.md` qualifies under `./task-store.md` § *Shared group context*. Its own `CONTEXT.md` Open Questions can instead record its work as done. They can also record as done the ticket its Scope line in the parent's `GROUP_CONTEXT.md` names.

Siblings share no sibling-level context file or cross-folder links. Duplicate needed facts into each context when no applicable ancestor holds them. Within a registered root, cite group-wide constraints from `GROUP_CONTEXT.md` (`./task-store.md` § *Shared group context*). Name and source each inherited fact; every folder remains independently discoverable, movable, and archivable.

Keep one effort's siblings in one parent. Finished parts move under `<parent>/Archive/`; unstarted parts park under `<parent>/Backlog/` (`./task-archiving.md`, `./task-backlog.md`).

Choose and materialize cuts through `./decomposition.md` and `decompose-task`.

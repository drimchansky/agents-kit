# Task Delivery: Re-entry, Removal, the Branch-Convention Proposal, and the Live-Verification Gate

Creation and declarations: `./task-delivery.md`.

## The task worktree is the run's shared tree

A task worktree is the shared tree for serial executors, parallel seeds/merges, and health boundaries (`./executor-contract.md`, `./parallel-batch.md`). When creation skips or degrades, use the current checkout instead.

Keep `<task-dir>` at its resolved location, under the main checkout for project-local tasks (`./task-layout.md` § *One task, one flat folder*). Never write task records into a worktree's tracked copy instead. Executor batch worktrees are transient branchless scratch; the task worktree carries a durable branch and survives the run.

## Re-entry on resume

Read the result's Pointers branch and match `branch refs/heads/<branch>` in `git worktree list --porcelain` from the main checkout. Match branch identity, not a derived path; the user may have moved the worktree. Take the first applicable case:

- **Branch merged under § *Removal*, or gone**: report and create nothing. Ask whether to start a fresh follow-up branch or treat the task as delivered. Check this before adopting a surviving worktree.
- **Live branch, matched worktree**: re-enter and name the working location.
- **Live branch, no worktree**: announce and recreate on that existing branch: `git worktree add <main-checkout-path>.worktrees/<slug> <branch>`, without `-b`.
- **No recorded branch**: apply `./task-delivery.md` § *Branch and worktree creation* as a first run.

## Removal

At finalization, resolve the actual worktree path by its recorded branch using the re-entry match above. Do not derive the path from slug. With no matching worktree, skip its clean predicate and removal command; the branch checks and deletion still apply.

Require both predicates:

- **merged**: accept the first successful proof in order: observed PR state `MERGED` from `gh pr view <branch> --json state`; branch ancestry in freshly fetched `origin/<default-branch>`; or patch equivalence of every branch commit in that fetched ref. For ancestry run `git fetch origin <default-branch>`, then `git merge-base --is-ancestor <branch> origin/<default-branch>`. For patch equivalence use `git cherry origin/<default-branch> <branch>` and require no `+` lines. Resolve the default branch under `./task-delivery.md` § *Branch and worktree creation*. Neither `git branch --merged` nor the local default branch substitutes. A multi-commit squash without readable merged PR state may remain unproved; refuse it.
- **clean**: in the resolved worktree, require empty `git status --porcelain` and empty `git log --oneline <branch> --not --remotes`. This excludes staged, unstaged, untracked, and unpushed work.

Before removing anything, preflight `git branch -d`'s containment from the main checkout: `git merge-base --is-ancestor <branch> <upstream, else HEAD>`. This differs from the merged predicate; a newly created task branch may have no upstream. If containment fails, refuse the entire cleanup and leave branch and worktree together.

After all checks pass, run from the main checkout, in order:

```
git worktree remove <resolved worktree path>
git branch -d <branch>
```

Never force worktree removal or replace `-d` with `-D`. Record the actual outcome. After successful removal, retain the branch identifier as `` branch `<branch>` (removed YYYY-MM-DD) `` in Current-state Pointers.

`scripts/commit-scan.ts` matches this removed marker, a sanctioned copy per `AGENTS.md` § *Consumer lists*.

If worktree removal succeeds but branch deletion fails, record partial cleanup and name the surviving branch. Finalize anyway; do not force deletion to complete the record. A predicate or preflight refusal likewise records its reason, leaves both in place, and does not prevent finalization.

**Who removes:**

- `implement-task` finalization, directly to done or from in-review.
- `maintain`'s kit-scoped backstop lists leftover worktrees and recorded branches without worktrees. Apply the same predicates and require per-item confirmation. Terminal status alone qualifies for reporting, never removal.
- Reconcilers perform no Git writes. Their verified status advances leave delivery artifacts for a later implement-task pass or the backstop.

## Proposing an observed branch convention

On every user-invoked creation path whose engineering, repository, and path-existence gates passed, choose the branch name through this procedure (`./task-delivery.md`, `./skill-conventions.md` § *The invocation gate*). If a branch pattern is declared, use it without scanning. With neither AGENTS nor CLAUDE present, take the kit default without asking.

From the resolved implementation repository, tally the prefix before the first slash:

```
git for-each-ref --format='%(refname:short)' refs/remotes/origin
```

Strip `origin/`; use `refs/heads` instead when no remote exists. Ignore names without a slash, `task/`, and automation prefixes such as dependabot/renovate/.

Propose a prefix only when at least three branches carry it and it leads the runner-up by more than one. Otherwise use `task/<slug>` silently. Infer only the prefix, never the full layout, name-token position, or ticket placement. Propose `<observed>/<slug>`.

Offer two choices, naming the observed convention and the exact branches each choice produces: adopt and record it, or use the kit default. Do not offer unrecorded one-time use.

On explicit confirmation, write `Task branches follow <observed>/<slug>.` with the pattern in backticks into the repository's AGENTS or CLAUDE. If both exist, ask which before writing. Use its branching/delivery section or append a short section. State what was written. This confirmation authorizes the rule-file edit; branch creation alone does not.

## The live-verification gate

Where the repository declares live verification (`./task-delivery.md` § *Repo delivery declarations*), `plan-task` must draft a `G<n> (external)` goal naming the live outcome and yardstick (`./acceptance-criteria.md`). Surface a missing goal in hand-authored goals to the user; never silently add it.

`implement-task` tags the written goal pending external and parks at in-review while verification is outstanding (`./task-lifecycle.md`). A later run gates the user's reported live state against the accepted proxy before done.

This mechanism checks written goals only. Missing, predating, or deliberately omitted live goals can still finalize without a live check; implement-task does not independently enforce the declaration at acceptance. The mandate applies to the goals draft. No declared gate means no additional goal or status vocabulary.

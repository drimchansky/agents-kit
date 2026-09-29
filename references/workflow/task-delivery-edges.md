# Task Delivery: Re-entry, Removal, the Branch-Convention Proposal, and the Live-Verification Gate

Creation and declarations: `./task-delivery.md`.

## The task worktree is the run's shared tree

A task worktree is the shared tree for serial executors, parallel seeds/merges, and health boundaries (`./executor-contract.md`, `./parallel-batch.md`). When creation skips or degrades, use the current checkout instead.

Keep `<task-dir>` at its resolved location, under the main checkout for project-local tasks (`./task-layout.md` § *One task, one flat folder*). Never write task records into a worktree's tracked copy instead. Executor batch worktrees are transient branchless scratch; the task worktree carries a durable branch and survives the run.

## Re-entry on resume

Check `./implement-task-edges.md` § *Verification-only continuation* before this branch-re-entry procedure. It does not authorize branch creation for observation.

Read the result's Pointers branch and match `branch refs/heads/<branch>` in `git worktree list --porcelain` from the main checkout. Match branch identity, not a derived path; the user may have moved the worktree. Take the first applicable case:

- **Branch merged under § *Removal*, or gone**: report and create nothing. Ask whether to start a fresh follow-up branch or treat the task as delivered. Check this before adopting a surviving worktree.
- **Live branch, matched worktree**: re-enter and name the working location.
- **Live branch, no worktree**: announce and recreate on that existing branch: `git worktree add <main-checkout-path>.worktrees/<slug> <branch>`, without `-b`.
- **No recorded branch**: apply `./task-delivery.md` § *Branch and worktree creation* as a first run.

## Verification source after delivery

Before later `in-review → done` finalization, `implement-task` and both reconciliation directions select the fresh health surface by domain and affected target (`../engineering/acceptance-gate.md` § *Resolve live targets*). Documentation runs its domain health on the current deliverable set. Engineering work with a supported absence of affected deployed runtimes runs engineering health on the current work product and retains its evidence-backed live-check N/A disposition. Neither case requires a deployment identity merely because the task is in-review.

For each affected deployable engineering target, identify its implementation repository and delivered source commit behind the intended build from the result's delivery pointer and release path. A removed-branch marker or a green workload alone does not identify source. Correlate that commit and build with the observed release before claiming a live check passed. Use the same source to select the fresh finalization health surface, even after main advances past the merge.

For a checkout, require empty `git status --porcelain` and `git rev-parse HEAD^{tree}` equal to the delivered commit's tree ID before running the fresh finalization health boundary. Read that tree ID from the local object when present, otherwise from a read-only host query such as `gh api repos/<owner>/<repo>/commits/<sha> --jq .commit.tree.sha`, and record which. Tree identity lets the task worktree qualify after a squash, rebase, or merge whose result equals its own tree. A checkout whose tree differs, such as main after it advanced past the merge, is not a substitute. Where the commit object is available locally and permissions allow, a branchless scratch extraction from `git archive <delivered-commit>` may provide that source; prove the object identity and record the snapshot provenance. Run the same fresh boundary there only when its health recipe supports the extracted source. Do not create or move a branch, fetch into Git refs, or detach an existing checkout merely to observe delivery.

For deployable engineering work, an unidentified delivered source or unavailable matching health surface keeps `in-review` with source health pending. Name what would establish the proof, its owner, and the next action. A check that actually fails on the proven source is failed work, not pending source proof; follow the consumer's existing failure path. Keep § *Removal*'s predicates and permissions unchanged.

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

Every engineering plan resolves live targets and checks through `../engineering/acceptance-gate.md`, even without a repository declaration or a live goal. `plan-task` records the target mapping and verification in the plan; `implement-task` independently checks it before completion. An `(external)` goal still receives its own Acceptance verdict (`./acceptance-criteria.md`). A check without a goal ID remains a named pending check in result In review, not an invented goal.

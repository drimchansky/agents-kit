---
name: review-pr-loop
description: "Use when asked to watch a PR and keep reviewing it until it is clean: reviews the PR at its current head against its CI results, publishes the Critical/Major findings without asking each pass, then waits for the next push to settle and reviews again. Adds a worktree on the PR branch when no checkout holds it, and removes it after a clean ending. Claude Code only."
argument-hint: '[PR number or URL; defaults to the PR of the checked-out branch]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Composite over one PR: review it (`review-code`), read its checks, publish the Critical/Major tier (`publish-pr-review`), watch the head until the next push settles, and repeat until a pass is clean.

Your typed invocation is the standing consent for every review this run posts, on the PR Setup resolves and no other. It replaces `publish-pr-review` step 4's per-pass picker, which **Publish** pre-selects; model invocation is closed on both hosts (`./references/workflow/skill-conventions.md` § *The invocation gate*). Edit no code, title, PR state, or merge. The only writes to the repository are the one worktree Setup adds where no checkout holds the review branch, that branch's upstream config on a fork PR, **Sync**'s fast-forward of that branch, and that worktree's removal on a clean ending.

The PR's checks stand in for the project's verification scripts, so no pass runs lint, typecheck, or tests locally (`./references/engineering/review.md` § *Verification Scripts*).

## Host

The watches need a background shell, which on Claude Code is `run_in_background` (`./references/workflow/delegated-waiting.md` § *Per-host primitives*). Codex establishes no such surface: stop there naming `/review-code` then `/publish-pr-review` as the manual pass.

## Setup

- Resolve the PR once. With a number or URL, read that PR; with no argument, read the checked-out branch's. Both use `gh pr view <target> --json number,title,url,state,headRefOid,headRefName,baseRefName,isCrossRepository`. Require `OPEN`, naming any other state and stopping.
- Name the review branch: `headRefName` for a same-repository PR, and `pr-<number>` for a fork PR (`isCrossRepository` true), whose branch name can collide with yours.
- Require the PR in the checkout's repository: compare the `owner/repo` in its `url` against `gh repo view --json nameWithOwner --jq .nameWithOwner`. Every later `gh` call resolves the bare number against the checkout. Outside a checkout of that repository, whether no Git repository answers here or `nameWithOwner` names another one, find its main checkout on disk. Search with `find "$HOME" -maxdepth 5 -type d -name '<repo>' -not -path '*/node_modules/*' -not -path '*/.*'`, `<repo>` being the repository name from the `url`. Keep each hit where `git -C <hit> remote -v` lists a URL naming `<owner>/<repo>`, the `.git` suffix optional. Reduce each kept hit to the first entry of its `git worktree list --porcelain`, so a hit that is itself a linked worktree resolves to its main checkout, then deduplicate. Continue in the one path that survives, announcing it as one progress line (`./references/workflow/user-facing-messages.md` § *Blocks*): `🔵 In progress: checkout <path>`. Where several survive, ask which one, offering those paths; where none does, ask for a path and offer none. Every path offered is one the search returned; never invent one.
- Resolve the main checkout as the first entry of `git worktree list --porcelain`, read from the current checkout.
- Resolve the PR remote: the remote whose URL in `git remote -v` names `<owner>/<repo>`, the `.git` suffix optional. Where none does, stop naming the remotes and their URLs.
- Require a checkout on the review branch: `review-code`'s branch object is the current branch, and its approval verdict needs that kind. It is any worktree in that list whose `branch` is `refs/heads/<review-branch>`, the main checkout included. Skip entries marked `prunable`. Where one holds the review branch or the path below, stop and name `git worktree prune` for the user to run.
- Where none holds the branch, add one at `<main-checkout-path>.worktrees/<number>-<slug>`, `<slug>` being `headRefName` after its last `/`. PR 345 on `fix/ledger-invalidation-safe-rebuild` gives `345-ledger-invalidation-safe-rebuild`. Both cases below fetch the head first with `git fetch <pr-remote> refs/pull/<number>/head`, the ref that reaches same-repo and fork heads alike. A failed fetch stops Setup, naming the remote and Git's error. Announce the result as one progress line (`./references/workflow/user-facing-messages.md` § *Blocks*): `🔵 In progress: worktree <path> on <review-branch>`.
  - A local branch `<review-branch>` exists that no worktree holds: `git worktree add <path> <review-branch>`. Sync fast-forwards it to the PR head as usual.
  - No local branch exists: `git worktree add -b <review-branch> <path> FETCH_HEAD`. On a fork PR, then set `branch.pr-<number>.remote <pr-remote>` and `branch.pr-<number>.merge refs/pull/<number>/head`, as `gh pr checkout` does, so `review-code`'s branch lookup finds the PR.
- Every pass, the check poll, and the watch run in that checkout, the one Setup found or the one it added.
- Require `git status --porcelain` empty there. Uncommitted work would enter every review and diverge from the head the checks ran on.
- Carry the resolved number forward to every pass and every watch (`./references/workflow/pr-lookup.md`). Never rediscover the PR from the checkout mid-run.

The cap is 10 passes.

## The pass

Announce pass `i` as one progress line (`./references/workflow/user-facing-messages.md` § *Blocks*): `🔵 In progress: review pass <i>/10 on PR #<n> at <head-sha>`.

1. **Sync.** First repeat Setup's checkout checks: `git rev-parse --abbrev-ref HEAD` equals the review branch and `git status --porcelain` is empty. Stop naming the branch or the dirty paths otherwise; edits landed between passes would enter the review. Where local `HEAD` differs from the PR's `headRefOid`, run `git fetch <pr-remote> refs/pull/<number>/head` then `git merge --ff-only FETCH_HEAD`. That ref reaches a fork PR's head, which no base-repository branch carries. A failed fetch stops the loop, naming the remote. A refused fast-forward means the branch and the PR head diverged, by a force-push or by local commits the PR lacks: stop the loop, name both heads, and leave the reset to the user. Then require `git rev-parse HEAD` to equal the PR's `headRefOid`. A stale `FETCH_HEAD` leaves the two different: stop the loop naming both SHAs.

2. **Review.** Execute `../review-code/SKILL.md` end to end, with no argument and no flags. Its standalone settle runs in full, spot-check included, because this skill has no verify phase. Its launch packet carries `verification scripts: skip — the session reads the PR's checks` in place of the run instruction (`./references/workflow/reviewer-contract.md` § *Launch packet*). No reviewer, probe, or inline fallback runs a project script, and the tree Sync re-checked leaves `Divergence` at `None`. Print its **Summary** and **Reviewed** lines, and its **Review pass** line as `Review pass: delegated (<model>; scripts: CI)` or `Review pass: inline (<reason>; scripts: CI)`, whichever path it took. Its **Blocked output** stops the loop.

3. **CI.** Read the checks at the reviewed head, waiting first on the § *Check poll* while any is pending, then once with `gh pr checks <number> --json name,state,bucket,link,description`.
   - Every check in bucket `fail` or `cancel` becomes a Major finding appended to the review's Findings, its check name the locator, its description the text, and its link the evidence. Having no `file:line`, each rides in the review body rather than an inline comment (`../publish-pr-review/SKILL.md` step 3).
   - Checks the poll leaves pending, a PR reporting none, and a failed `gh` call are context: name each in the pass display, post none of them, and take the CI state as unknown.
   - The head moving under the checks is the publish step's re-check to catch, not this step's.

4. **Decide.** Where the Findings hold a Critical or Major entry, CI findings included, **Publish** them and start § *The watch*. Where they hold none and every check is in bucket `pass` or `skipping`, **Publish** posts the approval and the loop ends clean. Where they hold none but the CI state is unknown, publish nothing and end the loop naming the reason; approving on unread checks is not this skill's call.

5. **Publish.** Execute `../publish-pr-review/SKILL.md` end to end over the review, with its step 4 selection pinned. Pin `Critical/Major only` where any tier holds entries, and `Post approval — 0 comments` where every tier is empty. Every precondition, its step 5 re-check, and its own-PR COMMENT substitution still run; any stop it takes stops the loop. Print its step 6 report.

Minor findings and improvements are never posted and never hold the loop open. A pass renders no finding text in chat; the PR carries it.

## Check poll

Write this program to the session scratch directory and start it with `run_in_background`, substituting the resolved number. Wait on its completion signal (`./references/workflow/delegated-waiting.md` § *How to wait*). Remove the scratch file once collected. The poll settles only when the `--json bucket` read reports no check in bucket `pending`. One failed check beside running ones therefore keeps it polling. A read returning no JSON settles it too, leaving a PR with no checks and a failed `gh` call to step 3.

```sh
end=$(( $(date +%s) + 1800 ))
while :; do
  pending=$(gh pr checks <number> --json bucket --jq '[.[] | select(.bucket == "pending")] | length' 2>/dev/null)
  [ "${pending:-0}" = 0 ] && { echo "settled"; exit 0; }
  [ "$(date +%s)" -ge "$end" ] && { echo "pending"; exit 0; }
  sleep 60
done
```

It polls every minute and gives up after 30 minutes, which a check awaiting manual approval never reaches on its own.

## The watch

Write this program to the session scratch directory and start it with `run_in_background`, substituting the resolved number and the head the pass reviewed. Wait on its completion signal, running nothing against the PR while it is in flight, and report one progress line per check-in. Remove the scratch file once collected.

```sh
end=$(( $(date +%s) + 1800 ))
while :; do
  sleep 60
  [ "$(date +%s)" -ge "$end" ] && { echo "stalled: <reviewed-head>"; exit 0; }
  line=$(gh pr view <number> --json state,headRefOid --jq '.state + " " + .headRefOid') || { echo "error: gh pr view failed"; exit 0; }
  case "$line" in
    OPEN\ *) ;;
    *) echo "closed: ${line%% *}"; exit 0 ;;
  esac
  [ "${line#* }" = "<reviewed-head>" ] && continue
  sleep 300
  after=$(gh pr view <number> --json state,headRefOid --jq '.state + " " + .headRefOid') || { echo "error: gh pr view failed"; exit 0; }
  case "$after" in
    OPEN\ *) ;;
    *) echo "closed: ${after%% *}"; exit 0 ;;
  esac
  [ "${after#* }" = "${line#* }" ] && { echo "updated: ${after#* }"; exit 0; }
done
```

It polls every minute and reports only a head that has stood five minutes; a second push inside that window restarts the wait. It gives up after 30 minutes without a push, the same deadline as the poll. Its one printed line is the whole outcome: `updated: <sha>` opens the next pass, while `closed: <state>`, `error: <reason>`, and `stalled: <sha>` end the loop.

## Ending

The loop ends at the first of these, and nothing else:

- a clean pass, every check in bucket `pass` or `skipping`, its approval posted
- a pass with no findings whose CI state is unknown
- the 10th pass, its comments posted
- the watch reporting `closed:`, `error:`, or `stalled:`
- a Sync stop: wrong branch, uncommitted work, a failed fetch, a refused fast-forward, or a head that differs from `headRefOid`
- `review-code`'s blocked output, or any `publish-pr-review` stop
- your call-off

A clean ending removes the worktree Setup added, after **Publish** posts the clean pass's review: `git -C <main-checkout-path> worktree remove <path>`, without `--force`. A refusal leaves it in place, naming Git's reason. The branch stays.

## Output

One final response when the loop ends.

- **Headline:** why it ended, with the PR number, title, and URL.
- **Worktree:** the path Setup added, where it added one. A clean ending removes it; any other ending leaves it in place for `/fix-findings`.
- **Passes:** one line per pass — its number, the head it reviewed, its CI state, the Critical/Major count posted, and the verdict submitted.
- **Findings:** on any ending other than clean, the last pass's Critical and Major entries, in `review-code`'s Findings format. Omit on a clean ending.

**Next:** `/fix-findings` addresses what was posted, then `/commit` and a push; rerun `/review-pr-loop` to keep watching. `/review-code` alone gives a fresh pass that runs the local scripts and posts nothing. `git worktree remove <path>` removes a worktree the loop left in place.

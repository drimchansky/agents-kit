# Locating the PR a Follow-Up Acts On

**Scope `gh` to the reviewed repository.** A follow-up whose Reviewed line names `in <host>/<owner>/<repo>#<n>` takes that repository as the reviewed object's repository. Set `GH_HOST=<host>` and `GH_REPO=<host>/<owner>/<repo>` for every `gh` call the follow-up makes, the PR read included.

**Check the PR-form reviewed head.** Apply this rule only in `fix-findings` and `triage-findings-verify` when they act on session findings whose **Reviewed** line names `in <host>/<owner>/<repo>#<n>`. Both require `git merge-base --is-ancestor <head-sha> HEAD` to succeed with that line's head SHA, so `HEAD` is the reviewed head or descends from it. `fix-findings` also requires `git branch --show-current` to equal the PR's head branch. Read that branch with `gh pr view <n> --json headRefName`, taking `<n>` from that Reviewed line; a failed read fails this condition. `fix-findings` also requires a remote whose URL normalizes to that Reviewed line's repository under § *The PR base*. If any condition the skill applies fails, stop before any edit and name each failed condition. Name the reviewed head and current `HEAD`, and say to use a checkout at the reviewed head or a descendant of it. `fix-findings` also names the expected and current branches, expected repository, and remotes with their URLs. It also says to use a matching repository checkout on the PR's head branch.

**Read the PR a PR-form review names.** When the Reviewed line names `in <host>/<owner>/<repo>#<n>`, take `<n>` as the selected number and skip the commit query below. Read it as below, adding `headRefOid`. The follow-up then applies its own OPEN and reviewed-head checks. A failed read stops the follow-up, naming the cause.

**Rerun a PR-form review.** When a Reviewed line names `in <host>/<owner>/<repo>#<n>`, name its fresh review as `/review-code https://<host>/<owner>/<repo>/pull/<n>`. A redraft adds `-d`, and `/review-code-triage-verify` takes the same URL. Name the URL, not `#<n>`, because `#<n>` resolves under gh's default repository, which may differ in another checkout.

**Find an open PR at the reviewed head SHA.** Use the reviewed object's repository:

```
gh api --paginate repos/{owner}/{repo}/commits/<head-sha>/pulls --jq '.[] | select(.state == "open") | select(.head.sha == "<head-sha>") | .number'
```

Require exactly one match. Preserve pagination and the exact `.head.sha` filter: associated PRs may contain the commit without standing at it. Do not substitute a capped `gh pr list` scan or the checkout's PR.

Read the selected number with `gh pr view <number> --json <fields>`. Every follow-up requests `number,title,url,state`, plus any fields its skill names. Both calls require `gh`; accept only state `OPEN`.

**Carry the selected PR number forward.** A caller that already matched the reviewed head passes that number instead of repeating discovery.

**Coming up short has two outcomes, selected by the consumer:**

- `publish-pr-review` and `update-pr-description` stop and name the cause: missing `gh`, no GitHub remote, auth/network errors, non-OPEN state, multiple matches, or no match. Name all candidate numbers for multiple matches; do not choose one.
- `review-code` records missing PR context and continues reviewing the object's commits. Lookup failure does not block a standalone review. Supplied `review-pr-loop` context is scoped to one selected PR, so its lookup failures stop and a head move takes the loop's named retry outcome. A `#<n>` or PR URL argument also names one PR. A non-OPEN or failed read of that PR stops the review only in **Resolve the PR** (`../../skills/review-code/SKILL.md` § *Setup*). A failed read of its checks continues the review with CI unknown (`../engineering/review.md` § *Verification Scripts*).

For a stopping consumer, distinguish the two no-match cases and give the corresponding remedy:

- **GitHub lacks the head:** the commit lookup returns `No commit found for SHA`, as for an unpushed tip. Tell the user to push and rerun the follow-up; an unchanged reviewed head retains its review. This lookup authorizes no push.
- **GitHub has the head but no open PR stands at it:** the lookup succeeds with no exact-head match. Request a fresh review at the intended head; pushing cannot update the reviewed object. For a description follow-up, use `review-code -d`.

Use this shared query except for three branch-based context lookups:

- **`review-code`**, `../../skills/review-code/SKILL.md` § *Setup*: use the current branch's `gh pr view` without a positional argument for declared base and PR context, resolving that base per § *The PR base*. This applies to a branch review or a range ending at current HEAD, including an unpushed local tip. Both calls request `state`; anything other than `OPEN` supplies no PR context/base. When `gh pr view` reports no pull request for the branch, Setup also reads fork status per § *Fork status at a head SHA*. A range ending elsewhere uses the SHA query above. A `#<n>` or PR URL argument names the PR directly, with every `gh` call scoped to its host and repository. `review-pr-loop` supplies its selected number and expected head to those reads and its periodic checks during review. A head move returns the loop's named retry outcome; other lookup failures stop that pass, except a failed periodic check, which retries at the next interval.
- **`triage-findings`**, `../../skills/triage-findings/SKILL.md` § *Fetch*: PR mode has no reviewed object; its object is the branch PR's threads. Use `gh pr view --json number,url,title,state` without a positional argument, requiring `OPEN`. `triage-findings-verify` and `fix-findings` execute that Fetch section instead of copying its query.
- **`review-pr-loop`**, `../../skills/review-pr-loop/SKILL.md` § *Setup*: with no argument, use `gh pr view` without a positional argument for the checked-out branch's PR, requiring `OPEN`; a number or URL names the PR directly. Setup carries that number, its host and repository, and each pass's refreshed expected head into `review-code`, `publish-pr-review`, helpers, and the watch. A named head move retries within the pass cap, preserving reviews already posted for the old head. A failed submission is never retried.

## Fork status at a head SHA

Read a head SHA's fork status with this form of the shared query. It keeps pagination and the exact `.head.sha` filter, drops the open-state filter, and emits each match's number and repositories:

```
gh api --paginate repos/{owner}/{repo}/commits/<head-sha>/pulls --jq '.[] | select(.head.sha == "<head-sha>") | [.number, .head.repo.full_name, .base.repo.full_name]'
```

A PR whose head repository differs from its base repository reads `isCrossRepository` true, whatever its state. A null head repository, as a deleted fork leaves, reads the same. Take fork status from these fields alone, with no `gh pr view` read and no `OPEN` requirement. This query supplies no PR context or selected number.

The endpoint returns only open and merged PRs. A closed unmerged fork PR is therefore a lookup miss. A review takes the miss default in `../engineering/review.md` § *Verification Scripts*.

## The PR base

**Match a remote to a PR's repository.** A remote matches when its URL normalizes to the PR's `<host>/<owner>/<repo>`. Normalize HTTPS, `ssh://`, and SCP-style SSH URLs, plus an optional `.git` suffix. For an SSH URL, replace its host with the `hostname` that `ssh -G <host>` reports, as `gh` does, so a config alias matches its real host. Then map a resolved hostname equal to `ssh.github.com`, ignoring case, to `github.com`, as `gh` does. Compare the normalized host, owner, and repo case-insensitively, as `gh` does.

Resolve a PR's declared base this way wherever a consumer compares against it:

1. Select the PR remote: the checkout's remote whose URL normalizes to the PR's `<host>/<owner>/<repo>` as above.
2. Run `git fetch --refmap= --no-tags <pr-remote> refs/heads/<baseRefName>` under the hook-free checkout rule in `../engineering/review-evidence.md` § *Capture*. Then immediately take `git rev-parse FETCH_HEAD^{commit}` as the base SHA. The full ref keeps a same-named tag from standing in for the branch. Never compare against local `<baseRefName>` or `<pr-remote>/<baseRefName>` except under the standalone no-argument review or range's `-d` guard fallback below. With the empty `--refmap=`, the fetch updates neither ref.
3. Compute the merge-base with `git merge-base <base-sha> <head-sha>`.

A missing matching remote or a failed fetch takes the consumer's outcome:

- `publish-pr-review` and `update-pr-description` stop. Name the remotes and their URLs when none matches, or the remote and Git's error when the fetch fails.
- `review-code` stops the review on the PR form and with supplied `review-pr-loop` context.
- A standalone no-argument review, or a range's `-d` guard without supplied `review-pr-loop` context, first tries `refs/remotes/<pr-remote>/<baseRefName>` when a remote matched, then `refs/heads/<baseRefName>`. Resolve each with `git rev-parse --verify <ref>^{commit}`; use the first resolved SHA as the base, marked possibly stale. Only when neither resolves use the local heuristics in **Determine base branch** (`../../skills/review-code/SKILL.md` § *Setup*).

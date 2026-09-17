# Locating the PR a Follow-Up Acts On

**Find an open PR at the reviewed head SHA.** Use the reviewed object's repository:

```
gh api --paginate repos/{owner}/{repo}/commits/<head-sha>/pulls --jq '.[] | select(.state == "open") | select(.head.sha == "<head-sha>") | .number'
```

Require exactly one match. Preserve pagination and the exact `.head.sha` filter: associated PRs may contain the commit without standing at it. Do not substitute a capped `gh pr list` scan or the checkout's PR.

Read the selected number with `gh pr view <number> --json <fields>`. Every follow-up requests `number,title,url,state`, plus any fields its skill names. Both calls require `gh`; accept only state `OPEN`.

**Carry the selected PR number forward.** A caller that already matched the reviewed head passes that number instead of repeating discovery.

**Coming up short has two outcomes, selected by the consumer:**

- `publish-pr-review` and `update-pr-description` stop and name the cause: missing `gh`, no GitHub remote, auth/network errors, non-OPEN state, multiple matches, or no match. Name all candidate numbers for multiple matches; do not choose one.
- `review-code` records missing PR context and continues reviewing the object's commits. Lookup failure does not block a standalone review. Supplied `review-pr-loop` context is scoped to one selected PR, so its lookup failures stop and a head move takes the loop's named retry outcome.

For a stopping consumer, distinguish the two no-match cases and give the corresponding remedy:

- **GitHub lacks the head:** the commit lookup returns `No commit found for SHA`, as for an unpushed tip. Tell the user to push and rerun the follow-up; an unchanged reviewed head retains its review. This lookup authorizes no push.
- **GitHub has the head but no open PR stands at it:** the lookup succeeds with no exact-head match. Request a fresh review at the intended head; pushing cannot update the reviewed object. For a description follow-up, use `review-code -d`.

Use this shared query except for three branch-based context lookups:

- **`review-code`**, `../../skills/review-code/SKILL.md` § *Setup*: use the current branch's `gh pr view` without a positional argument for declared base and PR context. This applies to a branch review or a range ending at current HEAD, including an unpushed local tip. Both calls request `state`; anything other than `OPEN` supplies no PR context/base. A range ending elsewhere uses the SHA query above. `review-pr-loop` is the exception: it supplies its selected number and expected head to both reads. A head move returns the loop's named retry outcome; other lookup failures stop that pass.
- **`triage-findings`**, `../../skills/triage-findings/SKILL.md` § *Fetch*: PR mode has no reviewed object; its object is the branch PR's threads. Use `gh pr view --json number,url,title,state` without a positional argument, requiring `OPEN`. `triage-findings-verify` and `fix-findings` execute that Fetch section instead of copying its query.
- **`review-pr-loop`**, `../../skills/review-pr-loop/SKILL.md` § *Setup*: with no argument, use `gh pr view` without a positional argument for the checked-out branch's PR, requiring `OPEN`; a number or URL names the PR directly. Setup carries that number, its host and repository, and each pass's refreshed expected head into `review-code`, `publish-pr-review`, helpers, and the watch. The loop retries a named pre-submission head move within its pass cap and never retries a failed submission.

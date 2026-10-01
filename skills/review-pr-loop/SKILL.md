---
name: review-pr-loop
description: "Use when asked to watch a PR and keep reviewing it until it is clean: publishes available findings before waiting for CI, including all tiers until its first successful submission and Critical/Major afterward, then watches for the next push. A pass with no Critical or Major findings and passing checks approves the PR from your account, or comments on your own PR. Adds a worktree on the PR branch when no checkout holds it, and removes it after a clean ending."
argument-hint: '[PR number or URL; defaults to the PR of the checked-out branch]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Composite over one PR: review it (`review-code`), publish available findings (`publish-pr-review`), settle CI, then watch the head until a pass is clean.

Your typed invocation is the standing consent for every review this run posts, on the PR Setup resolves and no other. **Publish** pre-selects `publish-pr-review` step 4's picker for each submission, including a second submission within one pass. Model invocation is closed on both hosts (`./references/workflow/skill-conventions.md` § *The invocation gate*). Edit no code, title, PR state, or merge. The only writes to the repository are the one worktree Setup adds where no checkout holds the review branch, the local `<review-branch>` it creates with that worktree where none exists, that branch's upstream config on a fork PR, the `refs/pull/<number>/head` fetches in Setup and **Sync**, **Sync**'s fast-forward of that branch, and that worktree's removal on a clean ending.

The PR's checks stand in for the project's verification scripts, so no pass runs lint, typecheck, or tests locally (`./references/engineering/review.md` § *Verification Scripts*).

## Host

Launch and collect the check poll and watch through `./references/workflow/delegated-waiting.md` § *Shell commands*. If the host's named shell tools are unavailable, stop under § *Output* and name the missing capability.

## Setup

- Resolve the PR once. With a number or URL, read that PR; with no argument, read the checked-out branch's. Use `gh pr view <target> --json number,title,url,state,headRefOid,headRefName,baseRefName,isCrossRepository`. Require `OPEN`, naming any other state and stopping.
- Parse `<host>/<owner>/<repo>` from the selected PR URL. Set `GH_HOST=<host>` and `GH_REPO=<host>/<owner>/<repo>` for every later `gh` call, background process, helper, and sibling skill. Do not change GitHub CLI configuration.
- Label the terminal session for the selected PR per `./references/workflow/terminal-session.md`.
- Name the review branch: `headRefName` for a same-repository PR, and `pr-<number>` for a fork PR (`isCrossRepository` true), whose branch name can collide with yours.
- Require a local checkout whose remote normalizes to the exact selected `<host>/<owner>/<repo>`. Normalize HTTPS, `ssh://`, and SCP-style SSH URLs, plus an optional `.git` suffix. For an SSH URL, replace its host with the `hostname` that `ssh -G <host>` reports, as `gh` does, so a config alias matches its real host. Try the current checkout first. If it does not match, search with `find "$HOME" -maxdepth 5 -type d -name '<repo>' -not -path '*/node_modules/*' -not -path '*/.*'`. Keep each hit where `git -C <hit> remote -v` has that exact normalized identity. Reduce each kept hit to the first entry of its `git worktree list --porcelain`, then deduplicate. Continue in the one path that survives, announcing `🔵 In progress: checkout <path>` as one progress line (`./references/workflow/user-facing-messages.md` § *Blocks*). Where several survive, ask which one, offering those paths. Where none does, ask for a path and offer none. Every offered path came from the search.
- Resolve the main checkout as the first entry of `git worktree list --porcelain`, read from the current checkout.
- Resolve the PR remote using the same exact normalized `<host>/<owner>/<repo>` identity. Where none does, stop naming the remotes and their URLs.
- Require a checkout on the review branch because `review-code` reviews the current branch for an approval verdict. Use a non-prunable worktree whose `branch` is `refs/heads/<review-branch>`, including the main checkout. Ignore unrelated prunable entries. Where a prunable entry names the review branch or the planned path below, stop and name `git worktree prune` for the user to run.
- Where none holds the branch, add one at `<main-checkout-path>.worktrees/<number>-<slug>`, `<slug>` being `headRefName` after its last `/`. PR 345 on `fix/ledger-invalidation-safe-rebuild` gives `345-ledger-invalidation-safe-rebuild`. Where that path exists and is not an empty directory, stop and name what occupies it. Both cases below fetch the head first with `git fetch <pr-remote> refs/pull/<number>/head`, the ref that reaches same-repo and fork heads alike. A failed fetch stops Setup, naming the remote and Git's error. Announce the result as one progress line (`./references/workflow/user-facing-messages.md` § *Blocks*): `🔵 In progress: worktree <path> on <review-branch>`.
  - A local branch `<review-branch>` exists that no worktree holds: `git worktree add <path> <review-branch>`. Sync fast-forwards it to the PR head as usual.
  - No local branch exists: `git worktree add -b <review-branch> <path> FETCH_HEAD`. On a fork PR, then set `branch.pr-<number>.remote <pr-remote>` and `branch.pr-<number>.merge refs/pull/<number>/head`, as `gh pr checkout` does, so branch-based PR lookups in that worktree find the PR.
- Every pass, the check poll, and the watch run in that checkout, the one Setup found or the one it added.
- Require `git status --porcelain` empty there. Uncommitted work would enter every review and diverge from the head the checks ran on.
- Carry the selected number, host, repository, and expected head into every pass, sibling skill, helper, and watch (`./references/workflow/pr-lookup.md`). Each live read uses that selected PR rather than rediscovering one from the branch.

Every Setup stop uses § *Output*, including stops after worktree creation. Report `Passes: none — Setup stopped: <reason>` and name any added worktree left in place.

The cap is 10 passes. Start with no full-tier review submitted; only a successful **Publish** submission changes that state.

## The pass

Announce pass `i` as one progress line (`./references/workflow/user-facing-messages.md` § *Blocks*): `🔵 In progress: review pass <i>/10 on PR #<n> at <head-sha>`.

1. **Sync.** Repeat Setup's checkout checks: `git rev-parse --abbrev-ref HEAD` equals the review branch and `git status --porcelain` is empty. Stop naming the branch or dirty paths otherwise. Read the selected PR by number for `state,headRefOid,baseRefName`; require `OPEN`. Where local `HEAD` differs from that `headRefOid`, run `git fetch <pr-remote> refs/pull/<number>/head` then `git merge --ff-only FETCH_HEAD`. A failed fetch stops the loop, naming the remote. A refused fast-forward means the branch and PR diverged: stop, name both heads, and leave any reset to the user. Where the resulting `HEAD` differs from `headRefOid`, re-read the selected PR once. Continue when its live `headRefOid` equals `HEAD`; otherwise stop naming both heads. Carry the matching value as this pass's expected head.

2. **Review.** Execute `../review-code/SKILL.md` with no review argument and no flags, supervising it under § *Review head checks*. Supply the selected PR context and expected head throughout the review. Because this skill has no verify phase, its standalone settle runs in full unless a head check interrupts it. Its launch packet carries `verification scripts: skip — the session reads the PR's checks` (`./references/workflow/reviewer-contract.md` § *Launch packet*). No review path runs a project script, and Sync leaves `Divergence` at `None`. On completion, print its **Summary**, **Reviewed**, and **Review pass** lines, with `scripts: CI` on the latter. Any terminal stop other than the named head-moved outcome stops the loop. That outcome takes **Head moved** below.

3. **CI snapshot.** Read the selected PR's `state,headRefOid`; a head mismatch takes **Head moved**, while a failed read or non-OPEN state stops. Read checks once with `gh pr checks <number> --json name,state,bucket,link,description`, without waiting for pending checks. Use valid check JSON even when the exit status reports failed or pending checks. Repeat the selected PR read after the checks before any decision.
   - A snapshot yields CI findings only when no check is pending or this pass has already polled. There, every check in bucket `fail` or `cancel` becomes a Major finding appended to the review's Findings, its check name the locator, its description the text, and its link the evidence. Having no `file:line`, each rides in the review body rather than an inline comment (`../publish-pr-review/SKILL.md` step 3).
   - Pending checks are nonterminal until **Continue** runs the poll, and a failed or cancelled check beside them waits for that later snapshot because a rerun can still pass it. Checks left pending afterward, no checks, and failed check reads make CI unknown. Name this context in the pass display; pending or unavailable checks are not findings.

**Head moved.** A named expected/live head mismatch marks the review stale and discards its remaining unpublished entries. Stop active review work under § *Review head checks* and submit no further review for that head. Preserve every successful submission and the full-tier submission state it established. Record the expected head and every value already known, using `not run` for later phases. Unless this was pass 10, restart § *The watch* with that pass's expected head as `<reviewed-head>`. Its fresh stability interval must complete before `updated:` opens the next pass. Refresh the selected PR in Sync; never carry the observed head forward as review state.

4. **Decide.** Until a full-tier review has been submitted, select all Critical/Major and Minor findings, Improvements, and CI findings. Afterward, select only Critical/Major findings, including CI findings. Accumulate this pass's original selected entries by tier, including CI findings, for approval gating and the final report. Exclude entries already submitted or suppressed in this pass from later batches, without counting them again. Mark the pass clean only when that original Critical/Major tier is empty and a nonempty check snapshot contains only `pass` or `skipping`. A non-empty batch goes through **Dedupe**. An empty clean batch goes directly to **Publish** with all three supplied tiers empty. Otherwise go to **Continue** without submitting an empty review.

5. **Dedupe.** Run this only for a non-empty batch. Resolve `<kit-root>` per `./references/workflow/task-store.md` § *Resolving `<kit-root>`*. Fetch review threads with `node <kit-root>/scripts/pr-comments.ts <PR-URL>` and read its JSON per `./references/scripts/pr-comments.md`. Fetch review bodies and general comments with `gh pr view <number> --json reviews,comments` per `../triage-findings/SKILL.md` § *Fetch*. Resolve the authenticated login on the selected host with `gh api user --jq .login`.

   Missing tools, failed reads or identity resolution, `paginationComplete: false`, or any incomplete thread comments stop the loop. Report the gap under **Inaccessible context** and submit no further review.

   Classify fetched candidates through `../triage-findings/SKILL.md` § *Classify addressed vs unaddressed*. Only its open findings authored by the authenticated login may suppress an entry. Match an anchored entry on normalized path and claim. Match other unanchored entries on locator and claim. Suppress a CI entry only when a standing review body contains both its check name and claim. Keep every entry without both parts of its match.

   If every batch entry is suppressed, repeat **CI snapshot**'s selected PR read before proceeding. A head mismatch takes **Head moved**; another failure stops. Report found and suppressed counts by selected tier. A clean pass goes to **Publish** with all three supplied tiers empty; otherwise go to **Continue**. If entries remain, supply each retained entry in its original tier to **Publish**. Retain the original review's **Reviewed** provenance.

6. **Publish.** Execute `../publish-pr-review/SKILL.md` immediately over the supplied tiers. Pass `review-pr-loop using review-code` as workflow identity. Set publication scope to `Critical/Major + Minor + Improvements` until a full-tier review has been submitted, and `Critical/Major only` afterward, including clean routes. Pass a COMMENT override unless the pass is clean, including while CI is pending or unknown. For retained entries, pin the option matching that publication scope. For a clean pass with no retained entries, pin `Post approval — 0 comments`. The supplied tiers override its normal step 1 source; all counts and payloads derive from them. Its preconditions, live recheck, and own-PR COMMENT substitution still run. Print its step 6 report for each submission.

   A named head-moved outcome takes **Head moved**. Any other stop ends the loop. After a successful submission, mark the full-tier review submitted if this submission selected all tiers. A submitted clean pass ends the loop, including one with retained Minor findings or Improvements. Otherwise go to **Continue**.

7. **Continue.** When CI is pending and this pass has not polled, repeat **CI snapshot**'s selected PR read. A mismatch takes **Head moved**; another failure stops. Run § *Check poll*. Its `moved: <sha>` outcome takes **Head moved**, naming that SHA as the observed head. Otherwise repeat steps 3–6 on the same reviewed head, without rerunning **Review** or advancing the pass counter. This publishes newly observed CI failures or a clean verdict after any earlier findings submission. Poll at most once per pass. When CI is not pending or this pass already polled, end when the original Critical/Major tier is empty and CI is unknown, naming the unavailable context. Otherwise end on pass 10 or start § *The watch*.

Minor findings and Improvements do not hold the loop open. After a full-tier submission, they are outside the selected set. A pass renders no finding text in chat; the PR carries it.

## Review head checks

These checks supervise the review phase from inside it, the exception `./references/workflow/skill-conventions.md` § *The rule* permits.

During **Review**, the session reads `gh pr view <number> --json state,headRefOid` using Setup's selected host and repository. Check at entry and every 60 seconds through setup, delegated waiting, inline review, and settlement. Keep waits and work batches within that interval, rechecking after each wait or batch. Recheck before accepting a reviewer return and before rendering completed review output, even when the interval has not elapsed.

Launch delegated reviewers in the background so the session can check the PR while they work. Use bounded waits or a condition monitor through `./references/workflow/delegated-waiting.md` § *Per-host primitives* and § *Shell commands*. Cap shell collection waits at 60 seconds while supervising a review, overriding that reference's longer default. These remote reads do no work against the reviewed tree.

When a check reports a head mismatch or a non-OPEN PR, or a recheck before acceptance or rendering fails, stop adopting evidence. Cancel the pass's active reviewers and review commands through the stop primitive `./references/workflow/delegated-waiting.md` § *Per-host primitives* names for the host. Where cancellation is unavailable, request cooperative termination and collect confirmation; a collected completion also confirms termination. Discard partial and late returns; intentional cancellation never takes `reviewer failed`, inline fallback, or clean-review output. Confirm all review work has stopped before another **Sync** can change the checkout. If termination cannot be confirmed, stop the loop and name the outstanding handles.

On a head mismatch, report `Review stopped: head moved (<expected-head> -> <live-head>)` and take **Head moved**. A non-OPEN PR ends the loop with that reason. A failed or malformed interval read is a skipped check, retried at the next interval. A failed or malformed recheck before accepting a reviewer return or rendering output ends the loop with that reason. Remove any condition monitor when Review completes or stops. A head-moved pass counts toward the cap and retains no partial findings for the next pass.

## Check poll

Write this program to a temporary scratch file, substituting the resolved number, host, repository, and reviewed head. Launch it as `sh <scratch-file>` and collect it in the selected checkout (`./references/workflow/delegated-waiting.md` § *Shell commands*). Remove the scratch file once collected. A nonzero exit or missing `settled`/`pending`/`moved:` outcome stops the loop. A changed head prints `moved: <sha>` and ends the poll early; a failed head read falls through to the checks read. The poll settles only when the `--json bucket` read reports no check in bucket `pending`. One failed check beside running ones therefore keeps it polling. A read returning no JSON settles it too, leaving a PR with no checks and a failed `gh` call to step 3.

```sh
export GH_HOST=<host> GH_REPO=<host>/<owner>/<repo>
end=$(( $(date +%s) + 1800 ))
while :; do
  head=$(gh pr view <number> --json headRefOid --jq .headRefOid 2>/dev/null)
  [ -n "$head" ] && [ "$head" != "<reviewed-head>" ] && { echo "moved: $head"; exit 0; }
  pending=$(gh pr checks <number> --json bucket --jq '[.[] | select(.bucket == "pending")] | length' 2>/dev/null)
  [ "${pending:-0}" = 0 ] && { echo "settled"; exit 0; }
  [ "$(date +%s)" -ge "$end" ] && { echo "pending"; exit 0; }
  sleep 60
done
```

It polls every minute and gives up after 30 minutes, which a check awaiting manual approval never reaches on its own.

## The watch

Write this program to a temporary scratch file, substituting the resolved number, host, repository, and the head the pass reviewed. Launch it as `sh <scratch-file>` and collect it in the selected checkout (`./references/workflow/delegated-waiting.md` § *Shell commands*). Run nothing against the PR while it is in flight, and report one progress line per check-in. Remove the scratch file once collected. A nonzero exit or missing `updated:`/`closed:`/`error:`/`stalled:` outcome stops the loop.

```sh
export GH_HOST=<host> GH_REPO=<host>/<owner>/<repo>
deadline=$(( $(date +%s) + 14400 ))
reviewed=<reviewed-head>
head=$reviewed
stable_since=
while :; do
  now=$(date +%s)
  [ "$now" -ge "$deadline" ] && { echo "stalled: $head"; exit 0; }
  delay=60
  [ $((deadline - now)) -lt "$delay" ] && delay=$((deadline - now))
  sleep "$delay"
  now=$(date +%s)
  [ "$now" -ge "$deadline" ] && { echo "stalled: $head"; exit 0; }
  line=$(gh pr view <number> --json state,headRefOid --jq '.state + " " + .headRefOid') || { echo "error: gh pr view failed"; exit 0; }
  case "$line" in
    OPEN\ *) ;;
    *) echo "closed: ${line%% *}"; exit 0 ;;
  esac
  next=${line#* }
  if [ "$next" = "$head" ]; then
    [ "$head" != "$reviewed" ] && [ $((now - stable_since)) -ge 300 ] && { echo "updated: $head"; exit 0; }
    continue
  fi
  head=$next
  stable_since=$now
done
```

It polls every minute and reports only a changed head that has stood five minutes. Another push restarts only that stability interval. The immutable four-hour deadline applies even while heads keep changing, and no sleep crosses it. At the deadline, `stalled:` names the latest observed head. Its one printed line is the whole outcome: `updated: <sha>` opens the next pass, while `closed: <state>`, `error: <reason>`, and `stalled: <sha>` end the loop.

## Ending

The loop ends at the first of these, and nothing else:

- a clean pass with no original Critical/Major entries and passing or skipping checks, its verdict submitted
- a pass with no original Critical/Major entries and unknown CI, after any retained lower-tier entries were submitted
- a dedupe read with inaccessible context, preserving any earlier submission
- the completed 10th pass, whether it submitted a review, suppressed duplicates, or observed a moved head
- the watch reporting `closed:`, `error:`, or `stalled:`
- the check poll or watch failing to launch, collect, or return a valid outcome
- review work whose termination cannot be confirmed
- a Sync stop: wrong branch, uncommitted work, a failed fetch, a refused fast-forward, or a head that still differs from the re-read `headRefOid`
- a selected-PR read failing, returning malformed data, or reporting a non-OPEN state during Sync, Review, CI snapshot, Dedupe, or Continue, except a failed or malformed Review interval read
- a `review-code` or `publish-pr-review` stop other than its named head-moved outcome
- a Setup stop
- your call-off

A clean ending removes the worktree Setup added, after **Publish** posts the clean pass's review: `git -C <main-checkout-path> worktree remove <path>`, without `--force`. A refusal leaves it in place, naming Git's reason. The branch stays.

## Output

One final response when the loop ends.

- **Headline:** why it ended, with the PR number, title, and URL when Setup resolved them.
- **Worktree:** the path Setup added, where it added one. A clean ending removes it; any other ending leaves it in place for `/fix-findings`.
- **Passes:** one line per pass. Name its number, reviewed head, CI state, and cumulative found and suppressed counts by selected tier. List each submission's scope, inline and body post counts, and verdict, including submissions before a later stop or head move. An interrupted review uses its expected head and `not run` for CI and counts; name the observed head on a mismatch. For no submission, use verdict `none` and name the reason, including unknown CI, already reported, inaccessible dedupe context, or head moved.
- **Findings:** on any ending other than clean, render the latest review's original selected entries in `review-code`'s Findings and Improvements formats. Dedupe never removes them from this report. Omit on a clean ending, before any review completed, or when the latest review was interrupted or marked stale by **Head moved**.
- **Inaccessible context:** failed or incomplete selected-PR, CI, and dedupe reads, with the reason. Omit when none.

**Next:** `/fix-findings` addresses what was posted and commits it, then push; rerun `/review-pr-loop` to keep watching. `/review-code` alone gives a fresh pass that runs the local scripts and posts nothing. `git worktree remove <path>` removes a worktree the loop left in place.

# Delta Reviews

A delta review keeps the object of a full branch review: kind `branch` at the PR's current head and merge-base. Only the reviewer's reading narrows, to the commits after a previous reviewed head (`./reviewer-contract.md` § *Launch packet*). Risk, evidence, capture, and CI stay at whole-PR scope at the current head.

## Coverage forms

The `Coverage:` line of a published review (`../../skills/publish-pr-review/SKILL.md` step 3) takes one of three forms:

- `PR changes; base <merge-base>; head <reviewed-head>`: a full review.
- `PR changes since <prev-head>; base <merge-base>; head <reviewed-head>`: a delta review that started at `<prev-head>`.
- `commit range; base <merge-base>; head <reviewed-head>`: a range review.

## Coverage chain

A link is a review on the PR by the authenticated login, with non-null `submittedAt`, whose `Coverage:` line takes the full or the delta form. A range review is never a link, and neither is a review without a `Coverage:` line. A dismissed review (`state` `DISMISSED`) counts as a link.

A chain is one full link followed by zero or more delta links. The link before a delta link is a link whose head is that delta's `<prev-head>`. A link's chain is intact when every condition below holds:

- Following each delta link to the link before it reaches a full link. Where several links share that head, one intact chain among them suffices.
- Every link names `base <current merge-base>`.
- Every link's head is a commit in the checkout: `git cat-file -e <sha>^{commit}` succeeds.
- Each link's head is an ancestor of the next link's head, and the newest link's head is an ancestor of the current head. Check each pair with `git merge-base --is-ancestor <earlier> <later>`.

## Resolving the previous head

Walk the authenticated login's links on the PR newest first by `submittedAt`. Skip each link whose head is the current head. Take the first link whose head is a strict ancestor of the current head, whose `base` is the current merge-base, and whose chain is intact. Its head is `<prev-head>`, and the run is a delta from it. A rerun at an unchanged head repeats the delta the last review read.

The resolution reads the PR's `reviews`, the authenticated login on the PR's host, and the current head and merge-base. Run its Git checks at the effective root.

## Full-review reasons

The run is a full review when a read fails or the walk takes no link. Check the reasons below in order, make no read after the first that applies, and name it:

- `no open PR`: the object has no open PR context. This covers no PR for the branch, a non-OPEN PR, missing `gh`, and a repository with no GitHub remote.
- `read failed (PR: <error>)`: the PR read failed with another `gh` error, such as auth or network.
- `PR base from fallback (<ref | local heuristics>)`: the base fetch failed, so the base came from a fallback ref or local heuristics.
- `read failed (login: <error>)`: the authenticated-login read failed.
- `read failed (reviews: <error>)`: the PR read returned no `reviews` list.
- `no earlier review`: the login has no link at a head other than the current head.

Otherwise, check the newest link not at the current head and its chain in this order, and name the first failure:

- `merge-base changed (<link-base> -> <merge-base>)`: a link in that chain names another base.
- `<sha> missing from checkout`: a link head in that chain is not a commit in the checkout.
- `<earlier> is not an ancestor of <later>`: a link head is not an ancestor of the next head or of the current head.
- `chain does not reach a full review`: following the chain back finds no full link.

After the walk takes a link, a failed threads read under § *Earlier findings* still makes the run full, as `read failed (review threads: <reason>)`.

On the PR form and under `review-pr-loop` context, a missing, non-OPEN, or unreadable PR and a failed base fetch stop the review instead (`../../skills/review-code/SKILL.md` § *Setup*).

## Earlier findings

A delta review carries forward the authenticated login's earlier Critical/Major findings on the PR, whichever review posted them.

- **Read.** Fetch review threads with `node <kit-root>/scripts/pr-comments.ts <PR-URL>`, reading its JSON per `../scripts/pr-comments.md`. Take review bodies from the PR's `reviews`. Missing tools, a failed read, `paginationComplete: false`, or incomplete thread comments count as a failed threads read.
- **Set.** Take each thread whose first comment the login wrote and each entry in a body of the login's reviews. Keep those that open with the GitHub marker for Critical or Major (`./user-facing-messages.md` § *Surface adapters*). Drop entries labeled `(Pre-existing)` after the marker. Drop CI entries, whose locator is a check name rather than a `file:line` or tracked path.
- **Supersede.** When a later review of the login's posted the same finding again, the earlier copy is superseded. Match copies as `../../skills/review-pr-loop/SKILL.md` § *The pass* step 5 **Dedupe** matches entries. Classify only the latest copy, so the run lists each finding once.
- **Classify.** Put each through `../../skills/triage-findings/SKILL.md` § *Classify addressed vs unaddressed*. Drop an **addressed** finding. List an **open** finding under the review's **Still open** and never post it again. Send a **verify** finding to the reviewer in the packet's `earlier findings:` line.
- **Verify.** The reviewer returns each sent finding as fixed or still present. Drop a fixed one. A finding still present enters **Findings** at its current anchor. Across a fleet, a finding counts as fixed only when every standing return marks it fixed.
- **Approval.** While **Still open** lists an entry or **Findings** holds a finding still present, the review recommends no approval.

# Delta Reviews

A delta review keeps the object of a full branch review: kind `branch` at the PR's current head and merge-base. Only the reviewer's reading narrows, to the commits after a previous reviewed head (`./reviewer-contract.md` § *Launch packet*). Risk, evidence, capture, and CI stay at whole-PR scope at the current head.

## Reviewed line

A delta review's `Reviewed` line (`../../skills/review-code/SKILL.md` § *Output*) names `delta from <prev-head>` after the merge-base:

- `Reviewed branch at <head-sha> (merge-base <merge-base-sha>) delta from <prev-head> by <model>`.
- On the PR form: `Reviewed branch at <head-sha> (merge-base <merge-base-sha>) delta from <prev-head> in <host>/<owner>/<repo>#<n> by <model>`.

A run that announced `full review (<reason>)` prints its line without `delta from`. Consumers read the kind, head, merge-base, PR reference, and model as on a full review's line.

## Coverage forms

The `Coverage:` line of a published review (`../../skills/publish-pr-review/SKILL.md` step 3) takes one of three forms:

- `PR changes; base <merge-base>; head <reviewed-head>`: a full review, from a `branch` Reviewed line without `delta from`.
- `PR changes since <prev-head>; base <merge-base>; head <reviewed-head>`: a delta review, from a `branch` Reviewed line naming `delta from <prev-head>`.
- `commit range; base <merge-base>; head <reviewed-head>`: a range review.

## Coverage chain

A link is a review on the PR by the authenticated login, with non-null `submittedAt`, whose `Coverage:` line takes the full or the delta form. A range review is never a link, and neither is a review without a `Coverage:` line. A review whose metadata block (`../../skills/publish-pr-review/SKILL.md` step 3) carries an `Unsettled:` line is never a link either. A dismissed review (`state` `DISMISSED`) counts as a link.

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
- **Supersede.** When a later review of the login's posted the same finding again, the earlier copy is superseded. Match copies as `../../skills/review-pr-loop/SKILL.md` § *The pass* step 5 **Dedupe** matches entries. Send only the latest copy, so the run lists each finding once.
- **Send.** On every delta pass, send every finding left after **Supersede** to the reviewer in the packet's `earlier findings:` line. Send each one whether or not its thread is resolved or its anchored lines changed.
- **Verify.** The reviewer returns each sent finding as fixed, still present, or not a defect. The session checks each `not a defect` mark against the head, for example with `git show <head-sha>:<path>` at the cited lines. A mark passes only when that evidence shows the finding's claim never held. Drop a sent finding only when every standing return marks it fixed or with a passing `not a defect`, a single reviewer included. Every other sent finding counts as still present, including one a return omits or marks any other way.
- **Place.** A finding still present whose thread has `isResolved: true` re-enters **Findings** at its current anchor. When no return gave it a current anchor, it keeps its original anchor. List any other finding still present under the review's **Still open** and never post it again. That covers an unresolved thread and a body entry, which has no thread.
- **Approval.** While **Still open** lists an entry or **Findings** holds a finding still present, the review recommends no approval.

## Verify probes

A verify composite under a resolved delta (`../../skills/review-code-triage-verify/SKILL.md` § *Phase 3 — Verify*) gives each batch one diff:

- A whole-object finding takes the whole object's diff, `<merge-base>...<head-sha>`. Three kinds are whole-object findings:
  - A re-entered finding: an earlier finding that § *Earlier findings* **Place** returns to **Findings**, one still present whose thread is resolved.
  - A PR-form CI finding from **Read the PR's checks** (`../../skills/review-code/SKILL.md` § *Review pass*).
  - A defect that **Capture evidence** observed (`../../skills/review-code/SKILL.md` § *Review pass*).
- A delta finding takes the delta's diff, `<prev-head>...<head-sha>`. Delta findings are the reviewers' findings and the `-x` probes' findings.

Keep whole-object and delta findings in separate batches, splitting a concern zone that holds both. Each probe then names the diff its findings came from (`./probe-shape-verify.md`). **Still open** entries take no batch and no verdict.

---
name: publish-pr-review
description: Use when asked to publish review-pr's findings to the PR on GitHub — posts Major/Critical findings as inline comments, or a short approval if none. Follow-up to /review-pr or /review-pr-triage-verify; the user provides no findings.
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Publish the review that `/review-pr` produced to the PR on GitHub. This skill deliberately mutates the PR, and it is model-invocable, so its own invocation is not the permission for that outward-facing change — step 4's preview-and-confirm gate is, and nothing reaches GitHub until the user confirms there. It posts exactly one review: Major and Critical findings as inline comments (a neutral **Comment** review), or a short **Approve** when there are none. It posts nothing else — no code edits, no title/state/merge changes, and no Minor findings, improvements, summary, or other terminal-only detail. The review body names the model(s) that performed the review.

## Preconditions — stop if unmet

- **A review-pr run must exist in this conversation.** Use the Findings and the **Reviewed** provenance line (reviewed head SHA + merge-base SHA + model) from the most recent `/review-pr` in this session — or from `/review-pr-triage-verify`, whose Output carries both in review-pr's own format because its review phase *is* a `/review-pr` run. Either satisfies this precondition and every "review-pr" reference below. If there is none — or the run predates the **Reviewed** line, so no reviewed SHAs are available — stop and tell the user to run `/review-pr` first, then `/publish-pr-review`. Do not review the diff or invent findings yourself.
- **An open PR must exist for the current branch.** Find it with `gh pr view --json number,title,url,state,author,headRefOid,baseRefName` (requires `gh` CLI; no positional argument targets the current branch's PR). If the command fails because `gh` is missing or the repo has no GitHub remote, or there is no open PR for the branch (the command errors, or the PR's state is not `OPEN`), note that and stop. Also record whether this is your own PR — compare `author.login` to your own login (`gh api user --jq .login`) — since both the preview (step 4) and the own-PR Approve fallback (step 5) depend on it.
- **The reviewed diff must still be current.** Compare the PR's `headRefOid` to the reviewed head SHA from the **Reviewed** line, and recompute the merge-base of the PR base and head (`git merge-base <baseRefName> <headRefOid>`; `git fetch` the base first if it may be stale) to compare against the reviewed merge-base SHA. If either differs, the branch advanced or the PR was retargeted since the review — stop and tell the user to re-run `/review-pr` on the current head, so you never post findings (or an approval) against a diff that was never reviewed. Because `/review-pr` now adopts the PR's own `baseRefName` as its base, that re-run resolves a base mismatch instead of repeating it — the old loop, where review-pr's local heuristic could disagree with the PR's declared base and this check never converged, is closed. If the mismatch is instead that the PR's declared base is *wrong* for the review, retarget the PR on GitHub so `baseRefName` matches the intended base before re-running: this check is anchored to `baseRefName`, so that is the base both skills must share.

## Process

1. **Select what to publish** — from review-pr's most recent Findings, take only those at 🔴 **Critical** and 🟡 **Major** severity. Everything else (🟢 Minor, Improvements, Inaccessible context, the Summary) stays in the terminal and is never posted. From `/review-pr-triage-verify`, the list to select from is its **Findings** section, never **Batches** — that one also carries the **Withdrawn** findings its probes disproved. Keep each selected finding's `file:line` and its full text — what's wrong, plus the recommendation and impact — verbatim; don't re-word or re-review. A finding carrying a verification note — `(Inconclusive: …)` / `(Unverified: …)`, which `/review-pr-triage-verify` attaches when its probes couldn't settle the finding — keeps it: the note is part of the finding's text, and stripping it would post an unsettled claim with a settled one's authority.

2. **Name the reviewing model(s)** — take the primary reviewing model from review-pr's **Reviewed** provenance line (it records the model that produced the findings); don't assume the model now running this publish step performed the review. If review-pr's output also carries a `Cross-check:` line that isn't `skipped` (i.e. `-x` ran a cross-vendor pass per `./references/workflow/probe-cross-check.md` — read it only when that line is present), also name that cross-vendor engine. <!-- cold --> This is a single attribution line in the review body, e.g. `Reviewed by <model>` (+ `, cross-checked by <engine>` when `-x` ran).

3. **Build the review payload:**
   - **Findings present** — a **Comment** review (`event: COMMENT`). One inline comment per Major/Critical finding: body prefixed per `./references/engineering/review.md` — `Critical:` or `Major:` — followed by the finding's full text (what's wrong, the recommendation, and the impact). The review `body` is the attribution line from step 2, plus the `Findings off the changed lines:` list from the next bullet whenever any exist — no summary, no Minor findings, no improvements.
   - **No findings** — a short **Approve** (`event: APPROVE`): a one-line approval plus the attribution line. No inline comments, nothing else.
   - Map each finding to `{ path, line, side: "RIGHT", body }` (use `side: "LEFT"` for a finding on a removed line). A finding that can't be anchored to a changed line — its `file:line` isn't part of the diff, or it has no `file:line` at all (a PR-wide finding like "split this PR" or "separate the refactor") — cannot be an inline comment; collect those into the review `body` under a short `Findings off the changed lines:` list rather than dropping them.

4. **Preview, then confirm** — print exactly what will be posted: the verdict (Comment / Approve), the review body, and every inline comment with its `file:line`. Then ask the user to confirm. Post nothing until they do. If it's your own PR and the verdict is Approve, say so here (see step 5's fallback) so the preview matches what actually posts.

5. **Re-check the head, then post one review on confirmation** — first re-run the head-and-merge-base check from the preconditions above against the live PR: if the branch advanced or was retargeted during the confirmation wait, stop without posting and tell the user to re-run `/review-pr` on the current head, then `/publish-pr-review` — that guarantee has to hold at post time, not just at skill start; as at the precondition, review-pr now adopts the PR's `baseRefName`, so the re-run converges (retarget the PR first only if its declared base is itself wrong). Then write the payload to a scratch JSON file and submit it in a single call: `gh api --method POST repos/{owner}/{repo}/pulls/<number>/reviews --input <file>` (`gh` substitutes `{owner}`/`{repo}` from the current repo). The JSON is `{ "event": "...", "commit_id": "<reviewed head SHA>", "body": "...", "comments": [ { "path": ..., "line": ..., "side": ..., "body": ... }, ... ] }` (omit `comments` for Approve). Set `commit_id` to the reviewed head SHA from the **Reviewed** line — the precondition confirmed it's still the PR head — so the review anchors to exactly what was reviewed instead of silently defaulting to a later head. Remove the scratch file afterward — even if the call fails. Post exactly the findings and attribution — no "Generated with Claude Code" or other AI/tool attribution footer, even if an environment default requests one. If the call fails (auth, network, permissions), report the error and stop.
   - **Own-PR Approve fallback:** GitHub rejects `APPROVE` on your own PR. When it's your own PR (the own-PR check recorded in the preconditions), the clean path posts the same one-line body as a `COMMENT` review instead, and you note it was posted as a comment because you can't approve your own PR. The findings path already uses `COMMENT`, which works on your own PR.

6. **Report** the result — PR number, title, URL, the verdict posted, and how many inline comments went up.

Do not edit code, change the title or PR state, merge, or post Minor findings / improvements — none of that was asked.

## Verification

Confirm the protocol invariants before finishing:

- [ ] review-pr Findings and **Reviewed** line found in this conversation, an open PR exists for the branch, and its head and merge-base still match the reviewed diff — re-checked immediately before posting, not just at start — otherwise stopped
- [ ] Only 🔴 Critical / 🟡 Major findings published; Minor, improvements, and summary kept terminal-only
- [ ] Previewed the exact verdict + inline comments and posted only after the user confirmed
- [ ] Posted exactly one review — `COMMENT` with inline comments, or `APPROVE` (own-PR `COMMENT` fallback) when clean — with `commit_id` set to the reviewed head SHA, carrying the model-attribution line (primary model from review-pr's **Reviewed** line) and no AI-attribution footer
- [ ] Inline comments carry `Critical:` / `Major:` prefixes with correct `file:line`; any verification note on a finding preserved; findings off the changed lines listed in the body, not dropped
- [ ] Code, title, PR state, and merge left untouched; scratch payload file removed (even on failure)
- [ ] Result (PR number, title, URL, verdict, comment count) reported

---
name: publish-pr-review
description: Use when asked to publish review-code's findings to the PR on GitHub — offers its Critical/Major findings, its Minor findings, and its improvements as counted severity tiers and posts the one you select as inline comments, or offers a short approval when all three are empty. Follow-up to /review-code or /review-code-triage-verify; the user provides no findings.
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Publishes one review from this session's upstream review. Invocation alone grants no publishing permission; step 4's selection authorizes the payload. Edit no code, title, PR state, or merge; publish nothing outside the selected source tiers. Include the reviewing models in the body.

## Preconditions — stop if unmet

- Require Findings and Reviewed provenance from the latest `/review-code` or `/review-code-triage-verify`: head SHA, merge-base SHA, and model. If absent, request `/review-code` followed by this skill. Do not review or invent findings here.
- Read Reviewed kind before lookup. Reject `paths` in one line: a path set proposes no change; publishing requires branch/PR review. Unrecognized forms: `../review-code/SKILL.md` § *Output*. <!-- cold -->
- For branch/range, match an open PR at the reviewed head through `./references/workflow/pr-lookup.md`, taking its stop outcome. Preserve the selected number. GitHub missing the head requires push then rerun; an existing head without an exact open PR requires fresh review. Lookup authorizes no push.
- Read that number with `number,title,url,state,author,headRefOid,baseRefName`; require OPEN. Compare author.login with `gh api user --jq .login` to establish an own PR. Do not substitute the checkout's PR.
- Require headRefOid equal to the reviewed head. For **branch**, recompute `git merge-base <baseRefName> <headRefOid>`, fetching the base if potentially stale, and require the reviewed merge-base. On mismatch, stop for fresh review; correct a wrongly declared PR base before that review.
- For **range**, compare against the object's recorded base, not the PR's baseRefName. Head equality establishes no whole-PR coverage. Every range posts COMMENT and names its recorded base/head, even when it might cover the whole PR.

## Process

1. **Resolve source tiers.** From `/review-code`, tiers 1 and 2 use its Findings section: Critical/Major entries, then Minor entries. Tier 3 uses Improvements. From `/review-code-triage-verify`, use Findings, Minor findings, Improvements respectively. Never publish Batches, Withdrawn findings, Summary, Inaccessible context, or Cross-check detail. Keep each entry's location and full problem/recommendation/impact text verbatim. Remove only `cited by k/N` corroboration markers. Preserve all Inconclusive/Unverified notes, including out-of-probe-scope notes, at every severity. Count existing entries without reviewing the diff again.

2. **Name reviewing models.** Take the model from Reviewed, dropping `×N`; do not attribute the review to the current publisher. A non-skipped Cross-check adds its cross-vendor engine (`./references/workflow/probe-cross-check.md`). <!-- cold --> Use `Reviewed by <model>`, plus `, cross-checked by <engine>` when applicable.

3. **Build selectable payloads.** Each selection includes its tier and preceding tiers.

   - Prefix entries under `./references/engineering/review.md` § *Calibrate Severity*: Critical:/Major: for tier 1, Nit: for tier 2, FYI: for tier 3. Follow with the full preserved text and verification notes; do not use Optional:.
   - Use COMMENT when the selection contains Critical/Major, APPROVE otherwise. Range and own-PR overrides force COMMENT; decide both before the picker.
   - Anchor changed-line entries as `{path,line,side:"RIGHT",body}`, using LEFT for removed lines. Put unanchorable or unlocated entries under `Not anchored to the changed lines:` in the body; omit none.
   - Body contains attribution and any unanchored list, plus one-line approval for APPROVE. A COMMENT with no inline entries says entries are in the body rather than approving. Range bodies additionally name the recorded base and head. Include no summary or unselected tier.
   - All tiers empty produces one-line approval plus attribution and no inline comments. For range, say the range was clean and name its coverage under COMMENT.

4. **Offer the counted tier picker.** When any tier has entries, offer `Critical/Major only — N comments`, `+ Minor — N comments (D new)`, `+ Improvements — N comments (D new)`, and `Post nothing`. N counts cumulative inline comments; D counts entries added by that tier. If body-only entries exist, show cumulative counts for both: `N comments, M in the body (D new)`, with D covering both. Keep empty tiers visible as `0 comments` or `(0 new)`. When all tiers are empty, offer only `Post approval — 0 comments` and `Post nothing`; for range use `Post clean review — 0 comments`. Before options on an own PR, explain every posting option becomes COMMENT because GitHub rejects self-approval. Use the host's structured question tool if available, otherwise the same numbered list in chat. Require an answer matching exactly one option; re-ask ambiguous, qualified, two-sided, bare-yes, or unmatched free-text answers without choosing a default. Selection proceeds directly to step 5 without another confirmation. Post nothing ends here with no posting call. Every posting path requires this picker, including an empty review.

5. **Recheck and post.** Repeat the live head/merge-base checks immediately before posting, applying branch/range rules above. On drift, stop for `/review-code` then `/publish-pr-review`; correct a wrong PR base first. Write scratch JSON and submit once with `gh api --method POST repos/{owner}/{repo}/pulls/<number>/reviews --input <file>`. `gh` resolves owner/repo from the current repository. Payload: `{event,commit_id,body,comments:[{path,line,side,body}]}`; commit_id is the reviewed head. Omit comments only when there are no inline entries, including on APPROVE. Remove scratch on success or failure. Add no AI/tool footer, even under an environment default. Report failed calls and stop; never retry a rejected verdict as another verdict. The own-PR COMMENT substitution was decided before consent, not after failure.
   - **Own-PR Approve fallback:** retain the selected body and inline entries but send COMMENT where APPROVE would otherwise apply. Report the self-approval limitation. Critical/Major and range selections already use COMMENT.

6. **Report.** Name PR number/title/URL, selected tier, structured or numbered-chat picker, verdict, and inline count. Post nothing reports no call. An empty review reports that all tiers were empty and which option was selected.

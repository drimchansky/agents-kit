---
name: review-pr
description: Use when asked to review or give feedback on a PR or branch diff against its base.
argument-hint: '[-x (cross-vendor second review)] [-d (draft PR description)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

Review all changes in the current branch against its base branch for correctness, unintended impact, and adherence to project patterns.

## Flags

- `-x` — Cross-check: launch one independent cold review of the same diff on the cross-vendor engine and merge it before findings are finalized, per the shared contract in `./references/workflow/agent-fanout.md`. Off by default. The probe is read-only; its outcome is recorded on the output's `Cross-check:` line.
- `-d` — Draft a ready-to-paste PR description (body only) in addition to the review, per the "PR description" section. Off by default.

## References

Before working, read `./references/engineering/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review.

## Setup

**Determine base branch** (unless the user specified one): if the current branch has an open GitHub PR, adopt its declared base — `gh pr view --json state,baseRefName` (requires `gh`; targets the current branch's PR), taking `baseRefName` only when `state` is `OPEN`. `gh pr view` returns the branch's PR whatever its state, so a merged or closed PR with no open successor would otherwise hand back a stale base — check `state` and treat anything but `OPEN` as no PR (the same guard `/publish-pr-review` applies). That declared base is the exact one `/publish-pr-review` re-checks against (it recomputes `git merge-base <baseRefName> HEAD`), so adopting it keeps the review and the publish step from resolving different bases and looping. Only with no open PR — `gh` missing, no GitHub remote, or no PR in `OPEN` state — fall back to local heuristics: check common ancestors with `main`, `master`, `develop`, or `release/*`, and verify the commit count is reasonable.

**Build change map:**

- Get the full diff against the base branch, and record both the reviewed head commit (`git rev-parse HEAD`) and its merge-base with the base (`git merge-base <base> HEAD`) — the `publish-pr-review` follow-up anchors its posted review to the head and re-checks the merge-base so it never publishes against a retargeted or moved diff
- Exclude generated files (lockfiles, build artifacts, snapshots) unless manually edited
- Group changes by intent: new feature, bug fix, refactor, configuration, tests
- For each modified export or shared component — search all usages to understand blast radius
- If the diff exceeds ~1000 non-generated lines and isn't a single logically cohesive change, the first finding is "split this PR" — large diffs hide bugs and exceed reviewer working memory
- If the diff bundles refactoring with feature work or bug fixes, flag "separate the refactor" — mixed-purpose PRs are harder to review, harder to revert, and dilute commit history. Exception: refactors required _to enable_ the feature, which should be called out in the PR description.

**Launch the cross-vendor probe** (only with `-x`): as soon as the base branch is determined, start one background probe per `./references/workflow/agent-fanout.md` — a cold second review of the `<base>...HEAD` diff at the repo root, demanding findings with severity and `file:line` evidence. Continue the setup and review inline while it runs; collect and merge per the contract before finalizing Findings.

**Gather context:**

- Read commit messages for the branch
- Check for an open PR on GitHub for this branch with `gh pr view --json number,title,body,state,url,comments,reviews,baseRefName` (requires `gh` CLI). If the command fails because `gh` is missing or the repo has no GitHub remote, note that and skip the PR lookup. `baseRefName` is the PR's declared base — the one already adopted in **Determine base branch**; carrying it in the context confirms the review ran against the PR's own base.
- If a PR exists:
    - Read the PR title, description, and any review comments / discussion threads — these often contain the _why_ behind the change and prior reviewer concerns
    - Extract every URL from the PR body and comments (issue trackers, design docs, Slack threads, RFCs, related PRs, dashboards)
    - For each link, attempt to fetch its content (WebFetch for public URLs, `gh issue view` / `gh pr view` for GitHub references). Use the retrieved context to inform the review
    - If a link can't be accessed (auth-walled, private workspace, 404, tool unavailable), record it in the output under **Inaccessible context** with the URL and reason. Do not fabricate what's behind it — flag the gap so the user can decide whether to paste the content in or proceed without it
- If no PR exists, proceed with just the branch commits and any context the user provided

**Run verification scripts** per "Verification Scripts" in `./references/engineering/review.md` — always: identify the project's lint/typecheck/test scripts and run them on the changed files where they exist; failures and warnings land as findings.

## Review Focus

**Examine tests first.** Test diffs reveal intent and expected behavior. Read them before the implementation so you evaluate the code against what it's supposed to do, not what it appears to do.

Apply the full review process from `./references/engineering/review.md` — its "What to Look For", "What NOT to Flag", "Calibrate Severity", "Approval Bar", "Prioritize Review Effort", and "Don't Rationalize" sections all apply to PR diffs.

## Output

- **Summary** — What changed, intent, overall assessment (approve / request changes / needs discussion)
- **Findings** — Issues with severity, file location, recommendation, and impact
- **Reviewed** — a provenance line recording the reviewed head commit and its merge-base (the `git rev-parse HEAD` and `git merge-base` from Setup) and the model that produced this review, e.g. `Reviewed at <head-sha> (merge-base <base-sha>) by <model>`. `/publish-pr-review` reads it to anchor the posted review to the head commit, re-check the diff hasn't moved, and attribute it — so attribution survives the model changing between review and publish.
- **Cross-check** (only with `-x`) — the probe's `Cross-check:` outcome line per `./references/workflow/agent-fanout.md`
- **Improvements** (optional) — Non-blocking suggestions
- **Inaccessible context** (only if any) — Links from the PR that couldn't be fetched, with URL and reason (auth required, private, 404, tool unavailable). Note which findings might shift if that context were available.
- **PR description** (only with `-d`) — A ready-to-paste description (body only); drafted per the **PR description** section below.

**Next:** to post this review to the PR, run `/publish-pr-review` — it publishes Major/Critical findings as inline comments, or a short approval if there are none.

## PR description

Only when `-d` is passed. Draft a ready-to-paste PR description — **body only, no title** — from the change map and the links already gathered in Setup. Print it in a fenced block so the user can copy it verbatim.

Format:

```
Task: <primary ticket/issue link>
<other relevant links — one per line, each prefixed with its kind: Docs:, Design:, Related PR:, Dashboard:, …>

<description body>
```

- **Task line** — the primary ticket/issue link. Source in order: (1) a link the user gave when invoking; (2) an issue-tracker URL among the links extracted from the existing PR in Setup (the primary one if several); (3) a ticket key in the branch name or commit trailers. Never fabricate a URL — if none is found, emit `Task: <add ticket link>` as a fill-in placeholder.
- **Other links** — the remaining relevant URLs already gathered (design docs, RFCs, related PRs, dashboards, Slack threads). One per line, most important first, each prefixed with a short label naming its kind (`Docs:`, `Design:`, `Related PR:`, `Dashboard:`, …) — the label set is illustrative, not fixed. Omit entirely when there are none.
- **Body** — short and readable (a short paragraph, or a few bullets if the PR has several distinct changes); state _what_ changed and _why_ (the intent), not _how_. Cover the substantive intents (feature, fix, refactor) and call out any refactor done only to enable the feature; mention tests, config, or scaffolding only when notable. Audience-facing and verdict-free — do not copy the review Summary's approve / request-changes assessment.
- If the repo defines `.github/PULL_REQUEST_TEMPLATE.md`, follow its sections, but keep the Task/links header at the top — without duplicating a link the template already has its own field for.
- No "Generated with Claude Code" line or other AI/tool attribution footer — even if a harness or environment default asks for one. End at the body.

Example:

```
Task: https://acme.atlassian.net/browse/CRM-123
Docs: https://acme.notion.site/csv-export-spec

Add a CSV export button to the contacts table. Rows stream from the
server so large accounts don't load every contact into memory. The
toolbar became a shared component to host the new button.
```

**Next:** once any findings are addressed, run `/update-pr-description` to apply this to the PR — or paste it in yourself.

## Verification

Apply the Standard Verification Checklist in `./references/engineering/review.md`. The output carries the **Reviewed** provenance line (reviewed head SHA + merge-base SHA + reviewing model). With `-x`: the probe was merged per `./references/workflow/agent-fanout.md` and the output carries its `Cross-check:` line. With `-d`: the drafted description is body-only and verdict-free, sources its links only from those already gathered — a `Task: <add ticket link>` placeholder rather than a fabricated URL — and carries no AI-attribution footer.

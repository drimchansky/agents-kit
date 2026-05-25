---
name: review-pr
description: Use when asked to review or give feedback on a PR or branch diff against its base.
argument-hint: '[--no-checks]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.

Review all changes in the current branch against its base branch for correctness, unintended impact, and adherence to project patterns.

## Flags

- `--no-checks` — Skip automated checks. See "Automated Checks" in `./references/workflow/review.md`.

## References

Before working, read `./references/workflow/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review.

## Setup

**Determine base branch** (if not specified): check common ancestors with `main`, `master`, `develop`, or `release/*`; verify the commit count is reasonable.

**Build change map:**

- Get the full diff against the base branch
- Exclude generated files (lockfiles, build artifacts, snapshots) unless manually edited
- Group changes by intent: new feature, bug fix, refactor, configuration, tests
- For each modified export or shared component — search all usages to understand blast radius
- If the diff exceeds ~1000 non-generated lines and isn't a single logically cohesive change, the first finding is "split this PR" — large diffs hide bugs and exceed reviewer working memory
- If the diff bundles refactoring with feature work or bug fixes, flag "separate the refactor" — mixed-purpose PRs are harder to review, harder to revert, and dilute commit history. Exception: refactors required _to enable_ the feature, which should be called out in the PR description.

**Gather context:**

- Read commit messages for the branch
- Check for an open PR on GitHub for this branch with `gh pr view --json number,title,body,state,url,comments,reviews` (requires `gh` CLI). If the command fails because `gh` is missing or the repo has no GitHub remote, note that and skip the PR lookup.
- If a PR exists:
    - Read the PR title, description, and any review comments / discussion threads — these often contain the _why_ behind the change and prior reviewer concerns
    - Extract every URL from the PR body and comments (issue trackers, design docs, Slack threads, RFCs, related PRs, dashboards)
    - For each link, attempt to fetch its content (WebFetch for public URLs, `gh issue view` / `gh pr view` for GitHub references). Use the retrieved context to inform the review
    - If a link can't be accessed (auth-walled, private workspace, 404, tool unavailable), record it in the output under **Inaccessible context** with the URL and reason. Do not fabricate what's behind it — flag the gap so the user can decide whether to paste the content in or proceed without it
- If no PR exists, proceed with just the branch commits and any context the user provided

**Run automated checks** per "Automated Checks" in `./references/workflow/review.md` (skip if `--no-checks`).

## Review Focus

**Examine tests first.** Test diffs reveal intent and expected behavior. Read them before the implementation so you evaluate the code against what it's supposed to do, not what it appears to do.

Apply the full review process from `./references/workflow/review.md` — its "What to Look For", "What NOT to Flag", "Calibrate Severity", "Approval Bar", "Prioritize Review Effort", and "Don't Rationalize" sections all apply to PR diffs.

## Output

- **Summary** — What changed, intent, overall assessment (approve / request changes / needs discussion)
- **Findings** — Issues with severity, file location, recommendation, and impact
- **Improvements** (optional) — Non-blocking suggestions
- **Inaccessible context** (only if any) — Links from the PR that couldn't be fetched, with URL and reason (auth required, private, 404, tool unavailable). Note which findings might shift if that context were available.

## Verification

Apply the Standard Verification Checklist in `./references/workflow/review.md`.

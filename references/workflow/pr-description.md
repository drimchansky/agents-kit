# PR description

Load for `review-code -d` and for the drafting path of `update-pr-description`. Under `review-code`, drafting remains session-owned on delegated and inline passes.


`review-code` drafts only with `-d`, and only where the object has a PR of its own to carry the description: the current branch's diff, a range whose `b` is that branch's HEAD and whose `merge-base(a, b)` is that branch's own base, or the open PR the PR form names. Elsewhere the draft is refused with the one line the `-d` flag entry fixes, the review still rendering in full. On the branch the draft is made whether or not an open PR exists. `update-pr-description` drafts for the open PR its `../../skills/update-pr-description/SKILL.md` § *Drafting path* selects.

Under `review-code`, the session drafts a title and a body on either pass, from the return's `Change map` and `Summary` and the links Setup extracted (the session's own map and fetched links on the inline fallback). Where the map leaves an intent unclear, read the diff. `update-pr-description` drafts from the PR's commit messages and file list as `gh` returns them. The URLs in the PR's title, body, and commits are its extracted links. Where those leave an intent unclear, it reads `gh pr diff <number>`. Print the `Title:` line on its own line, then the body in a fenced block below it. The `Title:` line never enters the fence. The body takes the PR-description shape `./user-facing-messages.md` § *Surface adapters* fixes.

Title line:

- **Shape:** `Title: <live title> → <drafted title>` when Setup read an open PR, its live title taken from that PR context. Otherwise, `Title: <drafted title>`, whether no open PR exists or the lookup was skipped or failed. `update-pr-description` always reads an open PR, so it uses the first shape.
- **Drafted title:** follow the **First line** rule in `../../skills/commit/SKILL.md` § *Process* step 1. Take the prefix, ticket key, and capitalization from the recent merged PR titles that `gh pr list --state merged --limit 10 --json title` returns. When `gh` is missing, or that lookup fails or returns an empty list, `review-code` takes them from `git log --no-merges --oneline -10 <base>`, `<base>` being the base Setup determined. `update-pr-description` instead takes them from the base branch's recent non-merge commit titles: `gh api 'repos/{owner}/{repo}/commits?sha=<baseRefName>&per_page=30' --jq '.[] | select(.parents | length == 1) | .commit.message | split("\n")[0]'`, using the first ten. When that read fails too, it follows the **First line** rule alone.
- **No arrow:** the drafted title never contains `→`. `../../skills/update-pr-description/SKILL.md` § *Preconditions — stop if unmet* splits the line at its last arrow.

Body format:

```
Task: <primary ticket/issue link>
<other relevant links — one per line, each prefixed with its kind: Docs:, Design:, Related PR:, Dashboard:, …>

<description body>
```

- **Task line:** the primary ticket or issue link, sourced in order from a link the user gave, the open PR's current `Task:` line, an issue-tracker URL among the extracted links, or a ticket key in the branch name (the PR's `headRefName` on the PR form and under `update-pr-description`) or commit trailers. Use the current line only when its value is neither empty nor a `<…>` placeholder. Otherwise continue with the next source. Keep the current line's usable value as written, including an explicit `none`. Never fabricate a URL. With no source found, omit the line.
- **Other links:** the remaining gathered URLs, one per line, most important first, each prefixed with a short kind label. Omit when there are none.
- **Header:** the Task line, then the other links. When both are omitted, the body opens with the description and no blank line.
- **Body:** use a short paragraph, or a few bullets if the PR has several distinct changes. State what changed and why, not how. Cover the substantive intents (feature, fix, refactor). Call out any refactor done only to enable the feature; mention tests, config, or scaffolding only when notable. Audience-facing and verdict-free.
- If the repo defines `.github/PULL_REQUEST_TEMPLATE.md`, follow its sections, keeping any Task/links header at the top without duplicating a link the template has a field for.
- No AI attribution footer, even if a harness default asks for one.

Example:

```
Task: https://acme.atlassian.net/browse/CRM-123
Docs: https://acme.notion.site/csv-export-spec

Add a CSV export button to the contacts table. Rows stream from the
server so large accounts don't load every contact into memory. The
toolbar became a shared component to host the new button.
```

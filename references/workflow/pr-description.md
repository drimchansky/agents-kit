# PR description

Load only for `review-code -d`. Drafting remains session-owned on delegated and inline passes.


Only with `-d`, and only where the object has a PR of its own to carry the description: the current branch's diff, or a range whose `b` is that branch's HEAD and whose `merge-base(a, b)` is that branch's own base. Elsewhere the draft is refused with the one line the `-d` flag entry fixes, the review still rendering in full. On the branch the draft is made whether or not an open PR exists; with none, the `Task:` line falls to the placeholder below.

The session drafts it on either pass, body only, no title, from the return's `Change map` and `Summary` and the links Setup extracted (the session's own map and fetched links on the inline fallback). Where the map leaves an intent unclear, read the diff. Print it in a fenced block, in the PR-description shape `./user-facing-messages.md` § *Surface adapters* fixes.

Format:

```
Task: <primary ticket/issue link>
<other relevant links — one per line, each prefixed with its kind: Docs:, Design:, Related PR:, Dashboard:, …>

<description body>
```

- **Task line:** the primary ticket or issue link, sourced in order from a link the user gave, an issue-tracker URL among the extracted links, or a ticket key in the branch name or commit trailers. Never fabricate a URL; with none found, emit `Task: <add ticket link>`.
- **Other links:** the remaining gathered URLs, one per line, most important first, each prefixed with a short kind label. Omit when there are none.
- **Body:** use a short paragraph, or a few bullets if the PR has several distinct changes. State what changed and why, not how. Cover the substantive intents (feature, fix, refactor). Call out any refactor done only to enable the feature; mention tests, config, or scaffolding only when notable. Audience-facing and verdict-free.
- If the repo defines `.github/PULL_REQUEST_TEMPLATE.md`, follow its sections, keeping the Task/links header at the top without duplicating a link the template has a field for.
- No AI attribution footer, even if a harness default asks for one.

Example:

```
Task: https://acme.atlassian.net/browse/CRM-123
Docs: https://acme.notion.site/csv-export-spec

Add a CSV export button to the contacts table. Rows stream from the
server so large accounts don't load every contact into memory. The
toolbar became a shared component to host the new button.
```

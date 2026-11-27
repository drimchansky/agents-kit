# The Observations File: Optional, Derived, Rewritten by the Source Check

Only the `-s` source check reads or writes `observations.md`. Use [Source check](./source-check.md) for its scope, comparison, and rewrite. This optional file has a Swept date and one dated line per cited URL. It has no Status or companion-result obligation.

```markdown
# Observations: <task title>

**Plan:** [./plan.md](./plan.md)
_Swept: YYYY-MM-DD_

- [info] [Jira CRM-123](https://example.atlassian.net/browse/CRM-123) — "Add CSV export", In Progress (observed YYYY-MM-DD)
- [info] [Design doc](https://example.notion.site/…) — "Export formats", last edited YYYY-MM-DD (observed YYYY-MM-DD); auth required — re-check manually (attempted YYYY-MM-DD)
- [warn] [PR #482](https://github.com/org/repo/pull/482) — merged (observed YYYY-MM-DD)
- [block] [Spec doc](https://docs.google.com/document/d/…) — 404, gone (observed YYYY-MM-DD)
```

Each URL is a ledger key. Keep the identifier on the surface that cites it. Date each observation and each later failed attempt separately so a reader can tell when the source was last verified.

# The Observations File: Optional, Derived, Rewritten by the Sweep

`observations.md` records one dated line per external URL cited from an actionable surface (`./reconciliation-sweep.md` § *Scope*). Only reconciliation's sweep rewrites it wholesale (§ *Ledger* there); do not append or hand-maintain it. Absence means no sweep or no actionable citation, never a gap. It carries `_Swept:_`, no Status, and no companion-result obligation (`./task-lifecycle.md`).

```markdown
# Observations: <task title>

**Plan:** [./plan.md](./plan.md)
_Swept: YYYY-MM-DD_

- [info] [Jira CRM-123](https://example.atlassian.net/browse/CRM-123) — "Add CSV export", In Progress (observed YYYY-MM-DD)
- [info] [Design doc](https://example.notion.site/…) — "Export formats", last edited YYYY-MM-DD (observed YYYY-MM-DD); auth required — re-check manually (attempted YYYY-MM-DD)
- [warn] [PR #482](https://github.com/org/repo/pull/482) — merged (observed YYYY-MM-DD)
- [block] [Spec doc](https://docs.google.com/document/d/…) — 404, gone (observed YYYY-MM-DD)
```

Keep observed state here; other surfaces cite or timestamp its digest under `./one-home.md` § *One home per fact*. A pointer moved from the ≤1 KB Current-state block into historical log leaves sweep scope. Each URL is a ledger key; the identifier remains on its original citing surface.

Quote every observation with its date as cache, never live verification. Only the next sweep refreshes it.

Before rewriting, read the prior ledger. A fetch establishing nothing preserves its previous observation, date, and tag, adding the dated failed attempt. Preserve warn/block severity on failed fetches (`./reconciliation-sweep.md` § *Tags*). Without prior state, record only the attempt as info.

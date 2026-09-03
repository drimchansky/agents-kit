# The Observations File: Optional, Derived, Rewritten by the Sweep

The contract for `observations.md`, an optional derived role file of the task folder — where the folder sits and how it is discovered stay in the sibling `task-layout.md`. **This file is the single source of truth for the observations ledger's shape.**

`observations.md` is an **optional** derived role file holding the last observed state of every external reference the task folder cites **from an actionable surface** (`./reconciliation-sweep.md` § *Scope*) — one dated line per URL, written by the reconcilers' reference sweep and rewritten **wholesale** on each sweep (`./reconciliation-sweep.md` § *Ledger*); nothing in it is appended or hand-maintained. A folder may have one or not, and **absence is never a gap**: it means no sweep has run yet, or nothing is cited from an actionable surface. There is no `**Status:**` field — the `_Swept:_` line carries currency — and the file sits outside the companion-result-file rule (`./task-lifecycle.md`), the same footing as `goals.md`.

Its shape:

```markdown
# Observations: <task title>

**Plan:** [./plan.md](./plan.md)
_Swept: YYYY-MM-DD_

- [info] [Jira CRM-123](https://example.atlassian.net/browse/CRM-123) — "Add CSV export", In Progress (observed YYYY-MM-DD)
- [info] [Design doc](https://example.notion.site/…) — "Export formats", last edited YYYY-MM-DD (observed YYYY-MM-DD); auth required — re-check manually (attempted YYYY-MM-DD)
- [warn] [PR #482](https://github.com/org/repo/pull/482) — merged (observed YYYY-MM-DD)
- [block] [Spec doc](https://docs.google.com/document/d/…) — 404, gone (observed YYYY-MM-DD)
```

- **It is the home of observed external-reference state** (`./one-home.md` § *One home per fact*): the sweep records what it saw here, and every other surface cites or digests it — never as a second home, and never as undated durable prose. The timestamped surfaces an observation may *also* appear on are enumerated once in `./one-home.md` § *One home per fact*; this bullet doesn't restate them. An entry the `## Current state` block's ≤1 KB budget pushes out into the result log leaves the sweep's scope along with it (`./reconciliation-sweep.md` § *Scope*). The URL on each line is the citation's key, not a second home for the identifier — the identifier stays on its citing surface (`CONTEXT.md`'s `## References`, a `plan.md` step, the result's `**Pointers:**` or its active `**Blocked:**` / `**In review:**` section (`./reconciliation-sweep.md` § *Scope* defines *active*), `ticket.md`'s References, or a deliverable's `**Published:**` line).
- **Every line is a dated cache, never live verification.** Readers — `resume-task`'s brief above all — quote a line with its date; freshness is re-derived only by the next sweep.
- **A fetch that established nothing carries its line forward, tag included** — the previous observation with its own date *and its own tag*, plus the dated failed attempt (`auth required`, `unreachable — <error>`), as the second `info` line above shows; a carried `warn` or `block` stays a `warn` or `block` (`./reconciliation-sweep.md` § *Tags*), since the failed attempt established nothing that would soften it. That carry-forward is why the sweep reads this file before rewriting it; a first sweep with nothing to carry records the attempt alone, tagged `info`.

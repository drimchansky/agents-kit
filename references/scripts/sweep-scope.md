# `scripts/sweep-scope.ts`

Enumerates the citations a reference sweep may fetch — the scope
`../workflow/reconciliation-sweep.md` § *Scope* defines — for the reconcilers that run one.
**It fetches nothing and writes nothing**: the fetch, the material-change judgment, and the ledger
rewrite stay with the run, and this report is only the set they work through.

```
node scripts/sweep-scope.ts <task-dir>
```

**Contract.** stdout is exactly one JSON object,
`{taskDir,planStatus,deliverable,deliverableCandidates,ledger,citations}`.

`citations` holds one entry per distinct URL, in first-cited order: `{url,tag,occurrences}`.
`occurrences` is `{surface,file,section,text}` per citing site, in scan order — `CONTEXT.md`,
`plan.md`, `ticket.md`, `result.md`, then the deliverable — with `text` the citing line trimmed, which
is the description a fetch is compared against where the ledger carries no prior line. Deduplication is
on the URL as written, once a trailing bracket or sentence punctuation is trimmed off it, so two
spellings of one page stay two entries: over-fetching costs a request, while collapsing them would drop
a citing surface's own finding.

`tag` is the strongest tag `observations.md` records for that URL — `block` over `warn` over `info` —
and null where the ledger has no line for it or the folder has none. Strongest rather than last,
because `block` is a state tag a later `warn` line does not supersede.

`surface` says which in-scope surface the occurrence sits on: `context-references`,
`context-open-questions`, `plan-step`, `plan-open-questions`, `ticket-references`, `result-pointers`,
`result-pause`, `deliverable-published`. It is what routes an occurrence's finding, three of them
being surfaces a run never writes into (`../workflow/reconciliation.md`
§ *Never-annotated surfaces*). A section opens at its heading and closes at the next heading of the
same level or shallower, so a `####` block inside a plan step stays inside that step. Every surface
but `plan-step` opens only at a `##` heading — a deeper `### Current state` inside a historic
section is that section's content, not the live block — while a step heading opens at its own
level, `###` being canonical. In `result.md`
only the `## Current state` block's `**Pointers:**` lines are read — its gloss and `**Next:**` line
are not, and neither is anything below it but the active pause section.

`planStatus` is the plan's own status, read through `scripts/task-state.ts`'s exported report rather
than a fourth copy of the status patterns. It gates that pause section: the active pause is the one
`task-state.ts`'s `compactionSections` marks `pause` — the most recent `**Blocked:**` section under a
`blocked` plan, the most recent `**In review:**` section under `in-review`, and none at all in any
other state — read from there rather than re-derived, so the compaction plan and the sweep cannot
disagree about which pause is active.

`deliverable` is the doc-task deliverable, resolved per
`../workflow/doc-task-files.md` without the plan's optional `**Deliverable:**` header: the
folder's `.md` that is neither a role file nor the derived role beside them (`observations.md`) and
that carries a `**Status:**` line in its own header block —
above the first `##` heading, never inside a fence or a blockquote, which is what keeps a doc quoting
another file's header out. `deliverableCandidates` names every file passing that test; two is a
layout error to surface rather than guess between, so `deliverable` is null, both are named, and the
count is warned on stderr. Only a resolved deliverable's `**Published:**` lines are swept.

**The skip rules.** A citation is in scope only when it names a scheme with an authority
(`<scheme>://`), which drops `mailto:`, anchors-only targets, and relative links in one test rather
than three; `file://` and a loopback host (`localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`) are then
excluded by name. Both markdown link targets and
bare URLs are read out of every line and deduplicated within it, so a link whose text repeats its own
URL is one occurrence rather than two.

**Exit status.** 0 whenever a report was written — an empty `citations` list is the no-sweep state the
caller reports, not a failure. 2 is the run that never got that far: bad usage, an unreadable argument,
or a folder holding none of the role files `scripts/lifecycle-constants.ts` recognizes. There is no 1:
an empty scope is a report, not an outcome the exit code has to carry. Warnings go to stderr.

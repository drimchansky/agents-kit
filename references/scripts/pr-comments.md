# `scripts/pr-comments.ts`

Fetches one pull request's review threads for the `triage-findings` skill and emits them normalized,
so the skill spends its prose on judging resolution and acknowledgment rather than on a GraphQL query.

```
node scripts/pr-comments.ts <pr-number-or-url>
```

A bare number takes owner, repo, and host from the repository of the current directory, the way `gh`
resolves them itself; a pull-request URL carries its own owner, repo, and host, so that form runs
from anywhere — including against an enterprise host that is not the one `gh` would pick.

**Contract.** stdout is one JSON object,
`{"pullRequest":{"number":N|null,"url":U|null,"author":LOGIN|null},"threadsTotal":N|null,`
`"paginationComplete":BOOL,"threads":[…]}` — each thread
`{id,isResolved,isOutdated,path,line,acknowledgmentCandidate,commentsComplete,comments:[…]}` and each
comment `{author,body,createdAt,url}`, threads and comments alike in the order GitHub returned them,
so a thread's last comment is its most recent.

`acknowledgmentCandidate` is mechanical — the thread is unresolved, its comments were fetched whole,
and the last of them was written by the pull request's own author — and says nothing about whether
that comment acknowledges a fix; reading it is the skill's judgment. It is false on a thread whose
`commentsComplete` is false, because the last comment fetched is then not known to be the last one
written: false means "not established", which routes the thread to open rather than to Verify.

`paginationComplete` is false whenever a page of threads, or of some thread's comments, was left
unfetched: the report is then a prefix of the review rather than the whole of it, and the per-thread
`commentsComplete` names which threads are the short ones. `threadsTotal` is the count GitHub
reported for the whole pull request, so `threads.length` short of it measures the gap. A walk that
produced no page at all is as short as one that stopped partway. Cursor pagination hands back a node
twice when threads change between pages, so threads are deduplicated by id and their comment
continuations with them.

Both walks are bounded at 20 pages, because a cursor that stops advancing would otherwise page
forever. A walk that reaches the bound is one of the things `paginationComplete: false` reports, so a
truncated walk is declared rather than mistaken for the whole review.

An absent `isResolved`/`isOutdated` flag reads as unresolved and not outdated, so a field GitHub
stopped sending can only ever leave a finding open — never file it away as already addressed.

**Exit status.** 0 = a report was written, complete or not; 1 = nothing to report — no `gh`, no such
pull request, or a first fetch that failed; 2 = the run could not be carried out — bad usage, or an
unexpected failure. A failed first fetch is an outcome — the script asked and got nothing — so it
stays on 1; a crash is not, and takes 2. `gh`'s stderr is captured rather than inherited, so a
failure is reported once through this script's own prefixed message, carrying `gh`'s reason (no auth,
a 404, a GraphQL error) rather than `execFileSync`'s bare "command failed". Warnings go to stderr.

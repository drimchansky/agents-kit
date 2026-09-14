# `scripts/pr-comments.ts`

Fetches normalized PR review threads for `triage-findings`.

```
node scripts/pr-comments.ts <pr-number-or-url>
```

A number uses the current directory's repository, owner, and host through `gh`. A PR URL supplies all three and works outside a checkout, including enterprise hosts.

**Contract.** stdout is one JSON object: `{"pullRequest":{"number":N|null,"url":U|null,"author":LOGIN|null},"threadsTotal":N|null,"paginationComplete":BOOL,"threads":[…]}`.

Each thread is `{id,isResolved,isOutdated,path,line,acknowledgmentCandidate,commentsComplete,comments:[…]}`; each comment is `{author,body,createdAt,url}`. Preserve GitHub's thread/comment order; the last comment is most recent.

`acknowledgmentCandidate` requires an unresolved thread, complete comments, and a last comment by the PR author. It does not establish acknowledgment of a fix; the skill reads and judges that comment. Incomplete comments force false, meaning acknowledgment is unestablished and the thread remains open.

`paginationComplete` is false when any thread or comment page remains unfetched, including a walk producing no page. Per-thread `commentsComplete` identifies truncated comments. `threadsTotal` is GitHub's whole-PR count; compare against `threads.length` to report missing threads.

Deduplicate threads by id, including their comment continuations. Bound both pagination walks at 20 pages; reaching the bound reports incomplete pagination. Missing isResolved/isOutdated flags read as unresolved/not outdated and cannot mark findings addressed.

**Exit status.** 0 means a complete or partial report was written. 1 means nothing to report: unavailable `gh`, nonexistent PR, or failed first fetch. 2 means bad usage or unexpected failure. Capture `gh` stderr and report its reason once through the script's prefixed message. Warnings use stderr.

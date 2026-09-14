# `scripts/sweep-scope.ts`

Reports fetchable citations under `../workflow/reconciliation-sweep.md` § *Scope*. Fetching, material-change judgment, and ledger writes remain with the caller; this script fetches and writes nothing.

```
node scripts/sweep-scope.ts <task-dir>
```

**Contract.** stdout is exactly one JSON object: `{taskDir,planStatus,deliverable,deliverableCandidates,ledger,citations}`.

`citations` contains `{url,tag,occurrences}` per distinct URL, in first-cited order. Each occurrence is `{surface,file,section,text}`, ordered by CONTEXT, plan, ticket, result, then deliverable. `text` is the trimmed citing line; compare fetched state against it when no prior ledger line exists.

Deduplicate URL spellings after trimming trailing brackets or sentence punctuation. Distinct spellings remain distinct entries. `tag` is the strongest observations-ledger tag for that URL: block > warn > info, or null without a matching line/ledger.

`surface` is one of `context-references`, `context-open-questions`, `plan-step`, `plan-open-questions`, `ticket-references`, `result-pointers`, `result-pause`, `deliverable-published`. Route only `deliverable-published` and `result-pause` under `../workflow/reconciliation.md` § *Never-annotated surfaces*. Route all other surfaces under `../workflow/reconciliation-sweep.md` § *Output and routing*.

Sections end at the next heading of equal or shallower level. Except plan steps, surfaces open only at `##`; steps open at their own heading level, canonically `###`. Result scanning reads only Current state's Pointers lines and the active pause section, excluding its gloss, Next, and other history.

`planStatus` comes from `scripts/task-state.ts`. Its `compactionSections` selects the active pause: latest Blocked section for blocked, latest In review for in-review, none otherwise.

`deliverable` resolves under `../workflow/doc-task-files.md`, ignoring the plan's optional Deliverable header. Candidates are Markdown files other than recognized role files and `observations.md`, with a Status line above the first `##` heading. Ignore fences and blockquotes. `deliverableCandidates` names all matches; multiple matches yield null deliverable and a stderr warning, not a guessed selection. Sweep only the resolved deliverable's Published lines.

**The skip rules.** Accept `<scheme>://` URLs, excluding `file://` and loopback hosts `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`. Read Markdown targets and bare URLs; deduplicate within each line.

Read angle-bracketed targets whole through `>`, preserving literal punctuation. `angledTargetText` in `scripts/lifecycle-constants.ts` trims their outer padding; percent-encode interior spaces for ledger matching. The bare-URL pass skips valid angled targets but still reads behind an unclosed `](<`. `scripts/health-check.ts` uses the same padding helper.

**Exit status.** 0 when a report is written, including an empty no-sweep scope. 2 for bad usage, unreadable input, or no task role files recognized by `scripts/lifecycle-constants.ts`. No exit 1; warnings go to stderr.

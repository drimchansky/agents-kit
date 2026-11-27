# `scripts/sweep-scope.ts`

Reports fetchable citations for the explicit check in [Source check](../workflow/source-check.md#scope). Fetching, material-change judgment, and ledger writes remain with the caller; this script fetches and writes nothing.

```
node scripts/sweep-scope.ts <task-dir>
```

**Contract.** stdout is exactly one JSON object: `{taskDir,planStatus,deliverable,deliverableCandidates,ledger,citations}`.

`citations` contains `{url,tag,occurrences}` per distinct URL, in first-cited order. Each occurrence is `{surface,file,section,text}`, ordered by CONTEXT, plan, ticket, result, then deliverable. `text` is the trimmed citing line with comments masked to equal-width spaces; compare fetched state against it when no prior ledger line exists. `section` masks comments the same way.

Deduplicate URL spellings after trimming trailing brackets or sentence punctuation. Distinct spellings remain distinct entries. `tag` is the strongest observations-ledger tag for that URL: block > warn > info, or null without a matching line/ledger.

`surface` is one of `context-references`, `context-open-questions`, `plan-step`, `plan-open-questions`, `ticket-references`, `result-pointers`, `result-pause`, `deliverable-published`. Apply [Source check](../workflow/source-check.md#output-and-routing) at each occurrence.

Sections end at the next heading of equal or shallower level. Except plan steps, surfaces open only at `##`; steps open at their own heading level, canonically `###`. Result scanning reads only Current state's Pointers lines and the active pause section, excluding its gloss, Next, and other history.

`planStatus` comes from `scripts/task-state.ts`. For blocked, select the unique level-2 `Blocked` heading. For in-review, select the unique level-2 `In review` heading. Other statuses, absent headings, and duplicate pause records contribute no pause citations.

`deliverable` resolves under `../workflow/doc-task-files.md`, ignoring the plan's optional Deliverable header. Candidates are Markdown files other than recognized role files, `observations.md`, `approaches.md`, and `history.md`, with a Status line above the first `##` heading. Ignore fences and blockquotes. `deliverableCandidates` names all matches; multiple matches yield null deliverable and a stderr warning, not a guessed selection. Sweep only the resolved deliverable's Published lines.

**The skip rules.** Accept `<scheme>://` URLs, excluding `file://` and loopback hosts `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`. Read Markdown targets and bare URLs; deduplicate within each line.

Apply `./task-state.md`'s shared comment/fence classification before selecting sections or reading URLs.

Read angle-bracketed targets whole through `>`, preserving literal punctuation. `angledTargetText` in `scripts/lifecycle-constants.ts` trims their outer padding; percent-encode interior spaces for ledger matching. The bare-URL pass skips valid angled targets but still reads behind an unclosed `](<`. `scripts/health-check.ts` uses the same padding helper.

**Exit status.** 0 when a report is written, including an empty no-sweep scope. 2 for bad usage, unreadable input, or no task role files recognized by `scripts/lifecycle-constants.ts`. No exit 1; warnings go to stderr.

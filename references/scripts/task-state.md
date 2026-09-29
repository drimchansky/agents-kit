# `scripts/task-state.ts`

Reports task state, compaction eligibility (`../workflow/reconciliation-compaction.md`), or an explicit structural repair. The default and compaction modes are read-only.

```
node scripts/task-state.ts <task-dir>
node scripts/task-state.ts --compaction-plan <task-dir>
node scripts/task-state.ts --repair <task-dir>
```

**Contract.** stdout is one JSON object:
`{taskDir,plan,result,goalsFile,steps,nextPendingStep,nextPendingStepBody,checkpoints,goalCoverage,structure,currentState}`.

- `plan`: `{file,status,statusRaw}`. Status is a lifecycle value, `unknown` for an unrecognized value, or null when absent.
- `result`: `{file,legacyStatus}`, or null without result.md. Legacy status is the old Status header verbatim, null when absent, and never acted on (`../workflow/task-lifecycle.md` § *`result.md` — no status field*).
- `goalsFile`: null without goals.md; all coverage lists then remain empty, including unknown-goal citations.

`steps` follows plan order: `{number,title,checked,anchor,anchorResolves,goals,goalEscape,dependsOn}`. Number retains the plan token, including `"3a"`. Checked reads the first What checkbox. Anchor comes from its result link, or is null. AnchorResolves is null for unchecked steps; checked steps return false for missing links, targets outside result.md, or absent headings. Tombstones under Compacted count as held. GoalEscape recognizes `**Goal:** none (infra/refactor)`.

`nextPendingStep` is the first unchecked step's number, or null when all are checked. Its body is `{what,verify}`. `what` is trimmed text after the `**What:**` marker on the checkbox line. `verify` is trimmed text after the `**Verify:**` marker on its line. Each field is null when absent. With no pending step, the body itself is null. Wrapped criteria return only the first line; open the step to read the rest.

`checkpoints` lists authored `### Checkpoint after Step N` entries in order, with the matching result Outcome token, or null.

`goalCoverage` is `{goals,uncoveredGoals,orphanSteps,unknownGoalCitations,scopePartition}`:

- Goals maps each goal ID to citing steps.
- UncoveredGoals includes every uncited ID, even a deferred goal.
- OrphanSteps cites neither a goal nor the infra/refactor escape.
- UnknownGoalCitations names steps citing absent IDs; empty without goals.md.
- ScopePartition is `{delivered,deferred,missingFromPartition,inBoth}`, read from plan Scope over goal IDs. A total partition has empty missingFromPartition and inBoth.

`structure` is `{reliable,diagnostics}`. Reliability requires readable goals and no structural diagnostic. An uncited deferred goal remains in `uncoveredGoals` without making structure unreliable. Each diagnostic is `{code,file,line,detail}`. `line` counts from 1; 0 marks a file-level diagnostic: `missing-goals-file`, `incomplete-reference-scan`, or either partition code. Codes:

- `missing-goals-file`: goals.md is absent or unreadable.
- `malformed-goal-id`: a bullet under goals.md's `## Goals` or `## Retired` does not start with a `G<n>` ID.
- `duplicate-goal-id`: an ID is defined more than once, within or across those two lists.
- `unknown-goal-reference`: a reference, or a plan Scope or step Goal citation, names a well-formed ID defined in neither list.
- `retired-goal-reference`: a plan Scope or step Goal field cites a retired ID.
- `malformed-goal-reference`: a referenced token, such as `G4a`, is not a `G<n>` ID.
- `outside-goal-reference`: a goal label links outside the task, including into a nested task folder.
- `ambiguous-goal-reference`: a goal label has an ambiguous inline target or an unproved reference-style target.
- `missing-result-anchor`: a checked step's `anchorResolves` is false.
- `incomplete-reference-scan`: task-local Markdown went unread; `file` names the gap.
- `orphan-step`: a step appears in `orphanSteps`.
- `missing-goal-partition`: a goal ID appears in `scopePartition.missingFromPartition`.
- `conflicting-goal-partition`: a goal ID appears in `scopePartition.inBoth`.
- `blocked-goal-remap`: `--repair` only; a reference or mention blocks a fresh-ID remap.

The reference scan includes task-local Markdown, including historical result text and supplementary documents. Unknown or malformed IDs in `ticket.md` or the deliverable (`../workflow/doc-task-files.md`) are not diagnosed, since the agent does not reword either; their references still block remaps. It excludes fenced examples, blockquotes, HTML comments, inline code, quotations, link targets, URI tokens, and definition tokens. A `"` after a letter or digit, or a `'` or `‘` after anything but whitespace or opening punctuation, is an apostrophe or inch mark rather than a quotation; so is a single closing quote followed by a letter or digit. Goal bullets inside fences or HTML comments define nothing. A label nested inside a link label takes the enclosing link's classification. A token inside a link label, code span, or quotation that crosses a line break also reports `ambiguous-goal-reference`, since a single line cannot prove its scope. A bracketed label without a link definition is plain text. A link definition may put its destination on the next line; one left without a destination makes its labels ambiguous. A footnote or a definition-shaped line with trailing prose is scanned as prose. Task-local Markdown skips dot entries, `node_modules`, and subfolders holding a task role file, since those belong to another task. A symlinked Markdown file or folder, an unreadable folder or Markdown file, and non-UTF-8 Markdown each report `incomplete-reference-scan`. Other symlinks and non-Markdown files are ignored. The read-only report still reads a symlinked or non-UTF-8 goals or result file directly for coverage. When the task folder itself cannot be walked, for example through a symlink or a concurrent change, it reports `.` as the gap instead of failing.

Goals listed under goals.md's `## Retired` heading are retired (`../workflow/task-goals.md`). A reference to one is valid anywhere in task-local Markdown except plan Scope and step Goal fields. Unknown IDs and incomplete malformed mappings remain diagnostic. Validation reads no Git history.

**`--repair` mode** reads every task-local Markdown file, applies only proven identifier corrections, then reports `{taskDir,applied,mappings,unresolved,recovery,unrecovered,recoveryErrors,error,swept,state}`. `applied` lists changed files and edit counts; `mappings` lists each applied `{from,to}` identifier correction. `unresolved` uses the structural diagnostic shape. `unrecovered` names files or staging paths left after failed recovery, with a reason per path in `recoveryErrors`. `state` is the post-repair task report when a plan exists, or null during pre-plan goal intake or a failed repair. Like the read-only report, `state` reads a symlinked or non-UTF-8 plan, result, or goals file directly; that gap still blocks every edit and appears in `unresolved`. Zero means no unresolved diagnostics and no write failure. 1 means unresolved diagnostics, including scan gaps. 2 means changed input, an unreadable or symlinked task folder, or failed replacement or recovery. A proposal repair cannot apply, such as overlapping edits, also exits 2 with its reason in `error` and writes nothing. An unchanged rerun writes no files. Before proposing edits, repair removes staging files `<file>.agents-kit-repair.<pid>.<suffix>` whose writing process no longer exists and lists them in `swept`; a live writer's files are kept.

A malformed spelling of an existing unused valid ID can be normalized without Git history. Assign a fresh ID to a unique malformed identity only when the goals file is tracked and its reachable, non-shallow Git history contains its creation. Choose it above every historical goal ID, every current or retired numeric identity including decorated definitions, and every `G<n>` token anywhere in task-local Markdown. That includes code spans, quotations, comments, and link targets, which the reference scan otherwise ignores. A stray reference therefore keeps its meaning and stays diagnosed. Compare identities after stripping decoration, so `G4a` and `**G4a**` conflict. Otherwise leave the remap unresolved. A linked reference outside the task, or one with an ambiguous target, prevents its remap. Repair writes only `CONTEXT.md`, `goals.md`, `plan.md`, and `result.md`. A fresh-ID remap is blocked by any reference in other task Markdown, such as the ticket, a deliverable, or a supplementary document. It is also blocked by a reference inside a heading or a `## Compacted` tombstone, because rewriting it would change a link anchor. A reference on an indented line after a blank line blocks it as well, since that may be an indented code block holding recorded evidence. A mention the scan skips because `/`, `-`, or `_` joins it, `.` precedes it, or `.` joins it to filename text blocks the remap; examples include `G4a/G4b` and `G4a.md`. Rewriting around it would leave it stale. So does an identity in a Scope or step Goal field that the scan skips, such as one in a code span, since those fields cite goals directly. Otherwise update every proven local reference with the definition, preserving other text and line endings. Code spans, fences, HTML comments, quotations, link targets, URI tokens, and unrelated identifiers do not authorize edits.

Any `incomplete-reference-scan` gap blocks every edit, since an unread file could hold a reference the remap would miss. Before writing, reject changed inputs, validate the proposed text, and stage same-directory replacements. A proposal adding any diagnostic the original text lacks, matched by code, file, line, and detail, writes nothing. With a plan, that comparison uses the full `structure` report, coverage diagnostics included. `unresolved` then carries the original diagnostics and the added ones. Compare the full Markdown inventory and captured directory identities before each replacement and after the last one; return state from the verified disk read. On replacement failure, restore replaced files only while their bytes match the proposal and their permissions match the original snapshot. Parent directories must still have their captured identities. `recovery` is `none`, `restored`, or `partial`; a partial recovery names unrecovered files and reports failure. File replacement is atomic per file, not across the task folder. No lock guards the gap between the last inventory check and each rename; a concurrent in-place write there can be overwritten. An interrupted run may leave a partial mapping; the next ordinary or explicit read-only load reports its structural defects.

`currentState` returns result.md's level-2 Current-state block verbatim, trimming trailing blank space. Include its heading through closing `---`, or through the line before the next level-2 heading when no separator exists. Return null without the file/block; a deeper Current-state heading does not qualify.

**`--compaction-plan` mode** requires result.md; plan.md is optional and supplies the active-pause status. stdout is one object: `{taskDir,resultFile,bytes,maxKb,due,precondition,keep,removable}`.

Due means bytes strictly exceed `maxKb * 1024`. Bytes is decoded-file UTF-8 length; maxKb uses `RESULT_MAX_KB` from `scripts/lifecycle-constants.ts`, without override. Maintain may override the health walk's trigger separately.

`precondition` is `{state,detail,uncommitted}`. Run `git -C <task-dir> cat-file -e HEAD:./result.md`: state is `ok` on success, otherwise `fails`; detail is null or Git's failure reason. Uncommitted reports pending file changes from `git status --porcelain`, or null when the precondition failed or status was unavailable. Only a clean, HEAD-resolvable result permits a compaction proposal; staged-but-never-committed and ignored files do not qualify. Follow `../workflow/reconciliation-compaction.md` for consent.

`keep` and `removable` partition level-2 result sections in file order, as `{heading,anchor,rule}` and `{heading,anchor}`. The pre-section header is ineligible; deeper headings belong to their enclosing section. Anchors use the same slug allocation as result-link checks. A tombstone uses the full reported heading and its existing anchor.

Keep-rule values:

- `current-state`, `decision-log`, `acceptance`, `health-boundary`, and `live-verification` protect those sections.
- `reconciliation` protects the last reconciliation section; earlier ones are eligible narrative.
- `compacted` protects prior tombstones; append to their stub instead of replacing it.
- `pause` protects only the most recent section owed by plan status: Blocked under blocked, In review under in-review. Recognize either a section heading or a bold label on its own line. Other pauses, including all pauses with absent/unparseable/other plan status, are removable.

**Lists report eligibility, never permission.** Callers choose superseded narrative and whether to propose compaction.

**Exit status for read-only modes.** 0: report written. 1: no readable plan.md, or no readable result.md in compaction mode. 2: bad usage, unavailable Git, or unexpected failure. Warnings go to stderr; a crash does not mean missing input.

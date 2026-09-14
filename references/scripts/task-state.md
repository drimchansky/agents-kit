# `scripts/task-state.ts`

Reports task state or compaction eligibility (`../workflow/reconciliation-compaction.md`). Both modes are read-only; callers retain judgment.

```
node scripts/task-state.ts <task-dir>
node scripts/task-state.ts --compaction-plan <task-dir>
```

**Contract.** stdout is one JSON object:
`{taskDir,plan,result,goalsFile,steps,nextPendingStep,nextPendingStepBody,checkpoints,goalCoverage,currentState}`.

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

`currentState` returns result.md's level-2 Current-state block verbatim, trimming trailing blank space. Include its heading through closing `---`, or through the line before the next level-2 heading when no separator exists. Return null without the file/block; a deeper Current-state heading does not qualify.

**`--compaction-plan` mode** requires result.md; plan.md is optional and supplies the active-pause status. stdout is one object: `{taskDir,resultFile,bytes,maxKb,due,precondition,keep,removable}`.

Due means bytes strictly exceed `maxKb * 1024`. Bytes is decoded-file UTF-8 length; maxKb uses `RESULT_MAX_KB` from `scripts/lifecycle-constants.ts`, without override. Maintain may override the health walk's trigger separately.

`precondition` is `{state,detail,uncommitted}`. Run `git -C <task-dir> cat-file -e HEAD:./result.md`: state is `ok` on success, otherwise `fails`; detail is null or Git's failure reason. Uncommitted reports pending file changes from `git status --porcelain`, or null when the precondition failed or status was unavailable. Only a clean, HEAD-resolvable result permits a compaction proposal; staged-but-never-committed and ignored files do not qualify. Follow `../workflow/reconciliation-compaction.md` for consent.

`keep` and `removable` partition level-2 result sections in file order, as `{heading,anchor,rule}` and `{heading,anchor}`. The pre-section header is ineligible; deeper headings belong to their enclosing section. Anchors use the same slug allocation as result-link checks. A tombstone uses the full reported heading and its existing anchor.

Keep-rule values:

- `current-state`, `decision-log`, `acceptance`, and `health-boundary` protect those sections.
- `reconciliation` protects the last reconciliation section; earlier ones are eligible narrative.
- `compacted` protects prior tombstones; append to their stub instead of replacing it.
- `pause` protects only the most recent section owed by plan status: Blocked under blocked, In review under in-review. Recognize either a section heading or a bold label on its own line. Other pauses, including all pauses with absent/unparseable/other plan status, are removable.

**Lists report eligibility, never permission.** Callers choose superseded narrative and whether to propose compaction.

**Exit status.** 0: report written. 1: no readable plan.md, or no readable result.md in compaction mode. 2: bad usage, unavailable Git, or unexpected failure. Warnings go to stderr; a crash does not mean missing input.

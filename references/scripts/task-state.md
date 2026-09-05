# `scripts/task-state.ts`

Reports one task folder's mechanical plan state for the skills that open a resolved task folder:
checkbox state, the next pending step and its body, checkpoint outcomes, result-anchor resolution,
the goal-coverage map, and the result's current-state block. Those skills keep the judgment that
reads this report — whether a claim still holds, whether a citing step delivers all of its goal — and
stop hand-enumerating the facts under it, and stop opening the files the report already carries.
Its second mode, `--compaction-plan`, reports the same kind of mechanical fact for a compaction
proposal (`../workflow/reconciliation-compaction.md`). **Neither mode writes anything.**

```
node scripts/task-state.ts <task-dir>
node scripts/task-state.ts --compaction-plan <task-dir>
```

**Contract.** stdout is exactly one JSON object,
`{taskDir,plan,result,goalsFile,steps,nextPendingStep,nextPendingStepBody,checkpoints,goalCoverage,currentState}`.

`plan` is `{file,status,statusRaw}`: `status` is a value of the plan lifecycle vocabulary, `unknown`
for a header the vocabulary does not hold, or null for no status header at all. `plan.md` is the
task's only lifecycle home, so `result` carries no status of its own: it is `{file,legacyStatus}`,
where `legacyStatus` is the pre-contract `**Status:**` header a result file may still hold
(`../workflow/task-lifecycle.md` § *`result.md` — no status field*), reported verbatim for
inspection, acted on by nothing, and null on a conformant file. `result` is null when the folder has
no `result.md`, and `goalsFile` is null when it has no `goals.md` — which empties every coverage list
rather than reporting the plan's own citations as unknown IDs.

`steps` follows plan order:
`{number,title,checked,anchor,anchorResolves,goals,goalEscape,dependsOn}`. `number` is the plan's own
step token, so a revision-inserted `Step 3a` reports as `"3a"`. `checked` reads the step's first
checkbox line — its `**What:**` marker. `anchor` is the anchor of the `([result](…))` link on that
same line, null when it carries none; `anchorResolves` is null for an unchecked step, which claims
nothing, and a boolean for a checked one — false when the link is missing, points outside `result.md`,
or names a heading `result.md` does not hold, counting a tombstone under its `## Compacted` stub as
held. `goalEscape` marks the `**Goal:** none (infra/refactor)` escape, which is what separates a
deliberate infra step from an orphan. `nextPendingStep` is the first unchecked step's number, null
when every step is checked; `nextPendingStepBody` is `{what,verify}` for that step — the text after
the `**What:**` marker on its checkbox line and after the `**Verify:**` marker on its own line, each
trimmed, each null when the step writes no such line, and the pair null when no step is pending. Both
are single lines as the plan format writes them: a criterion wrapped across lines reports its first
line, which is the report saying to open the step rather than a truncation to act on.
`checkpoints` lists every `### Checkpoint after Step N` the plan authors,
in plan order, each with the `**Outcome:**` token of the matching result section — null when no such
section exists, which is a checkpoint that has not run.

`goalCoverage` is `{goals,uncoveredGoals,orphanSteps,unknownGoalCitations,scopePartition}`. `goals`
maps each `goals.md` ID to the steps whose `**Goal:**` line cites it; `uncoveredGoals` are the IDs no
step cites — a goal the plan defers is listed there too, and its `deferred` membership is what makes
that expected rather than a gap. `orphanSteps` are steps citing no goal and carrying no escape;
`unknownGoalCitations` are steps citing IDs `goals.md` does not hold, empty when there is no
`goals.md` to check against. `scopePartition` is
`{delivered,deferred,missingFromPartition,inBoth}` over `goals.md`'s IDs, read from the plan's
`## Scope`; the partition is total exactly when the last two lists are empty.

`currentState` is the text of `result.md`'s `## Current state` block — its heading line through the
`---` that closes it, or, where none does, through the line before the next `##` heading — verbatim,
trailing blank space trimmed. It is null when the folder has no `result.md` and when the file opens
no such block; a `### Current state` nested under a later section is not the block, the same level-2
rule the keep-list below applies. Carrying the block here is what lets a caller read a task's
standing state without opening the log beneath it.

**`--compaction-plan` mode** answers the mechanical half of a compaction proposal — is one due, may it
run at all, and what would it collapse — for the skills that propose one. stdout is exactly one JSON
object, `{taskDir,resultFile,bytes,maxKb,due,precondition,keep,removable}`. The mode is about
`result.md`, so that file is the one it requires; `plan.md` is optional here and supplies only the
status the active pause section is judged against.

`due` is `bytes` **strictly over** `maxKb * 1024`, `bytes` being the UTF-8 length of the decoded
file. `maxKb` is `RESULT_MAX_KB` from `scripts/lifecycle-constants.ts` with no flag to override it:
`maintain` overrides the health walk's trigger because it reads the prose value at run time, while a
proposal for one folder has no such second source to reconcile against.

`precondition` is `{state,detail,uncommitted}` over `git -C <task-dir> cat-file -e HEAD:./result.md`.
`state` is `ok` when the result resolves at `HEAD` and `fails` otherwise, `detail` carrying git's own
reason on a failure and null on success. Compaction deletes text recoverable only from version
history, so nothing weaker qualifies: an ignored folder sits inside a repository while holding nothing
in history, and a staged-but-never-committed file has no commit holding its text — both report
`fails`. `uncommitted` is whether `git status --porcelain` still reports pending changes to the file,
which is what refuses a proposal until the user commits — uncommitted text is recoverable nowhere,
so only a clean, `HEAD`-resolvable result may be proposed for compaction
(`../workflow/reconciliation-compaction.md`); it is null when the precondition failed or
the status call did not run.

`keep` and `removable` partition the result's `##` sections in file order — `{heading,anchor,rule}`
and `{heading,anchor}`. The header block above the first `##` heading is not a section and is never
eligible, and a `###`-or-deeper heading belongs to the `##` section above it rather than opening one.
Anchors are allocated by the same slug rule the anchor check above uses, so a `removable` entry
carries both halves a tombstone needs: its `heading` is the bullet's whole text — nothing else, or the
step link that resolves through it stops resolving — and its `anchor` is the link that was pointing at
it.

`rule` names why a section is kept: `current-state`, `decision-log`, `acceptance`,
`health-boundary`, `reconciliation` — the last such section in the file, every earlier one being
narrative a later entry superseded — `compacted` for a prior `## Compacted` stub, whose tombstone
bullets are the anchors an earlier compaction left resolvable and which the next stub is appended to
rather than replacing, and `pause` for the most recent section the plan's **own status** owes:
`**Blocked:**` under `blocked`, `**In review:**` under `in-review`, recognized from the section's
heading or from a bold label on a line of its own inside it. A pause section the current status does
not owe is a closed pause, and reports as removable like any other prior log section; so does every
pause section when the plan is missing, unparseable, or in any other state.

**The two lists are eligibility, never a decision.** `removable` is everything the keep-list does not
protect; which of those sections are actually superseded narrative, and whether to propose the
collapse at all, stays with the caller and the consent rule that file owns.

**Exit status.** 0 = a report was written; 1 = nothing to report, because the argument names no
readable `plan.md` — or, under `--compaction-plan`, no readable `result.md`; 2 = the run could not be
carried out — bad usage, a `git` that is absent, or an unexpected failure. A crash must not land on 1,
which would report a readable plan folder as having none. Warnings go to stderr.

# Execution Loop: Consumer Bindings

The per-consumer index for the loop in `./execution-loop.md` — what each of the three consumers
substitutes for the loop's six parameters. Split out of the loop file because it is a **lookup
table, not the loop**: a consumer running the loop already carries its own bindings in full, and the
files that reach this contract from outside (a merge gate naming "the consumer's **Blocked**
binding", a domain pack naming "the consumer's **Record** binding") want this index and none of the
loop's beats.

**These are the index, not the authority.** Each consumer states its own bindings in full in its own
skill file; when a binding changes, it changes there and this index follows.

## implement-task

Runs the loop against a task folder's `plan.md`, with `goals.md` as the acceptance contract. Its §4
holds the bindings except **Acceptance**, which §7 states with the gate that runs it; §5 and §6 the
record formats.

- **Source** — one plan step, verified by that step's plan-authored `Verify:` line
- **Record** — the result-file section format `implement-task` §5 defines (per step in step-by-step
  mode, one combined `## Full Run` section in full-plan mode, merged batch steps excepted), with the
  step's checkbox flipped and linked to it, and the result's `## Current state` block rewritten after
  each recorded unit (`./task-lifecycle.md`)
- **Blocked** — the `blocked` status on both files, plus a `**Blocked:**` section naming the cause and
  the last health boundary that passed with what it covered, or `none` (`./task-lifecycle.md`)
- **Acceptance** — `goals.md` by `G<n>` ID, tagged and written to the result file's `## Acceptance`
  section
- **Health boundaries** — before every step-by-step pause, before handing the tree to the user; at an
  authored checkpoint after its integration assertions; at a natural batch bound before dependent work;
  at the full-plan tail immediately before acceptance; and on every later-run `in-review → done`
  finalization, after the pending external goals are re-checked and before status advances. A batch that
  ends at a checkpoint shares that checkpoint's one boundary; a tail batch shares the full-plan tail.
  The later finalization never reuses the earlier tail boundary and records its fresh result in the dated
  section `implement-task` §8 defines. A failure uses this binding's **Blocked** behavior, taking the
  registered `in-review → executing` edge first when finalization began from `in-review`.
- **Integration assertions** — every assertion authored by a plan `### Checkpoint after Step N`, run
  at that checkpoint before its health boundary. Each named end-to-end outcome is exercised end to
  end.

## implement

Runs the loop against an ask framed in the session, writing no file but the work itself. Its §3 holds
the bindings in full; §1 frames the ask and names each item's criterion, §5 the report.

- **Source** — one item of the framed ask, verified by the criterion named when it was framed
- **Record** — the chat report at the end. **This skill writes no task-folder file and no status** —
  work that wants a durable record belongs in `plan-task` → `implement-task`
- **Blocked** — report what failed, what was tried, and what's needed, then stop; there is no status
  to set
- **Acceptance** — the framed ask, verified live and reported in chat; a gap is Stop-the-Line, not a
  caveat
- **Health boundaries** — at the end of the run immediately before acceptance; at every mid-run user
  inspection pause; and once after a fully merged batch before a dependent item starts. A tail batch
  shares the end-of-run boundary. A failure stops under this binding's **Blocked** behavior.
- **Integration assertions** — exercise the framed ask's end-to-end outcome whole at the end of the
  run. A run wanting more named integration assertions is a sign the work wanted `plan-task`.

## fix-findings

Runs the loop against the fixable members of a findings set — a session review, a PR's comments, or a
saved or pasted list — one fix per unit. Its *Applying Fixes* section holds the bindings in full.

- **Source** — one finding with its chosen fix (a Confirmed verdict's fix option, or a fix the user
  approved), verified by the problem the finding names no longer reproducing
- **Record** — the chat report; no task-folder file, no status
- **Blocked** — an **immediate**-outcome failure restores that fix's pre-fix capture and continues with
  the next finding; a failed final-integrated outcome goes instead to the skill's dependency-safe
  recovery, which may revert a whole implicated group or, unconverged, restore the pre-run baseline and
  stop the run — never a failing fix or implicated group left in the tree. A failed health boundary
  isolates fixes only when the failed command is green at the baseline; a matching baseline failure
  retains the survivors as **Health uncertifiable**, the command having been red on bytes that predate
  every fix; an inconclusive comparison establishes no control and restores the complete pre-run
  content baseline, bucketing every retained fix as Fix failed (`fix-findings`
  § *Integrated health boundary*)
- **Acceptance** — every selected finding in exactly one report bucket, re-read against the live
  tree
- **Health boundaries** — no up-front health run and no per-batch health run. One full recipe on the
  retained-fix tree, after every selected fix's immediate outcome has settled and every retained fix's
  final-integrated outcome passes; every tree-changing recovery earns one fresh boundary before any
  survivor is Fixed. A changed-code run is never complete before that boundary is green, and the
  certifying re-review of the whole set is a separate run. What a red boundary does — the baseline
  comparison, what it implicates, and what it restores — is procedure, not cadence: `fix-findings`
  § *Integrated health boundary* owns it.
- **Integration assertions** — none within the fix run; the certifying re-review is a separate review
  run over the changed code.

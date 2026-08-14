---
name: fix-findings
description: Use when asked to fix, apply, or address a set of findings — from a review in this session, a PR's review comments, or a pasted or saved list. Applies the fixes (a Confirmed finding automatically when the targeted fix is clear and low-blast-radius; anything unverified only through one batched ask showing the change as a diff) and reports the rest untouched. Edits code only; never stages, never commits, never writes back to the findings' source.
argument-hint: '[source: PR number/URL, file path, pasted findings, or a named subset — defaults to the latest session findings]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

The write-mode follow-up to every code-review skill and source that produces findings: take a findings set from anywhere, apply the fixes, and report the rest untouched. From a verify composite, each **Confirmed** finding arrives with `verify-issue`'s root cause and fix options (ordered targeted → thorough, each with blast radius) — this skill consumes that judgment; it doesn't re-litigate it. Everything else — a plain review's findings, a PR's review comments, a saved or pasted list — carries less, often just a location and a complaint, and the gate routes it accordingly.

**CRITICAL**: Nothing is fixed on this skill's own judgment alone. A fix needs one of exactly two authorities — a **Confirmed** verdict, or the user's approval in the ask batch. **Withdrawn and Inconclusive findings are never edited**: a probe looked and either found no issue or couldn't establish a root cause, and that evidence outranks any later impulse to fix anyway. Findings nobody verified — a plain review's, an external list's, or one a verify phase marked **Unverified** — carry no such evidence either way, so they take the ask and never the auto path.

The write surface is **working-tree code and nothing else**: never stages, never commits, never otherwise mutates Git state — staging the fixes is the user's call, per the Git-discipline rule. Reading findings from a PR adds nothing to that surface: they are fixed locally, never answered with a reply, a resolved thread, or a push. `triage-findings` owns the read side of a PR's findings and never writes back to it either; nothing here changes that.

## Source

**Any findings set works.** Resolve it in this order, mirroring `../triage-findings/SKILL.md`'s Sources:

1. **Explicit argument wins.** A PR number or URL → PR mode. An existing file path → parse that file. Pasted text, or a pointer like "the review above" → those findings. A named subset ("the two majors", specific `file:line`s) → those entries of the latest session findings.
2. **No argument:** the most recent findings in this session, with everything fixable selected —
   - a **verify composite** (`review-commit-triage-verify`, `review-pr-triage-verify`, `triage-findings-verify`) → its Confirmed and Unverified findings;
   - a **plain review** (`review-commit`, `review-pr`) or a **`triage-findings` batch** → all of it, none of which carries a verdict.
3. **Nothing to work from** → say so, name the forms above, and stop. Unlike `triage-findings`, this skill does **not** fall back to the current branch's open PR: that skill reads, this one edits, and fetching a remote findings list to start editing against is not something to infer from an empty argument.

**Code findings only.** Whatever the route in — a `triage-findings` batch, a file, a paste — a documentation findings set is out of scope: this skill's integrated-health boundary uses the engineering recipe, which proves nothing about prose. A `/review-docs` set belongs back with a doc review.

**Never produce the findings yourself** — no reviewing the diff, no scanning for problems to fix. That the judgment came from somewhere else is this skill's whole safety property, and a set you authored in the same breath as the fix is not a findings set. A verified review stays the best input, because verdicts are what let a fix apply without a question; the other sources are accepted because refusing them forced a full verify pipeline over changes whose fix was already evident, and the ask batch is what keeps that safe.

**PR mode** fetches per `../triage-findings/SKILL.md`'s Fetch section — its three comment sources and the paginated GraphQL thread query, unchanged. A thread already resolved there is **addressed**: report it Untouched, never re-fix it.

Take each finding as its source left it — severity if it has one, `file:line` if it has one, and whatever else it carries: root cause and fix options from a verify composite, a recommendation from a review, free prose from a PR comment. Don't re-rank a severity and don't assign a verdict the source didn't give. Findings triage landed outside **open** (addressed / verify buckets) are already handled — report them under Untouched with their bucket.

**Check the anchor before fixing an external finding.** A finding from a PR, a file, or a paste can predate the current code. If its `file:line` no longer holds what it describes, or its quoted snippet no longer matches, it lands in Untouched as `anchor moved` — the issue may already be fixed, and editing there invents a problem to solve. If it is too vague to yield one specific change, it lands in Untouched as `not actionable` rather than going to the ask: approving a fix is the user's job, designing one from an unclear complaint is not.

## The Gate: Auto vs Ask

Work in severity order (critical → major → minor), or in source order where the findings carry no severity — but **within dependency order**, so a fix never runs before one it is known to depend on. Findings are usually independent and the two orders rarely disagree; where they do, dependency wins, because severity order alone would invert a pair and leave the later fix testing a base it needs. That order is the one the executor packet carries (`./references/workflow/executor-contract.md` § *Bindings*) and the one a batch merges in. A dependency is **known** in one of two forms, by phase: before execution — for this ordering and for the cascade rule in § *Content baseline and immediate outcomes* — one the findings' source or the user declares, or an overlap between two fixes' declared surfaces, each derived from its chosen option's stated blast radius (§ *Execution strategy: inline by default*); after execution, for recovery, the recorded-change-set form § *Dependency-safe recovery* defines. Nothing else counts — no fix is skipped or reverted as a cascade on an inferred relationship. Two rules come before the gate itself:

**A finding without a Confirmed verdict always routes to the ask batch.** That is everything except a verify composite's Confirmed entries — a plain review's findings, Unverified ones, and every external set. No probe established a root cause, so there is no verified judgment for an auto-apply to stand on; the user's approval is what supplies it.

**Show the change, not the claim.** Each ask entry carries the finding, the fix as a concrete diff of what you would write, and your recommendation. A prose description invites approval of the *claim* — and the claim is the unverified part. A diff is approved as an edit, which is the decision actually being made.

For a **Confirmed** finding, decide from its fix options:

- **Apply the targeted option without asking** when it is unambiguous — the options agree on one evident change, no genuine design choice among them — and its blast radius is minimal: confined to the files the review covered, no public API or behavior contract change beyond what the finding names, no new dependency. Default to auto here because at that size the fix is cheaper to apply than to discuss, and the review already did the judging.
- **Route to the ask batch** otherwise — genuinely different options with trade-offs, a thorough option worth weighing against the targeted one, intent the code can't settle, blast radius reaching beyond the reviewed files. A wrong guess there costs more than the question.

**One batched ask per run.** Collect every ask-routed finding and present them together in a single interaction — each with the finding, its diff or options, and your recommendation — not one interruption per finding. Apply the decisions, then continue. A set where most findings route to the ask makes for a long single interaction; that is the correct shape, and splitting it into a per-finding drip is not an improvement.

## Applying Fixes

Run each fix through the loop in `./references/workflow/execution-loop.md` — read it before the first fix. This skill's bindings:

- **Source** — one finding with its chosen fix: a Confirmed finding's fix option, or the fix the user approved in the ask. The verify criterion is **the problem the finding names no longer reproduces**, re-checked against the finding's own evidence — a Confirmed finding's root cause and reproduction path, or, for an unverified one, the specific thing the finding called wrong. That criterion is one half of the tier: proving a fix's outcome also runs the per-unit checks the resolved domain's `verification.md` adds (`./references/workflow/execution-loop.md` § *Two verification tiers*) — for code, validating the comments this fix touched.
- **Record** — the chat report below; this skill writes no task-folder file and no status.
- **Blocked** — a fix that cannot pass its **immediate** outcome is restored from its pre-fix content state and reported `fix failed (reverted): <reason>`. A failed **final-integrated** outcome uses the dependency-safe recovery below instead — by then later fixes have landed on top, so restoring one fix's capture would discard them, and the capture may already be gone. A failed health boundary follows § *Integrated health boundary*: isolate from a green baseline control when one exists; retain the survivors as **Health uncertifiable** when the same command was already red at the baseline; restore the complete pre-run content baseline when the comparison is inconclusive. Findings are independent, so an isolated failure does not strand independent survivors, but no failing fix or implicated group remains in the tree, and a collection no boundary certifies is reported as such rather than as Fixed.
- **Acceptance** — every selected finding lands in exactly one report bucket, each bucket entry re-read against the live tree before reporting.
- **Health boundaries** — no up-front health run and no per-batch health run. After all selected serial and batched fixes' immediate outcomes have settled and all retained fixes' final-integrated outcomes pass, run one full engineering-health boundary for the retained fixes. A red boundary follows this section's recovery procedure; every tree-changing recovery earns one fresh full boundary before any survivor is Fixed. The certifying re-review of the whole set remains a separate run.
- **Integration assertions** — none within the fix run; the certifying re-review is a separate review run over the changed code.

The immediate outcome belongs to each fix; the health boundary belongs to the retained collection. Do not
run the project health recipe per fix: a successful multi-fix run pays each exposed full-health command
once, at its integrated boundary. A fix is Fixed only when its final-integrated outcome and the current
final-tree health boundary both pass.

### Content baseline and immediate outcomes

After the selection gate and before any fix edits, capture an immutable **pre-run content baseline** of
the dirty shared tree. It preserves the bytes and presence of tracked, staged, unstaged, and untracked
content as applicable, including separately staged and unstaged versions, without changing the index,
staging, or commits. This is a content snapshot, not a clean-Git assumption or a Git operation: user
bytes that predate the run are never recovery material. There is no up-front health comparison.

**Attribution bounds every restoration.** No restore or rebuild in this skill removes content it cannot
attribute to the baseline or to a recorded change set — content that appeared after the baseline is
neither, so it is preserved and surfaced to the user, never removed to satisfy an equality or to return
the tree to a capture. This is the one home for that rule; the restore steps below cite it rather than
restating it. A run that edits the tree is not the only thing touching it, and a snapshot restored
blindly reverts the user's work as readily as the run's own.

Process attempted fixes in the established order. Immediately before each serial fix — or before a
batch unit's eventual shared incorporation — capture its exact pre-fix content state, not merely the
declared edit surface. A serial immediate-outcome pass records its ordered, run-owned change set: the
content and presence delta from the state immediately before that fix. A batch executor's immediate
pass is advance evidence only; record its incorporated delta only after the merge or serial fallback
passes the integrated outcome re-proof. The change set is evidence and recovery input only; it is never
staging or commit state. If the immediate outcome fails, restore that pre-fix content state within the
attribution bound above, bucket the finding Fix failed, and continue. A not-yet-attempted fix whose
known dependency is the fix that just failed is **not attempted**: bucket it Fix failed naming that
prerequisite, since running it against a base missing those bytes tests nothing and reports a cascade as
an independent failure — the misattribution the recovery records below forbid. Do not let a partial or
failed attempt become part of a later change set.

After every immediate outcome has settled, re-prove every retained finding's full outcome tier on the
final integrated shared tree. Earlier local proof is not enough for Fixed. Resolve a failed final outcome
through the dependency-safe recovery below, using that outcome as the failure predicate, before running
project health. Re-check all retained outcomes again after each rebuild.

### Dependency-safe recovery

Use coordinator-managed scratch copies seeded from the immutable baseline. Replay the ordered change
sets in dependency-closed groups and test the active failure predicate there. Here the post-execution
form of § *The Gate: Auto vs Ask*'s definition applies: a dependency includes an explicit dependency and
overlapping or ordering-sensitive change sets; never replay a later overlapping fix alone when its patch
embeds or relies on earlier bytes.

**Establish the control before isolating**, per the green-control rule in
`./references/workflow/execution-loop.md` § *Evidence lifecycle*: a subset only implicates itself when
the predicate is green on the state each replay starts from. The two predicates need different
controls, and using the wrong one implicates work that was never at fault.

- **A failed health command** — the control is the immutable baseline, already proven green by the
  comparison the boundary section runs first. Isolate with only the failed command or commands, never
  the whole recipe.
- **A failed final-integrated outcome** — the control is the baseline **plus that finding's own change
  set**, never the bare baseline, which predates the fix and so reproduces the finding's problem by
  definition. Every replayed group carries that change set and its dependency closure, and that
  finding's **full outcome tier** is what is tested — the same tier whose failure opened the
  recovery, never the criterion alone, or a tier that failed on a per-unit check leaves every
  replayed group green and implicates nobody. Replay it alone first: if that tier still fails there,
  the fix itself is inadequate — bucket that finding Fix failed and implicate no other group.

Against its own control: if one group fails alone, it is the implicated dependency group. If groups
pass alone but a combination fails, isolate the smallest supported interaction group. If the evidence remains ambiguous, implicate
and revert the whole ambiguous group rather than guessing that the most recent fix caused it. Recovery
records say whether the result was one fix, a dependency group, or an interaction group; they do not
misattribute a group failure to every member as an individual failure.

Rebuild the shared tree from the immutable baseline plus survivor change sets in original order. The
result must equal that baseline plus exactly the ultimately reported survivors, with every pre-run
byte and presence otherwise preserved and every unattributed byte held by the attribution bound
above — the equality is a statement about this run's own change sets, never a licence to delete what
the run did not write. Do not reverse-patch, reset, or check out user content. **A survivor whose
known dependency is in the implicated group is not a survivor**: it joins that group, is reverted
with it, and is bucketed Fix failed naming that prerequisite — the same rule the immediate path
applies to a not-yet-attempted fix above, for the same reason. Replaying it onto a base missing its
prerequisite's bytes tests nothing, and the next pass would then read it as independently inadequate,
which is the cascade misattribution this section forbids. A later fix that overlaps an implicated
change set survives only when it is independently replayable or re-executable and its outcome can be
re-proved on the rebuilt base; otherwise it too remains in the implicated dependency group. **Which of
the two is permitted follows the fix's authority.** A Confirmed auto-path fix may be re-executed,
because the verdict authorizes the change rather than a particular diff. An **ask-approved** fix may
only be replayed verbatim from its recorded change set: what the user approved was an edit, these
exact bytes (§ *The Gate: Auto vs Ask*), and re-executing it against a different base regenerates
bytes nobody approved. An ask-approved fix that cannot be replayed verbatim is re-approved against a
freshly shown diff or bucketed Fix failed — never silently re-derived. Re-prove every survivor on
the rebuilt final tree. Remove scratch copies and captures once their evidence has been recorded;
never mutate Git state.

### Integrated health boundary

When retained fixes remain, run one complete engineering health boundary over their final integrated
tree (`./references/engineering/verification.md`). If it is green, that unchanged-tree result supplies
pre-presentation health evidence and the survivors can be reported Fixed.

If it is red, rerun only the failed command or commands against the immutable baseline first — in a
coordinator-managed scratch copy seeded from it and materialized with the dependency and build state
that command needs, so an exposed command can execute there at all; never by moving the shared tree
back to the baseline to observe it, and never a second full recipe merely to compare. **Reuse or link
that state from the shared tree only where no retained change set affects it**, and re-derive it from
baseline sources otherwise: a fix that touched a manifest, a lockfile, a codegen input, or a build
input leaves the shared tree's derived state downstream of this run's own edits, and baseline sources
under it are a hybrid rather than the baseline — which is exactly the control this comparison exists
to establish. A command that cannot execute in that copy, or whose state cannot be re-derived from
the baseline, yields an **inconclusive comparison** — neither matching nor green, and never grounds
for selectively implicating one fix.

Neither a matching baseline failure nor an inconclusive comparison attributes the failed boundary to
a particular fix, but they differ in what they prove, and the disposition follows that difference.

**A matching baseline failure** is positive evidence the run did not cause the red: the same command
was already failing on bytes that predate every fix. Retain the survivors and report each under
**Health uncertifiable** — its final-integrated outcome evidence, the baseline-failing command, and
that no boundary certifies this tree. They are not Fixed, since Fixed requires a green boundary; the
certifying re-review the run's **Next** points at is what resolves them. Reverting outcome-verified
work over a failure the baseline already carried would discard the user's fixes for a defect they did
not introduce.

**An inconclusive comparison** proves nothing either way — the control was never established. Restore
the shared tree to the immutable pre-run content baseline within the attribution bound above and place
every still-retained attempted fix in Fix failed, naming the reason the comparison could not run.
Preserve Decided, Untouched, and earlier immediate-failure buckets; no changed-code survivor remains.
This is collection-level rollback on an unestablished control, not selective fault attribution.

If the failed command is green at baseline, use dependency-safe recovery with those failed commands
as the predicate. Rebuild from baseline plus survivors, re-prove every survivor's final-integrated
outcome, then run one fresh full health boundary. Repeat when that boundary is still red. If
recovery cannot converge to a green complete boundary in this session, restore the pre-run baseline
within the attribution bound above and place every still-retained attempted fix in Fix failed with
the unresolved-health reason. Preserve Decided, Untouched, and earlier immediate-failure buckets; no
changed-code survivor remains or is reported Fixed. A fresh full-health run is only for this failure
recovery; otherwise the successful boundary remains the run's one complete recipe.

### Execution strategy: inline by default

**The delegation surface is Confirmed auto-path fixes only.** A fix the gate routed to auto on a **Confirmed** verdict is the only kind an executor may apply. Ask-routed fixes stay here: the coordinator authored the diff the user approved, so nothing is left for an executor to decide, and drafting an ask-batch diff sits too close to judgment to hand off. **Withdrawn and Inconclusive findings are never edited at all** — by this session or by any executor; delegation changes nothing about that.

**Default inline** because a single fix is small and assembling a self-contained packet costs more than making the edit; **delegate when** the remaining run holds several auto-path fixes *and* this fix's packet is self-contained — no mid-fix user interaction expected.

A delegated fix runs through an **executor** per the `fix-findings` binding in `./references/workflow/executor-contract.md` § *Bindings* — read it before the first delegation — using the native engine and host adapter defaults in `./references/workflow/agent-fanout.md` § *Write-mode engine registry*. That binding fixes the packet; the point of it is that the executor sees only the packet — the finding verbatim, its root cause, the chosen fix option, the expected surface, its processing order and any known dependencies, the always-applying pack section verbatim, the engineering-pack guidance the fix's surface triggers by path — and never this session, so whatever the fix depends on has to be in it. Its immediate-outcome result is advance evidence: the coordinator captures the ordered change set and performs the final-integrated checks and health boundary.

**The write surface binds the executor exactly as it binds you**: working-tree code and nothing else, never staged, never committed, no other Git state mutated, and nothing written back to the findings' source — no reply, no resolved thread, no push. The binding restates it for the executor. Delegation is not an escape hatch from the Git-discipline rule.

**Announce and record.** Say in chat which fixes are being delegated and why the trigger fired, and note the delegation inside the affected `Fixed` / `Fix failed` entry — no new bucket. That record is what keeps the inline default from drifting silently either way.

**Parallel batches.** Confirmed auto-path fixes may batch only under `./references/workflow/agent-fanout.md` § *Coordinator-side parallel batch*; its worktree placement, frozen shared tree, complete content/presence surface checks, ordered incorporation, and cleanup bind here. The order is this skill's processing order (§ *The Gate: Auto vs Ask*), and each expected surface is the chosen option's stated blast radius. After every merge or declared serial fallback, re-prove that finding's full outcome tier on the integrated tree — never the criterion alone — before appending its incorporated content/presence change set — relative to the shared state immediately before it, with known dependencies — to the immutable run-baseline recovery ledger. Executor proof is advance evidence only. After all selected fixes, these ledger entries feed the final-integrated outcome sweep and the one retained-collection health boundary; a batch adds no health pass of its own.

**Judgment stays with the coordinator** under every posture: the auto-vs-ask gate, the one batched ask,
all final-integrated outcomes, the health boundary, recovery, and the report buckets.

**Failure keeps revert-and-continue intact.** An unavailable or hung batch executor, like a surface escape or a conflict, discards its worktree — which leaves the shared tree untouched, the cleanest revert available — and the fix then re-executes serially against the integrated tree, per `./references/workflow/agent-fanout.md` § *Coordinator-side parallel batch*. All four triggers take that one path; none of them silently drops the fix. For a serial delegate, the coordinator restores the pre-fix content capture on an immediate failure — within the attribution bound above, so residue the run did not write is surfaced rather than reverted — then retries inline or buckets the finding Fix failed and continues. A **merge-position** integrated-outcome failure restores the exact pre-incorporation capture § *Content baseline and immediate outcomes* took, buckets the finding Fix failed, and continues — at that position the incorporation is the newest delta and its capture is still in hand, so the ledger recovery's own rationale (later fixes landed on top, the capture may be gone) does not apply, and the failed unit has no ledger entry to recover from in any case (`./references/workflow/agent-fanout.md` § *Coordinator-side parallel batch* records a change set only after the outcome passes). A **later** final-outcome or health failure is recovered from the ordered change-set ledger and immutable baseline above, never by unapplying a patch from the live dirty tree. The absolute half holds throughout: remove worktrees before recovery and never continue with a failing fix or implicated group left in the tree.

## Output

Lists, never tables. Omit empty buckets.

- **Fixed** — every applied fix, per finding: the original text with severity, what changed (`file:line`), its final-integrated outcome evidence, and the current final-tree health boundary. Mark an entry that had no Confirmed verdict as fixed on the user's approval, so the report never lends a verified finding's authority to one that had none. A delegated fix's entry notes the delegation and its batch where it ran in one.
- **Health uncertifiable** — survivors retained after a red boundary whose failed command was already red at the immutable baseline: per finding, the original text with severity, what changed (`file:line`), its final-integrated outcome evidence, and the baseline-failing command nothing can certify against. Not Fixed — a green boundary is what Fixed requires, and the certifying re-review **Next** points at is what resolves these.
- **Decided** — ask-routed findings that produced no fix: the user's decision and why nothing was applied — skipped, deferred, or the finding rejected. An ask-routed fix that was applied belongs in **Fixed**, not here.
- **Fix failed** — fixes that were reverted, and fixes never attempted because a dependency of theirs failed, each with the reason and what would unblock them: the named prerequisite for one skipped as a cascade; the reason the baseline comparison could not run, after collection-level rollback on an unestablished control; the unresolved-health reason after an unconverged recovery; or whether one fix, a dependency group, or an interaction group was implicated. A never-attempted entry says so rather than reporting `(reverted)`, which would assert an edit that never happened. A delegated one notes the delegation and its batch here too.
- **Untouched** — Withdrawn and Inconclusive findings with their verdict as the reason, findings triage landed outside **open** with their bucket, external findings dropped as `anchor moved` or `not actionable`, and any finding the user's subset excluded.

**Next:** the fixes are unreviewed and unstaged — certify them with a review of the changed code. For a staged-diff flow that means staging the fixes first, then `/review-commit` (or `/review-commit-triage-verify`), then `/commit`. Findings that came from a PR or a saved list are answered in the working tree only: replying to the source, resolving its threads, and pushing all stay with you.

## Don't Rationalize

- "The probe confirmed it, so the fix must be right" — The probe confirmed the *problem*. The fix's verify is the root cause no longer reproducing, checked fresh.
- "This Inconclusive one looks easy, I'll fix it while I'm here" — A probe investigated and couldn't establish the root cause; that verdict is the contract, and "looks easy" is not new evidence. Ask for another verify pass instead.
- "The user will obviously pick the targeted option, I'll skip the ask" — The gate routed it because judgment was needed. Obvious-to-you is the thing being checked.
- "I wrote this finding myself an hour ago and I'm sure of it — the ask is a formality" — Confidence in your own unverified finding is the least reliable input available, and it is precisely what the ask exists to check. Sureness is not a verdict.
- "The executor reported the fix verified, so it's Fixed" — That is only immediate evidence. Fixed means the criterion holds on the final integrated tree and its current full health boundary is green.
- "The newest fix made health red, so undo it" — Overlap and interactions make recency unreliable. Isolate dependency-closed groups from the immutable baseline and revert only what the evidence implicates.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Findings sourced per **Source** — a session run, a PR, a file, or a paste; none produced by this run, none re-verdicted
- [ ] No Withdrawn or Inconclusive finding edited; every fix lacking a Confirmed verdict approved by the user against a shown diff
- [ ] Every ask-routed finding decided in one batched interaction
- [ ] External findings anchor-checked before fixing; nothing written back to a PR or findings file
- [ ] Immutable pre-run content baseline captured before any edit; every attempt has an exact pre-fix capture and an ordered run-owned change set or an exact restoration, and every batched entry records the incorporated content/presence delta from the immediately preceding shared state with its dependencies
- [ ] Every retained finding's full outcome tier re-proved on the final integrated tree — the criterion plus the per-unit checks the resolved domain adds, including touched-comment validation for code; every Fixed entry has that evidence and a current final-tree health boundary
- [ ] One full health recipe ran on the happy path after all selected serial and batched fixes; a red command was compared with the baseline alone, a matching baseline failure retained its survivors as Health uncertifiable, an inconclusive comparison restored the pre-run baseline with no changed-code survivor, and a green control used dependency-safe scratch isolation before another full recipe
- [ ] Every failed fix or group was restored without changing pre-run bytes, index, staging, or commits; an unconverged health recovery restored the exact baseline and left no changed-code survivor
- [ ] Every selected finding in exactly one output bucket
- [ ] Batched fixes ran only over blast-radius-declared, pairwise-disjoint surfaces and came back through `./references/workflow/agent-fanout.md` § *Coordinator-side parallel batch*'s ordered gates, in this skill's processing order
- [ ] Delegation confined to Confirmed auto-path fixes — no ask-routed, Withdrawn, or Inconclusive finding sent to an executor — and every delegation announced and noted in its `Fixed` / `Fix failed` entry
- [ ] The gate, the batched ask, final-integrated outcome checks, health recovery, and the report buckets stayed with the coordinator
- [ ] Nothing staged, nothing committed, no Git state mutated (transient coordinator-managed batch worktrees excepted — created scratch, removed after merge)

---
name: fix-findings
description: Use when asked to fix, apply, or address a set of findings — from a review in this session, a PR's review comments, or a pasted or saved list. Applies the fixes (a Confirmed finding automatically when the targeted fix is clear and low-blast-radius; anything unverified only through one batched ask showing the change as a diff) and reports the rest untouched. Edits code only; never stages, never commits, never writes back to the findings' source.
argument-hint: '[source: PR number/URL, file path, pasted findings, or a named subset — defaults to the latest session findings] [-x (cross-vendor executor)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

The write-mode follow-up to every code-review skill and source that produces findings: take a findings set from anywhere, apply the fixes, and report the rest untouched. From a verify composite, each **Confirmed** finding arrives with `verify-issue`'s root cause and fix options (ordered targeted → thorough, each with blast radius) — this skill consumes that judgment; it doesn't re-litigate it.

**CRITICAL**: Nothing is fixed on this skill's own judgment alone. A fix needs one of exactly two authorities — a **Confirmed** verdict, or the user's approval in the ask batch. **Withdrawn and Inconclusive findings are never edited**: a probe looked and either found no issue or couldn't establish a root cause, and that evidence outranks any later impulse to fix anyway. Findings nobody verified — a plain review's, an external list's, or one a verify phase marked **Unverified** — carry no such evidence either way, so they take the ask and never the auto path.

The write surface is **working-tree code and nothing else**: never stages, never commits, never otherwise mutates Git state — staging the fixes is the user's call, per the Git-discipline rule. Reading findings from a PR adds nothing to that surface: they are fixed locally, never answered with a reply, a resolved thread, or a push.

## Flags

- `-x` — Cross-vendor executor: run this skill's write-mode fan-out on the cross-vendor engine rather than the native one — a write-mode executor, not a probe — under the coordinator's unchanged gates, per `./references/workflow/executor-contract.md` § *Write-mode engine registry*, whose `cross` entry selects the engine and hands its rules — the worktree-always placement, the once-per-run statement of what leaves the machine, the cleanup, and the announced degrade ladder, whose last rung is this skill's binding **Fallback** — to `./references/workflow/executor-engines-cross-vendor.md` along with the launch recipes. Off by default. It reroutes every fix § *Execution strategy: every auto-path fix delegates* delegates — which is every Confirmed auto-path fix no posture exception keeps inline, within that section's unchanged surface — ask-routed fixes stay with the coordinator, and Withdrawn or Inconclusive findings are never edited, flag or no flag — and the engine that ran a fix is named in its existing `Fixed` / `Fix failed` entry, never a new bucket. The limit worth knowing before typing it: **a delegated fix costs the coordinator more under `-x` than under `native`** — seed a worktree, snapshot a baseline, run the surface check, incorporate, remove, where a native serial delegate applies the fix on the shared tree. A single-fix run pays that whole cost for one unit, so `-x` earns its keep best on a findings set with several auto-path fixes. <!-- cold -->

## Source

**Any findings set works.** Resolve it in this order, mirroring `../triage-findings/SKILL.md`'s Sources:

1. **Explicit argument wins.** A PR number or URL → PR mode. An existing file path → parse that file. Pasted text, or a pointer like "the review above" → those findings. A named subset ("the two majors", specific `file:line`s) → those entries of the latest session findings.
2. **No argument:** the most recent findings in this session, with everything fixable selected —
   - a **verify composite** (`review-commit-triage-verify`, `review-pr-triage-verify`, `triage-findings-verify`) → its Confirmed and Unverified findings;
   - a **plain review** (`review-commit`, `review-pr`) or a **`triage-findings` batch** → all of it, none of which carries a verdict.
3. **Nothing to work from** → say so, name the forms above, and stop. Unlike `triage-findings`, this skill does **not** fall back to the current branch's open PR: that skill reads, this one edits, and fetching a remote findings list to start editing against is not something to infer from an empty argument.

**Code findings only.** Whatever the route in — a `triage-findings` batch, a file, a paste — a documentation findings set is out of scope: this skill's integrated-health boundary uses the engineering recipe, which proves nothing about prose. A `/review-docs` set belongs back with a doc review.

**Never produce the findings yourself** — no reviewing the diff, no scanning for problems to fix. That the judgment came from somewhere else is this skill's whole safety property, and a set you authored in the same breath as the fix is not a findings set.

**PR mode** fetches per `../triage-findings/SKILL.md`'s Fetch section, unchanged. A thread already resolved there is **addressed**: report it Untouched, never re-fix it.

Take each finding as its source left it — severity if it has one, `file:line` if it has one, and whatever else it carries: root cause and fix options from a verify composite, a recommendation from a review, free prose from a PR comment. Don't re-rank a severity and don't assign a verdict the source didn't give. Findings triage landed outside **open** (addressed / verify buckets) are already handled — report them under Untouched with their bucket.

**Check the anchor before fixing an external finding.** A finding from a PR, a file, or a paste can predate the current code. If its `file:line` no longer holds what it describes, or its quoted snippet no longer matches, it lands in Untouched as `anchor moved` — the issue may already be fixed, and editing there invents a problem to solve. If it is too vague to yield one specific change, it lands in Untouched as `not actionable` rather than going to the ask: approving a fix is the user's job, designing one from an unclear complaint is not.

## The Gate: Auto vs Ask

Work in severity order (critical → major → minor), or in source order where the findings carry no severity — but **within dependency order**, so a fix never runs before one it is known to depend on. Findings are usually independent and the two orders rarely disagree; where they do, dependency wins, because severity order alone would invert a pair and leave the later fix testing a base it needs.

That order is the one a batch merges in, and the one the executor packet carries — `./references/workflow/executor-contract.md` § *Bindings*, read it before the first delegation. <!-- cold -->

A dependency is **known** in one of two forms, by phase. Before execution — for this ordering and for the cascade rule in § *Content baseline and immediate outcomes* — it is one the findings' source or the user declares, or an overlap between two fixes' declared surfaces, each derived from its chosen option's stated blast radius (§ *Execution strategy: every auto-path fix delegates*).

After execution, for recovery, it is the recorded-change-set form `./references/workflow/fix-findings-recovery.md` § *Dependency-safe recovery* defines. <!-- cold -->

Nothing else counts — no fix is skipped or reverted as a cascade on an inferred relationship. Two rules come before the gate itself:

**A finding without a Confirmed verdict always routes to the ask batch.** That is everything except a verify composite's Confirmed entries — a plain review's findings, Unverified ones, and every external set. No probe established a root cause, so there is no verified judgment for an auto-apply to stand on; the user's approval is what supplies it.

**Show the change, not the claim.** Each ask entry carries the finding, the fix as a concrete diff of what you would write, and your recommendation. A prose description invites approval of the *claim* — and the claim is the unverified part. A diff is approved as an edit, which is the decision actually being made.

For a **Confirmed** finding, decide from its fix options:

- **Apply the targeted option without asking** when it is unambiguous — the options agree on one evident change, no genuine design choice among them — and its blast radius is minimal: confined to the files the review covered, no public API or behavior contract change beyond what the finding names, no new dependency. Default to auto here because at that size the fix is cheaper to apply than to discuss, and the review already did the judging.
- **Route to the ask batch** otherwise — genuinely different options with trade-offs, a thorough option worth weighing against the targeted one, intent the code can't settle, blast radius reaching beyond the reviewed files. A wrong guess there costs more than the question.

**One batched ask per run.** Collect every ask-routed finding and present them together in a single interaction — each with the finding, its diff or options, and your recommendation — not one interruption per finding. Apply the decisions, then continue.

## Applying Fixes

Run each fix through the loop in `./references/workflow/execution-loop.md` — read it before the first fix. This skill's bindings:

- **Source** — one finding with its chosen fix: a Confirmed finding's fix option, or the fix the user approved in the ask. The verify criterion is **the problem the finding names no longer reproduces**, re-checked against the finding's own evidence — a Confirmed finding's root cause and reproduction path, or, for an unverified one, the specific thing the finding called wrong. That criterion is one half of the tier: proving a fix's outcome also runs the per-unit checks the resolved domain's `verification.md` adds (`./references/workflow/execution-loop.md` § *Two verification tiers*) — for code, validating the comments this fix touched.
- **Record** — the chat report below; this skill writes no task-folder file and no status.
- **Blocked** — a fix that cannot pass its **immediate** outcome is restored from its pre-fix content state and reported `fix failed (reverted): <reason>`. A failed health boundary follows § *Integrated health boundary*: isolate from a green baseline control when one exists; retain the survivors as **Health uncertifiable** when the same command was already red at the baseline; restore the complete pre-run content baseline when the comparison is inconclusive. Findings are independent, so an isolated failure does not strand independent survivors.
    A failed **final-integrated** outcome uses the dependency-safe recovery in `./references/workflow/fix-findings-recovery.md` § *Dependency-safe recovery* instead. <!-- cold -->
- **Acceptance** — every selected finding lands in exactly one report bucket, each bucket entry re-read against the live tree before reporting.
- **Health boundaries** — no up-front health run and no per-batch health run. After all selected serial and batched fixes' immediate outcomes have settled and all retained fixes' final-integrated outcomes pass, run one full engineering-health boundary for the retained fixes. Every tree-changing recovery earns one fresh full boundary before any survivor is Fixed. The certifying re-review of the whole set remains a separate run.
    A red boundary follows the recovery procedure in `./references/workflow/fix-findings-recovery.md`. <!-- cold -->
- **Integration assertions** — none within the fix run; the certifying re-review is a separate review run over the changed code.

A fix is Fixed only when its final-integrated outcome and the current final-tree health boundary both
pass.

### Content baseline and immediate outcomes

After the selection gate and before any fix edits, capture an immutable **pre-run content baseline** of
the dirty shared tree. It preserves the bytes and presence of tracked, staged, unstaged, and untracked
content as applicable, including separately staged and unstaged versions, without changing the index,
staging, or commits. This is a content snapshot, not a clean-Git assumption or a Git operation: user
bytes that predate the run are never recovery material. There is no up-front health comparison.

**Attribution bounds every restoration.** No restore or rebuild in this skill removes content it cannot
attribute to the baseline or to a recorded change set — content that appeared after the baseline is
neither, so it is preserved and surfaced to the user, never removed to satisfy an equality or to return
the tree to a capture. A run that edits the tree is not the only thing touching it, and a snapshot
restored blindly reverts the user's work as readily as the run's own. This is the one home for that
rule; the restore steps here cite it rather than restating it, and so do those in
`./references/workflow/fix-findings-recovery.md`. <!-- cold -->

Process attempted fixes in the established order. Immediately before each serial fix — or before a
batch unit's eventual shared incorporation — capture its exact pre-fix content state, not merely the
declared edit surface. A serial immediate-outcome pass records its ordered, run-owned change set: the
content and presence delta from the state immediately before that fix. The change set is evidence and
recovery input only; it is never staging or commit state. If the immediate outcome fails, restore that
pre-fix content state within the attribution bound above, bucket the finding Fix failed, and continue. A
not-yet-attempted fix whose known dependency is the fix that just failed is **not attempted**: bucket it
Fix failed naming that prerequisite. Do not let a partial or failed attempt become part of a later
change set.

After every immediate outcome has settled, re-prove every retained finding's full outcome tier on the
final integrated shared tree. Earlier local proof is not enough for Fixed. Re-check all retained
outcomes again after each rebuild.
Resolve a failed final outcome through the dependency-safe recovery in `./references/workflow/fix-findings-recovery.md` § *Dependency-safe recovery*, using that outcome as the failure predicate, before running project health. <!-- cold -->

### Integrated health boundary

When retained fixes remain, run one complete engineering health boundary over their final integrated
tree (`./references/engineering/verification.md`). If it is green, that unchanged-tree result supplies
pre-presentation health evidence and the survivors can be reported Fixed.

If it is red, the comparison against the baseline, the three dispositions, and the recovery procedure
are `./references/workflow/fix-findings-recovery.md` § *Red boundary: comparison, disposition, recovery* — read it when the boundary is red. <!-- cold -->

### Execution strategy: every auto-path fix delegates

**The delegation surface is Confirmed auto-path fixes only.** A fix the gate routed to auto on a **Confirmed** verdict is the only kind an executor may apply. Ask-routed fixes stay here: the coordinator authored the diff the user approved, so nothing is left for an executor to decide, and drafting an ask-batch diff sits too close to judgment to hand off. **Withdrawn and Inconclusive findings are never edited at all** — by this session or by any executor; delegation changes nothing about that.

**Inside that surface, delegation is the standing posture, not a judgment call**: every Confirmed auto-path fix goes to an executor, whatever its size and wherever it sits in the processing order, and `./references/workflow/write-mode-posture.md` — read it before the first fix — owns that rule and the only three exceptions that keep a fix here. A fix framed in session has no packet on disk, so assemble one from what the review and the gate established — the finding verbatim, its root cause, the chosen option, that option's expected surface, the processing order and known dependencies — rather than keep the fix; a gap you can close by reading is closed, and only a gap that can be closed *solely by applying the fix* is an exception. Announce any fix that stays here as it happens, naming which exception applied, and note it in that finding's `Fixed` / `Fix failed` entry.

The executor-contract binding, the write-surface restatement, the announce-and-record duty, the batch
mechanics, and the failure fallbacks are `./references/workflow/fix-findings-recovery.md` § *Delegation mechanics* — read it before the first delegation. <!-- cold -->

**Judgment stays with the coordinator** under every posture: the auto-vs-ask gate, the one batched ask,
all final-integrated outcomes, the health boundary, recovery, and the report buckets.

## Output

Lists, never tables. Omit empty buckets.

- **Fixed** — every applied fix, per finding: the original text with severity, what changed (`file:line`), its final-integrated outcome evidence, and the current final-tree health boundary. Mark an entry that had no Confirmed verdict as fixed on the user's approval, so the report never lends a verified finding's authority to one that had none. A delegated fix's entry notes the delegation, the engine that ran it, and its batch where it ran in one; one applied by the coordinator instead notes which posture exception kept it here, or that it was ask-routed.
- **Health uncertifiable** — survivors retained after a red boundary whose failed command was already red at the immutable baseline: per finding, the original text with severity, what changed (`file:line`), its final-integrated outcome evidence, and the baseline-failing command nothing can certify against. Not Fixed — the certifying re-review **Next** points at is what resolves these.
- **Decided** — ask-routed findings that produced no fix: the user's decision and why nothing was applied — skipped, deferred, or the finding rejected. An ask-routed fix that was applied belongs in **Fixed**, not here.
- **Fix failed** — fixes that were reverted, and fixes never attempted because a dependency of theirs failed, each with the reason and what would unblock them: the named prerequisite for one skipped as a cascade; the reason the baseline comparison could not run, after collection-level rollback on an unestablished control; the unresolved-health reason after an unconverged recovery; or whether one fix, a dependency group, or an interaction group was implicated. A never-attempted entry says so rather than reporting `(reverted)`, which would assert an edit that never happened. A delegated one notes the delegation, its engine, and its batch here too; one applied by the coordinator notes its posture exception or its ask routing, as in **Fixed**.
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

- [ ] Findings sourced per **Source**; none produced by this run, none re-verdicted
- [ ] No Withdrawn or Inconclusive finding edited; every fix lacking a Confirmed verdict approved by the user against a shown diff
- [ ] Every ask-routed finding decided in one batched interaction
- [ ] External findings anchor-checked before fixing; nothing written back to a PR or findings file
- [ ] Immutable pre-run content baseline captured before any edit; every attempt has an exact pre-fix capture and an ordered run-owned change set or an exact restoration, and every batched entry records the incorporated content/presence delta from the immediately preceding shared state with its dependencies
- [ ] Every retained finding's full outcome tier re-proved on the final integrated tree; every Fixed entry has that evidence and a current final-tree health boundary
- [ ] One full health recipe ran on the happy path after all selected serial and batched fixes; a red command was compared with the baseline alone, a matching baseline failure retained its survivors as Health uncertifiable, an inconclusive comparison restored the pre-run baseline with no changed-code survivor, and a green control used dependency-safe scratch isolation before another full recipe
- [ ] Every failed fix or group was restored without changing pre-run bytes, index, staging, or commits; an unconverged health recovery restored the exact baseline and left no changed-code survivor
- [ ] Every selected finding in exactly one output bucket
- [ ] Batched fixes ran only over blast-radius-declared, pairwise-disjoint surfaces and came back through `./references/workflow/parallel-batch.md` § *Coordinator-side parallel batch*'s ordered gates, in this skill's processing order <!-- cold -->
- [ ] Every Confirmed auto-path fix delegated, any that stayed with the coordinator naming its posture exception; delegation confined to that surface — no ask-routed, Withdrawn, or Inconclusive finding sent to an executor — and every delegation announced and noted with its engine in its `Fixed` / `Fix failed` entry
- [ ] The gate, the batched ask, final-integrated outcome checks, health recovery, and the report buckets stayed with the coordinator
- [ ] Nothing staged, nothing committed, no Git state mutated (transient coordinator-managed worktrees excepted — a batch's and a serial `-x` fix's alike, created scratch, removed after merge)

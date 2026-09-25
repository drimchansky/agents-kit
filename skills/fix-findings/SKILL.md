---
name: fix-findings
description: Use when asked to fix code or documentation findings from a session review, PR comments, or a pasted or saved list. Applies eligible Confirmed fixes automatically; other actionable fixes require batched diff approval. Commits each concern batch through the commit skill; never pushes or replies to sources.
argument-hint: '[source]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Apply `./references/engineering/rules.md` to code fixes and `./references/documentation/rules.md` to documentation fixes. Apply both to a mixed fix.

Apply selected code and documentation findings and report the rest untouched. Consume a verify composite's root cause and ordered fix options without repeating its investigation.

Edit selected working-tree work products, and stage and commit each concern batch's fixes under § *Batch commits*. Make no other Git mutation, findings-report edit, source reply, thread resolution, push, or live-page write. Transient coordinator-managed executor worktrees are the exception allowed by `./references/workflow/parallel-batch.md` § *Coordinator-side parallel batch*. <!-- cold -->

## Source

Resolve findings in this order (`../triage-findings/SKILL.md` § *Sources*):

1. Use the explicit argument: PR number or URL, existing file, pasted text, or a session pointer. A named subset selects matching entries from the latest session findings.
2. Otherwise use the latest session findings. Select Confirmed and Unverified entries from a verify composite's **Batches**, read per `./references/workflow/verify-pipeline.md` § *Reading Batches downstream*; select all actionable entries from a plain code or documentation review or triage batch.
3. With no findings, name the accepted source forms and stop. Do not infer the current branch's PR.

Keep the source's concern batches and their order (`../triage-findings/SKILL.md` § *Batch*, or a verify composite's **Batches**). An unbatched source is one concern batch.

Accept code and documentation findings. Classify each chosen fix by the work products it changes, not its finding anchor; a mixed fix uses both domains. Source-comment wording needs documentation checks for the claim and engineering checks for the changed code file. Keep external-page fixes Untouched under the working-tree write limit. Do not generate findings during this run or assign new severities or verdicts. Preserve each finding's wording, severity, anchor, root cause, and fix options as supplied.

From `/review-docs`, take actionable Stale, Missing context, Misleading, Gaps, and Quality entries (`../review-docs/SKILL.md` § *Findings Output*). Its Accurate and Confirmed sections require no fix; Questions need an answer before an edit. These entries have no Confirmed fix verdict unless a separate verify source supplies one.

For PRs, use `../triage-findings/SKILL.md` § *Fetch*, including its incomplete-fetch reporting and unavailable-tool stop. Resolved threads and findings triaged outside **open** go to Untouched with their source bucket.

Check external PR, file, and pasted findings against the current work product. A mismatched location or quoted snippet goes to Untouched as `anchor moved`. A finding too vague for one specific change goes there as `not actionable`.

## The Gate: Auto vs Ask

Process concern batches in source order. Within a concern batch, process findings in dependency order, then severity order (critical, major, minor), or source order when severity is absent. A finding with a known prerequisite in a later concern batch joins that batch. Use that order for execution, executor packets, and merges (`./references/workflow/executor-contract.md` § *Bindings*). <!-- cold -->

Before execution, known dependencies are source- or user-declared dependencies and overlaps between chosen options' declared blast-radius surfaces. Recovery uses the recorded-change-set definition in `./references/workflow/fix-findings-recovery.md` § *Dependency-safe recovery*. Do not infer other cascade dependencies. <!-- cold -->

**Withdrawn and Inconclusive findings are never edited.** Put them in Untouched with their verdict. A fix requires a Confirmed verdict or the user's approval of its diff:

- **Auto:** a Confirmed finding with one unambiguous targeted change, confined to reviewed files, with no new dependency or public API or behavior change beyond the finding. Default to this option because the review already established the problem and the change is bounded.
- **Ask:** every other actionable finding, including unverified findings and Confirmed findings with design choices, meaningful option trade-offs, unsettled intent, or broader scope.

Route a consequential change in a document's claim, decision, or intended audience to Ask, even when its wording looks simple (`./AGENTS.md` § *Ask Before Assuming*).
Treat a file named only as a proposed remedy as outside the reviewed files for Auto. Route that fix to Ask.

**Batch ask-routed findings.** Ask once, before the first concern batch runs, covering every concern batch. Show each finding, concrete diffs and material trade-offs for its viable fixes, and your recommendation. Wait for the user's decisions before applying those edits. Approval of a claim without its diff is insufficient. A finding still unanswered when the run reports lists under Awaiting decision (§ *Output*).

Post-approval choices follow `./references/workflow/fix-findings-recovery.md` § *Approved decisions and changed evidence*.

## Applying Fixes

Use `./references/workflow/execution-loop.md` with these bindings:

- **Source:** one finding and its chosen fix option or approved diff. Its criterion is that the named problem no longer reproduces, checked against the finding's evidence. Use the supplied root cause and reproduction path when present. Run each applicable unit-outcome tier (`./references/workflow/execution-loop.md` § *Two verification tiers*). Code checks include touched comments and an available formatter; documentation checks include applicable claim checks and a whole-deliverable link sweep (`./references/documentation/verification.md` § *Unit outcome — every unit*).
- **Record:** the chat report in § *Output* and each concern batch's commit (§ *Batch commits*). Make no task bookkeeping or status edit. Edit a task-folder document only when it is a selected finding's work product.
- **Blocked:** restore an immediate failure's pre-fix state and report `fix failed (reverted): <reason>`. A pending impactful choice restores the same way and lists the finding Awaiting decision (§ *Content baseline and immediate outcomes*). Final-outcome failures use `./references/workflow/fix-findings-recovery.md` § *Dependency-safe recovery*. Independent findings may continue after recovery. <!-- cold -->
- **Acceptance:** re-read every selected finding against the live tree and place it in exactly one report bucket.
- **Health boundaries:** use § *Integrated health boundary* once per concern batch, after its serial and parallel fixes settle and before its commit. Red-boundary recovery follows `./references/workflow/fix-findings-recovery.md`. <!-- cold -->
- **Integration assertions:** none. Separate code and documentation reviews assess the changed surfaces.

### Content baseline and immediate outcomes

Before each concern batch's first fix edit, capture an immutable **concern-batch baseline** of the dirty shared tree. A later concern batch captures its baseline only after the preceding batch settles, including its deferred re-proofs and any commit. Preserve content and presence, including tracked and untracked files and separately staged and unstaged versions. Capture bytes without changing the index. Recovery, restoration, and rebuilds stay within one concern batch and never revert a landed commit.

**Restore only attributable content.** Every restoration or rebuild preserves the concern-batch baseline's user bytes and any content outside that baseline and the batch's recorded run-owned change sets. Surface unattributed changes to the user; do not remove them to force equality with a capture (`./references/workflow/fix-findings-recovery.md`). <!-- cold -->

Immediately before each serial fix or shared parallel-batch incorporation, capture the exact pre-fix content state, beyond its declared surface. Also capture the `worktree-merge.ts baseline` manifest required by executor intake. After an immediate-outcome pass, record the ordered content/presence delta against that pre-fix state, with known dependencies. These change sets are recovery evidence and define what § *Batch commits* stages.

On immediate failure, restore the pre-fix capture within the attribution bound and bucket the finding Fix failed. Skip unattempted fixes whose known prerequisite failed, naming that prerequisite. Leave no failed attempt in a later change set. An executor that returns a pending impactful choice restores the same way: its landed edits return to the pre-fix capture, and the finding lists Awaiting decision rather than Fix failed. The surfaced choice ends its auto eligibility: the finding becomes ask-routed and re-executes only after approval of the chosen option's concrete diff (§ *The Gate: Auto vs Ask*). Nothing partial stays in the tree.

After a concern batch's immediate outcomes settle, re-prove on its final integrated shared tree every retained finding except a deferred one, earlier concern batches' findings included. A finding is deferred when all three hold: it comes from an earlier concern batch; its outcome proof is a regression test; and no change set recorded after that proof intersects its own or comes from a finding linked to it by a known dependency in either direction (§ *The Gate: Auto vs Ask*). A fix that changed documentation or source-comment wording is never deferred, since its health boundary checks links but never claims. Run each re-proved finding's full outcome tier, regardless of who proved it earlier; a failing one implicates only this concern batch's change sets. A deferred finding takes the batch's boundary as its final-integrated outcome only when that boundary is green and its test command ran that regression test. Otherwise re-prove it in full after the boundary: after a green one, before § *Batch commits* stages the batch; after a red one, before its baseline comparison (`./references/workflow/fix-findings-recovery.md` § *Red boundary: comparison, disposition, recovery*). A failure there takes the recovery below, and a recovery that changes the tree earns a fresh boundary. After every rebuild, re-prove every finding retained so far. Resolve failures through `./references/workflow/fix-findings-recovery.md` § *Dependency-safe recovery*, using the failed tier as the predicate. <!-- cold -->

### Integrated health boundary

When a concern batch retains fixes, run one integrated boundary after its final outcome sweep. Run no up-front, per-finding, or per-parallel-batch health recipe. Use `./references/engineering/verification.md` § *Two verification tiers* for changed code. Use `./references/documentation/verification.md` § *Integrated health — declared boundaries* for changed documentation. Run both recipes for mixed work.

The concern-batch baseline is the engineering reference. The first concern batch's baseline has no in-session green result, so its boundary runs the whole relevant code surface. A later concern batch may reference the preceding green boundary only when its baseline holds exactly the bytes that boundary evaluated. Its boundary then covers the delta's closure; otherwise it runs the whole relevant code surface. Sweep every retained local documentation deliverable and in-scope companion document for links and cross-references.

A finding is **Fixed** only when its final-integrated outcome passes and every applicable check in its concern batch's boundary is green on that batch's unchanged final tree. Report the commit outcome under **Commits** (§ *Output*); landing is not a Fixed condition.

On red, use `./references/workflow/fix-findings-recovery.md` § *Red boundary: comparison, disposition, recovery*. A matching baseline failure retains Health uncertifiable survivors; an inconclusive comparison restores the concern-batch baseline; a green control permits isolation. Recovery that changes the tree requires a fresh boundary. <!-- cold -->

### Batch commits

Your typed invocation is the explicit commit request `./references/engineering/rules.md` § *Code & Git discipline* requires, for every concern batch this run fixes. Model invocation is closed on both hosts (`./references/workflow/skill-conventions.md` § *The invocation gate*). An explicit no-commit instruction turns batch commits off, and so does a shared tree outside any Git checkout. A matching baseline failure turns batch commits off from its concern batch to the end of the run. With batch commits off, fixes stay unstaged and the report says so.

With batch commits on, read the index before the first fix edit. Staged content stops the run before any edit, naming the staged paths, because `commit` commits the whole index.

Commit a concern batch only after its health boundary is green on unchanged bytes and every deferred finding the boundary did not certify has re-proved. Stage only the batch's recorded run-owned change sets: explicit paths, or hunks where a path also holds user bytes. Stage nothing outside the shared checkout, and report such changes as uncommitted. Read the complete staged diff against the verified bytes. When unstaged or untracked user bytes remain, re-prove every finding retained so far and the documentation sweep in a coordinator-managed scratch copy built from the index. A failure there blocks the commit. Unrelated staged content or ambiguous overlap with user content blocks the commit; never absorb, stash, or reset user content.

Then run `../commit/SKILL.md` in ordinary mode over that staged set, never with `--amend`. Pass the batch's concern and the problems its fixes resolve as its argument. Name there the manifest path and id the batch's green boundary recorded, so its gate can reuse that boundary. `commit` owns the message, guard scan, verification gate, signing, and report. A concern batch with nothing to stage runs nothing, and the run continues, even when its retained fixes lie outside the checkout.

Ask a choice raised during a concern batch before that batch commits. A finding still unanswered then lists Awaiting decision. Its held edits are already restored, so its batch commits without it.

Read `commit`'s report for the landed SHA, message, and files. If a hook changed a work product, re-prove the batch's outcomes and health before the next concern batch.

With batch commits on, a concern batch stops the run when its stageable retained fixes do not commit, or when its post-hook re-proof fails. Causes include blocked staging, a declined guard hit, a failed `commit` gate, a failed staged re-proof, and a signing hand-over. Its uncommitted fixes stay in the tree, and any staged set stays staged. Later concern batches are not attempted. A failed post-hook re-proof buckets the affected findings Retained, failing; failed health affects the whole batch.

### Execution strategy: every auto-path fix delegates

Delegate every Confirmed auto-path fix and no other finding. Keep ask drafting and ask-approved edits with the coordinator. Apply `./references/workflow/write-mode-posture.md` before the first fix; announce and record any inline exception it permits.

For each delegation, supply the finding, root cause, chosen option, expected surface, order, and known dependencies. Complete the packet before launch; a gap resolvable by reading does not justify inline execution.

Use `./references/workflow/fix-findings-recovery.md` § *Delegation mechanics* for launch, intake, parallel batching, and fallback. <!-- cold -->

The coordinator retains the auto/ask decision, batched ask, immediate-evidence intake (`./references/workflow/executor-contract.md` § *Write-mode routing*), final-integrated checks, health, recovery, batch commits, and report buckets.

## Output

Use lists; omit empty buckets. Preserve the finding's original text and severity in each entry.

- **Commits:** one line per concern batch in processing order. Give the landed SHA and message title, `<sha> landed; post-hook re-proof failed: <check>`, `none — nothing to stage`, or why its commit did not land and what stays staged. Name uncommitted changes outside the checkout. Say when batch commits were off, naming the concern batch and baseline-failing check that turned them off, or that no checkout exists.
- **Fixed:** changed `file:line`; concern batch; immediate proof source (`executor`, or `coordinator` with its re-run reason); final-integrated evidence (its post-batch re-proof, or the green boundary that ran its regression test); current engineering health per `./references/engineering/verification.md` § *What a boundary records* and documentation sweep evidence where applicable. Identify fixes made on user approval. Record delegation, engine, and parallel batch, or the coordinator's posture exception or ask routing.
- **Health uncertifiable:** surviving changes and the same immediate and final outcome evidence, plus the baseline-failing check and its resolved targets. Apply target exclusions from `./references/workflow/execution-recovery.md` § *Evidence lifecycle*. State that no boundary certifies the tree.
- **Retained, failing:** never-reverted fixes whose current outcome or health evidence fails. Name the commit SHA, or `uncommitted`, the failed check, and what would unblock them.
- **Decided:** ask-routed findings without an applied fix, with the user's decision and reason: skipped, deferred, or rejected.
- **Awaiting decision:** findings whose impactful choice has no answer yet, with the offered options, the recommendation, and the edits held for the answer. Their fixes are not applied; edits landed before the choice was returned were restored to the pre-fix capture (§ *Content baseline and immediate outcomes*).
- **Fix failed:** reverted fixes and unattempted dependents, with the reason and what would unblock them. Distinguish one fix, a dependency group, and an interaction group. Name an unestablished control or unconverged health recovery when applicable. Say `not attempted` for skipped dependents, not `reverted`. Include execution and immediate-evidence details as for Fixed.
- **Untouched:** excluded findings, non-open triage buckets, barred verdicts, moved anchors, and non-actionable complaints, each with its reason. After a stop, list later concern batches' findings as `not attempted`, naming the concern batch that stopped the run.

**Next:** name the landed commits; the fixes are unreviewed. `/review-code` or `/review-code-triage-verify` reviews the committed range, and `/review-docs` reviews changed documentation, before merge or publication. For uncommitted fixes, the user resolves what stopped them, stages any still unstaged, and runs `/commit`. Pushes, source replies, thread resolution, and live-page updates remain separate user actions.

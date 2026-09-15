---
name: fix-findings
description: Use when asked to fix, apply, or address a set of findings from a session review, PR comments, or a pasted or saved list. Applies eligible Confirmed fixes automatically; other actionable fixes require batched diff approval. Edits code only, with no staging, commits, or source replies.
argument-hint: '[source]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Apply selected code findings and report the rest untouched. Consume a verify composite's root cause and ordered fix options without repeating its investigation.

Edit working-tree code only: no staging, commits, other Git mutations, or writes to the findings' source, including replies, thread resolution, and pushes. Transient coordinator-managed executor worktrees are the exception allowed by `./references/workflow/parallel-batch.md` § *Coordinator-side parallel batch*. <!-- cold -->

## Source

Resolve findings in this order (`../triage-findings/SKILL.md` § *Sources*):

1. Use the explicit argument: PR number or URL, existing file, pasted text, or a session pointer. A named subset selects matching entries from the latest session findings.
2. Otherwise use the latest session findings. Select Confirmed and Unverified entries from a verify composite; select all entries from a plain review or triage batch.
3. With no findings, name the accepted source forms and stop. Do not infer the current branch's PR.

Accept code findings only; return documentation findings to a doc review. Do not generate findings during this run or assign new severities or verdicts. Preserve each finding's wording, severity, anchor, root cause, and fix options as supplied.

For PRs, use `../triage-findings/SKILL.md` § *Fetch*, including its incomplete-fetch reporting and unavailable-tool stop. Resolved threads and findings triaged outside **open** go to Untouched with their source bucket.

Check external PR, file, and pasted findings against the current code. A mismatched location or quoted snippet goes to Untouched as `anchor moved`. A finding too vague for one specific change goes there as `not actionable`.

## The Gate: Auto vs Ask

Process findings in dependency order, then severity order (critical, major, minor), or source order when severity is absent. Use that order for execution, executor packets, and merges (`./references/workflow/executor-contract.md` § *Bindings*). <!-- cold -->

Before execution, known dependencies are source- or user-declared dependencies and overlaps between chosen options' declared blast-radius surfaces. Recovery uses the recorded-change-set definition in `./references/workflow/fix-findings-recovery.md` § *Dependency-safe recovery*. Do not infer other cascade dependencies. <!-- cold -->

**Withdrawn and Inconclusive findings are never edited.** Put them in Untouched with their verdict. A fix requires a Confirmed verdict or the user's approval of its diff:

- **Auto:** a Confirmed finding with one unambiguous targeted change, confined to reviewed files, with no new dependency or public API or behavior change beyond the finding. Default to this option because the review already established the problem and the change is bounded.
- **Ask:** every other actionable finding, including unverified findings and Confirmed findings with design choices, meaningful option trade-offs, unsettled intent, or broader scope.

**Batch ask-routed findings.** Show each finding, concrete diffs and material trade-offs for its viable fixes, and your recommendation. Wait for the user's decisions before applying those edits. Approval of a claim without its diff is insufficient. A finding still unanswered when the run reports lists under Awaiting decision (§ *Output*).

Post-approval choices follow `./references/workflow/fix-findings-recovery.md` § *Approved decisions and changed evidence*.

## Applying Fixes

Use `./references/workflow/execution-loop.md` with these bindings:

- **Source:** one finding and its chosen fix option or approved diff. Its criterion is that the named problem no longer reproduces, checked against the finding's evidence. Use the supplied root cause and reproduction path when present. Run the full unit-outcome tier, including engineering's touched-comment and available formatter checks (`./references/workflow/execution-loop.md` § *Two verification tiers*).
- **Record:** the chat report in § *Output*. Write no task-folder file or status.
- **Blocked:** restore an immediate failure's pre-fix state and report `fix failed (reverted): <reason>`. A pending impactful choice restores the same way and lists the finding Awaiting decision (§ *Content baseline and immediate outcomes*). Final-outcome failures use `./references/workflow/fix-findings-recovery.md` § *Dependency-safe recovery*. Independent findings may continue after recovery. <!-- cold -->
- **Acceptance:** re-read every selected finding against the live tree and place it in exactly one report bucket.
- **Health boundaries:** use § *Integrated health boundary* after all serial and batched fixes settle. Red-boundary recovery follows `./references/workflow/fix-findings-recovery.md`. <!-- cold -->
- **Integration assertions:** none. A separate re-review certifies the changed code.

### Content baseline and immediate outcomes

After selection and before any fix edit, capture an immutable **pre-run content baseline** of the dirty shared tree. Preserve content and presence, including tracked and untracked files and separately staged and unstaged versions. Capture bytes without changing the index.

**Restore only attributable content.** Every restoration or rebuild preserves pre-run user bytes and content outside the baseline and recorded run-owned change sets. Surface unattributed changes to the user; do not remove them to force equality with a capture (`./references/workflow/fix-findings-recovery.md`). <!-- cold -->

Immediately before each serial fix or shared batch incorporation, capture the exact pre-fix content state, beyond its declared surface. Also capture the `worktree-merge.ts baseline` manifest required by executor intake. After an immediate-outcome pass, record the ordered content/presence delta against that pre-fix state, with known dependencies. These change sets are recovery evidence.

On immediate failure, restore the pre-fix capture within the attribution bound and bucket the finding Fix failed. Skip unattempted fixes whose known prerequisite failed, naming that prerequisite. Leave no failed attempt in a later change set. An executor that returns a pending impactful choice restores the same way: its landed edits return to the pre-fix capture, and the finding lists Awaiting decision rather than Fix failed. The surfaced choice ends its auto eligibility: the finding joins the ask-routed batch and re-executes only after approval of the chosen option's concrete diff (§ *The Gate: Auto vs Ask*). Nothing partial stays in the tree.

After all immediate outcomes settle, re-prove every retained finding's full outcome tier on the final integrated shared tree, regardless of who proved it earlier. Repeat this sweep after every rebuild. Resolve failures before project health through `./references/workflow/fix-findings-recovery.md` § *Dependency-safe recovery*, using the failed tier as the predicate. <!-- cold -->

### Integrated health boundary

When fixes remain, run one engineering-health boundary after their final outcome sweep. Run no up-front, per-finding, or per-batch health recipe. Use `./references/engineering/verification.md` § *Two verification tiers*: the immutable pre-run baseline is the reference at every boundary. It has no in-session green result, so run the whole relevant surface.

A finding is **Fixed** only when its final-integrated outcome passes and the unchanged final tree has a green health boundary.

On red, use `./references/workflow/fix-findings-recovery.md` § *Red boundary: comparison, disposition, recovery*. A matching baseline failure retains Health uncertifiable survivors; an inconclusive comparison restores the baseline; a green control permits isolation. Recovery that changes the tree requires a fresh boundary. <!-- cold -->

### Execution strategy: every auto-path fix delegates

Delegate every Confirmed auto-path fix and no other finding. Keep ask drafting and ask-approved edits with the coordinator. Apply `./references/workflow/write-mode-posture.md` before the first fix; announce and record any inline exception it permits.

For each delegation, supply the finding, root cause, chosen option, expected surface, order, and known dependencies. Complete the packet before launch; a gap resolvable by reading does not justify inline execution.

Use `./references/workflow/fix-findings-recovery.md` § *Delegation mechanics* for launch, intake, batching, and fallback. <!-- cold -->

The coordinator retains the auto/ask decision, batched ask, immediate-evidence intake (`./references/workflow/executor-contract.md` § *Write-mode routing*), final-integrated checks, health, recovery, and report buckets.

## Output

Use lists; omit empty buckets. Preserve the finding's original text and severity in each entry.

- **Fixed:** changed `file:line`; immediate proof source (`executor`, or `coordinator` with its re-run reason); final-integrated evidence; current health per `./references/engineering/verification.md` § *What a boundary records*. Identify fixes made on user approval. Record delegation, engine, and batch, or the coordinator's posture exception or ask routing.
- **Health uncertifiable:** surviving changes and the same immediate and final outcome evidence, plus the baseline-failing command and its resolved targets. Apply target exclusions from `./references/workflow/execution-recovery.md` § *Evidence lifecycle*. State that no boundary certifies the tree.
- **Decided:** ask-routed findings without an applied fix, with the user's decision and reason: skipped, deferred, or rejected.
- **Awaiting decision:** findings whose impactful choice has no answer yet, with the offered options, the recommendation, and the edits held for the answer. Their fixes are not applied; edits landed before the choice was returned were restored to the pre-fix capture (§ *Content baseline and immediate outcomes*).
- **Fix failed:** reverted fixes and unattempted dependents, with the reason and what would unblock them. Distinguish one fix, a dependency group, and an interaction group. Name an unestablished control or unconverged health recovery when applicable. Say `not attempted` for skipped dependents, not `reverted`. Include execution and immediate-evidence details as for Fixed.
- **Untouched:** excluded findings, non-open triage buckets, barred verdicts, moved anchors, and non-actionable complaints, each with its reason.

**Next:** tell the user the fixes remain unstaged and unreviewed. They can stage them and run `/commit`; `/review-code` or `/review-code-triage-verify` certifies the changed code before merge. Source replies, thread resolution, and pushes remain separate user actions.

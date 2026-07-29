---
name: fix-findings
description: Use when asked to fix, apply, or address the findings a verified review produced — takes the most recent *-triage-verify output in the session, fixes Confirmed findings (automatically when the targeted fix is clear and low-blast-radius, otherwise through one batched ask), and reports everything else untouched. Edits code only; never stages, never commits.
argument-hint: '[optional: subset of findings to fix — defaults to all Confirmed]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

The write-mode follow-up to the read-only verify composites: take a set of verdict-annotated findings, fix the **Confirmed** ones, and report the rest untouched. Each Confirmed finding arrives with `verify-issue`'s root cause and fix options (ordered targeted → thorough, each with blast radius) — this skill consumes that judgment; it doesn't re-litigate it.

**CRITICAL**: The fix surface is **Confirmed findings only**. Withdrawn, Inconclusive, and Unverified findings are never edited — a verdict that didn't confirm a root cause gives a fix nothing verified to fix. This skill edits working-tree code and nothing else: never stages, never commits, never otherwise mutates Git state — staging fix results belongs to `review-commit-fix-loop`, the composite that owns that departure.

## Source

Resolve the findings to fix, in this order:

1. **Explicit argument wins.** A named subset ("the two majors", specific `file:line`s) selects those findings from the most recent verified review in the session.
2. **No argument:** the most recent `*-triage-verify` output in this session — `review-commit-triage-verify`, `review-pr-triage-verify`, or `triage-findings-verify` — with everything Confirmed selected.
3. **No verified review in the session** → say so, point at those composites (a plain review's findings carry no verdicts — verification is what makes them fixable sight-unseen), and stop.

Take each finding as the review left it: severity, `file:line`, root cause, fix options. Findings triage landed outside **open** (addressed / verify buckets) are already handled — report them under Untouched with their bucket.

## The Gate: Auto vs Ask

For each Confirmed finding, in severity order (critical → major → minor), decide from its fix options:

- **Apply the targeted option without asking** when it is unambiguous — the options agree on one evident change, no genuine design choice among them — and its blast radius is minimal: confined to the files the review covered, no public API or behavior contract change beyond what the finding names, no new dependency. Default to auto here because at that size the fix is cheaper to apply than to discuss, and the review already did the judging.
- **Route to the ask batch** otherwise — genuinely different options with trade-offs, a thorough option worth weighing against the targeted one, intent the code can't settle, blast radius reaching beyond the reviewed files. A wrong guess there costs more than the question.

**One batched ask per run.** Collect every ask-routed finding and present them together in a single interaction — each with the finding, its options, and your recommendation — not one interruption per finding. Apply the decisions, then continue.

## Applying Fixes

Run each fix through the loop in `./references/workflow/execution-loop.md` — read it before the first fix. This skill's bindings:

- **Source** — one Confirmed finding with its chosen fix option; the verify criterion is **the finding's root cause no longer reproduces**, re-checked against the finding's own evidence (trace the same path, re-run the same check that confirmed it).
- **Record** — the chat report below; this skill writes no task-folder file and no status.
- **Blocked** — a fix that can't pass its gates this session is **reverted in full** (restore the pre-fix state), reported as `fix failed (reverted): <reason>`, and the run continues with the next finding. This is a deliberate departure from strict Stop-the-Line — findings are independent units, and one stubborn fix shouldn't strand the rest — but the tree-health half of the rule holds absolutely: never continue with a failing fix left in the tree.
- **Acceptance** — every selected finding lands in exactly one report bucket, each bucket entry re-read against the live tree before reporting.
- **Integration gates** — none within the run beyond per-fix health verify: the certifying re-review of the whole set belongs to the composite that drives this skill, or to the manual re-run **Next** points at.

Both verify gates apply per fix: step verify (the criterion above) and health verify (typecheck, linter, tests on the changed area — `./references/engineering/verification.md`). A fix is reported Fixed only with both green.

## Output

Lists, never tables. Omit empty buckets.

- **Fixed** — per finding: the original text with severity, what changed (`file:line`), and how the root cause's absence was verified.
- **Decided** — ask-routed findings: the user's decision and what was applied (or that it was skipped).
- **Fix failed** — reverted fixes with the reason and what would unblock them.
- **Untouched** — everything not Confirmed (with its verdict or triage bucket as the reason), plus any Confirmed finding the user's subset excluded.

**Next:** the fixes are unreviewed and unstaged — re-run the producing composite (e.g. `/review-commit-triage-verify` after staging) to certify them, or let `review-commit-fix-loop` drive the whole cycle.

## Don't Rationalize

- "The probe confirmed it, so the fix must be right" — The probe confirmed the *problem*. The fix's verify is the root cause no longer reproducing, checked fresh.
- "This Inconclusive one looks easy, I'll fix it while I'm here" — The verdict is the contract. Unverified root cause, no fix — ask for a verify pass instead.
- "The user will obviously pick the targeted option, I'll skip the ask" — The gate routed it because judgment was needed. Obvious-to-you is the thing being checked.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Findings sourced from a `*-triage-verify` output (or an explicit subset of one) — none invented, none re-verdicted
- [ ] Only Confirmed findings edited; every ask-routed finding decided in one batched interaction
- [ ] Every applied fix passed both verify gates; every failed fix reverted in full and reported
- [ ] Every selected finding in exactly one output bucket
- [ ] Nothing staged, nothing committed, no Git state mutated

---
name: verify-issue
description: Use when asked to verify, confirm, check, validate, or investigate a reported bug, issue, or problem.
argument-hint: '[issue description]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line verbatim to the user as a visible confirmation, **before** any other text or tool calls in this skill, on its own line:

    ✅ Core rules applied (./AGENTS.md)

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill guides verification of reported issues. Before fixing anything, confirm the problem actually exists, understand its root cause, and assess whether it's a real bug or a misunderstanding.

The user describes an issue — a bug report, error message, unexpected behavior, or something that "seems wrong." Your job is to determine whether it's a genuine problem and provide evidence either way.

**CRITICAL**: Do not fix the issue. Verify it first. The goal is a clear verdict with evidence, then — if confirmed — discovery of fix options. The user decides which fix to pursue.

## References

Before working, read any applicable checklists from `references/engineering/`. Skip ones that don't apply.

## Multiple Findings

When the input is a list of findings (e.g. from a code review), treat each as a separate verification target. Without explicit selection, verify all findings in severity order (critical → major → minor); when the user specifies a subset, verify only those. Present results as one verdict per finding.

## 1. Understand the Claim

Before touching code, extract what's actually being claimed:

- **What is the expected behavior?** — What should happen according to the reporter?
- **What is the observed behavior?** — What actually happens?
- **Where does it happen?** — Specific file, component, endpoint, or flow?
- **When does it happen?** — Always, intermittently, under specific conditions?

If the report is vague, ask for clarification before investigating. A vague claim leads to a vague investigation.

## 2. Investigate

- Read the target code and trace the data flow with the reported inputs
- Check recent changes with `git log` — a recent change may have introduced the issue
- Read existing tests — do they cover this scenario? Do they pass or fail?

Use the appropriate strategy:

- **Logic bugs** — Walk through with reported inputs; check edge cases (null, empty, zero, boundaries)
- **Type errors** — Run `tsc --noEmit`; verify type definitions match runtime behavior
- **Runtime errors** — Search for the error message in the codebase; trace the triggering conditions
- **Behavioral issues** — Check if the behavior is intentional (comments, commit messages, feature flags)

## 3. Deliver Verdict

Present a clear conclusion with supporting evidence.

### If the issue is confirmed

- **Status** — Confirmed
- **Root cause** — The specific code, condition, or logic error that causes the problem. Point to exact file and line.
- **Reproduction** — The path through the code that triggers the issue
- **Severity** — How bad is it? Who is affected? Is there a workaround?
- **Scope** — Is this an isolated case, or does the same pattern exist elsewhere?
- **Fix options** — Enumerate concrete approaches to resolve the issue (see below)

### If the issue is not an issue

- **Status** — Not an issue
- **Evidence** — Why the reported behavior is actually correct. Point to the code, spec, or test that confirms it.
- **Misunderstanding** — What the reporter likely expected vs. what the system is designed to do
- **Suggestion** — If the confusion is understandable, note whether the code could be clearer even though it's correct

### If inconclusive

- **Status** — Inconclusive
- **What was checked** — List the investigation steps taken
- **What's missing** — What additional information, access, or reproduction steps would resolve it
- **Best guess** — Your current assessment with stated uncertainty

## 4. Discover Fix Options (Confirmed Issues Only)

After confirming an issue, identify concrete ways to fix it. Present options — don't pick one.

For each option:

- **Approach** — What changes, where
- **Tradeoffs** — What it improves, what it risks or complicates
- **Blast radius** — Which files, consumers, or flows are affected by the change

Order options from most targeted (smallest change that fixes the issue) to most thorough (addresses root cause and related patterns). If a fix would also resolve scope issues found in other locations, note that.

Do not implement any fix. Present the options and let the user choose.

## Don't Rationalize

- "That's definitely a bug" — Show the code path. Intuition isn't evidence.
- "That should work fine" — Prove it. Trace the inputs through the code.
- "I'll just fix it while I'm looking" — Verify first. Fixing unverified issues creates new bugs and skips root cause analysis.
- "The reporter probably just misconfigured it" — Don't dismiss without evidence. Check.
- "I've seen this before" — Past experience is a starting point, not a conclusion. Verify in this codebase.

## Verification

- [ ] Verdict supported by evidence (code paths, test results), not intuition
- [ ] Root cause points to specific file and line (if confirmed)
- [ ] Scope assessed — checked if the same pattern exists elsewhere
- [ ] Fix options presented with tradeoffs (if confirmed), ordered from targeted to thorough
- [ ] No fix was attempted — verification and discovery only
- [ ] Missing information stated explicitly (if inconclusive)

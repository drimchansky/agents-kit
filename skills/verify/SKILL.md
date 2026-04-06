---
name: verify
description: Verify a described issue — reproduce it, check if it's real, identify root cause, and assess severity. Use when asked to verify, confirm, check, validate, or investigate a reported bug, issue, or problem.
---

This skill guides verification of reported issues. Before fixing anything, confirm the problem actually exists, understand its root cause, and assess whether it's a real bug or a misunderstanding.

The user describes an issue — a bug report, error message, unexpected behavior, or something that "seems wrong." Your job is to determine whether it's a genuine problem and provide evidence either way.

**CRITICAL**: Do not fix the issue. Verify it. The goal is a clear verdict with evidence, not a patch.

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

## 4. Deliver Verdict

Present a clear conclusion with supporting evidence.

### If the issue is confirmed

- **Status** — Confirmed
- **Root cause** — The specific code, condition, or logic error that causes the problem. Point to exact file and line.
- **Reproduction** — The path through the code that triggers the issue
- **Severity** — How bad is it? Who is affected? Is there a workaround?
- **Scope** — Is this an isolated case, or does the same pattern exist elsewhere?

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
- [ ] No fix was attempted — verification only
- [ ] Missing information stated explicitly (if inconclusive)

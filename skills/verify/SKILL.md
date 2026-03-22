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

## Common Pitfalls

- **Fixing before verifying** — Don't write a fix. Verify first. Fixing an issue that isn't real wastes effort and can introduce new bugs.
- **Confirming without evidence** — "Yeah, that looks like a bug" is not verification. Trace the code, show the path, point to the line.
- **Dismissing without evidence** — "That should work fine" is not verification either. Prove it works.
- **Tunnel vision** — Don't only look where the reporter points. The symptom may be in one place, but the cause in another.
- **Ignoring context** — A behavior that looks wrong in isolation may be correct given business rules, backwards compatibility, or intentional trade-offs.

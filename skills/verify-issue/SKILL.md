---
name: verify-issue
description: Use when asked to verify, confirm, check, validate, or investigate a reported bug, issue, or problem.
argument-hint: '[issue description]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Verify reported behavior and give an evidence-backed verdict. Do not fix anything; confirmed issues receive options for the user to choose.

## Multiple Findings

Verify every supplied finding separately, Critical → Major → Minor, unless the user selected a subset. Return one verdict per finding.

## 1. Understand the Claim

Extract expected behavior, observed behavior, location, and triggering conditions/frequency. Clarify vague claims before investigation.

## 2. Investigate

Read target code and trace reported inputs through its data flow. Inspect recent Git history and existing scenario tests.

- **Logic bugs:** trace boundary inputs, including null, empty, and zero where relevant.
- **Type errors:** run `tsc --noEmit` and compare types with runtime behavior.
- **Runtime errors:** locate the error and triggering conditions.
- **Behavioral issues:** establish intent from comments, commits, or feature flags.

Verify in this codebase; neither intuition, prior experience, nor presumed misconfiguration establishes a verdict.

## 3. Deliver Verdict

Support each conclusion with the traced path, code, specification, or test.

### If the issue is confirmed

Report **Confirmed**, root cause at exact file:line, reproduction path, severity/affected users/workaround, scope of matching patterns elsewhere, and fix options.

### If the issue is not an issue

Report **Not an issue**, evidence for correct behavior, expected versus intended behavior, and any clarity suggestion justified by the confusion.

### If inconclusive

Report **Inconclusive**, investigation performed, missing information/access/reproduction, and current assessment with explicit uncertainty.

## 4. Discover Fix Options (Confirmed Issues Only)

Present concrete options from targeted to thorough. For each, name approach and locations, tradeoffs/risks, and affected files/consumers/flows. Note whether it also addresses matching problems elsewhere. Leave selection and implementation to the user's next instruction.

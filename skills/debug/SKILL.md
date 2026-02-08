---
name: debug
description: Systematically investigate and fix bugs — reproduce, isolate, diagnose, and verify the fix
disable-model-invocation: true
---

# Debug

Investigate a reported bug or unexpected behavior using a systematic approach. Don't guess at the fix — understand the cause first, then verify the fix addresses it.

If the bug report is vague, ask for reproduction steps, expected vs. actual behavior, and environment details before investigating.

## 1. Reproduce

Before investigating, confirm the bug exists and is observable:

- Follow the exact steps described in the report
- Verify the expected behavior vs. actual behavior
- Note the environment: browser, OS, Node version, relevant feature flags
- If the bug can't be reproduced, say so — don't fix a phantom problem

A bug you can't reproduce is a bug you can't verify as fixed.

## 2. Isolate

Narrow the scope from "something is wrong" to "this specific thing is wrong":

- **Trace the data flow** — Follow the input from entry point to where the output goes wrong
- **Check the boundaries** — Is the bug in your code, a dependency, or an API contract mismatch?
- **Use bisection** — When did it last work? What changed since then? (`git log`, `git bisect`)
- **Simplify the reproduction** — Remove unrelated variables until you have the minimal case
- **Read the error carefully** — Stack traces, error messages, and browser console output often point directly to the cause

### Common Root Causes

- State not being reset or being mutated unexpectedly
- Race conditions between async operations
- Missing null/undefined checks on optional data
- Stale closures capturing old values
- Incorrect dependency arrays in hooks or effects
- API contract mismatches (wrong shape, wrong types, changed endpoint)
- Off-by-one errors in loops or pagination
- CSS specificity or stacking context issues causing visual bugs

## 3. Diagnose

Once isolated, confirm the root cause — not just the symptom:

- Explain _why_ the bug happens, not just _where_ the code fails
- Distinguish the root cause from downstream effects — fix the cause, not the symptoms
- Check if the same root cause affects other code paths
- Consider whether this is a regression (something broke) or a latent bug (never worked correctly)

## 4. Fix

Apply the smallest change that addresses the root cause:

- Fix the root cause, not the symptom — a workaround now becomes tech debt later
- Keep the fix focused — don't bundle refactoring or feature work into a bug fix
- If the fix touches shared code, verify callers still behave correctly
- Add a test that fails before the fix and passes after — this prevents regressions

## 5. Verify

Confirm the fix is complete and doesn't introduce new problems:

- [ ] The original reproduction steps now produce the expected behavior
- [ ] A regression test has been added covering this specific case
- [ ] Related edge cases have been checked (empty state, boundary values, concurrent access)
- [ ] No unintended side effects on surrounding functionality
- [ ] The fix makes sense to someone reading it without bug report context

## Output Structure

Adapt depth to the bug's complexity:

- **Symptoms** — What was observed and how it differs from expected behavior
- **Root Cause** — Why the bug occurs, traced to the specific code path
- **Fix** — What was changed and why this addresses the root cause
- **Verification** — How the fix was validated; tests added
- **Related Risks** — Other code paths that may be similarly affected

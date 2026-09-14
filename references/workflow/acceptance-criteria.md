# Acceptance Criteria

Quality bar for the goals in `goals.md`, each a `G<n>` bullet (`- G1 — <outcome>`). Fix a goal that fails a check below, or mark it `_(unresolved: <note>)_`, before `review-task` or `implement-task` runs.

## Each goal is

- [ ] **Testable**: verifiable by a command, a flow, an inspected state, or the best available proxy for a one-shot outcome; not "feels right"
- [ ] **Specific**: names a concrete artifact, behavior, or yardstick; no hedge words ("works", "robust", "fast enough")
- [ ] **Outcome-oriented**: user- or caller-visible behavior, not implementation steps
- [ ] **Singular**: one observable claim per bullet
- [ ] **Bounded**: the reader can tell what is in and out without guessing
- [ ] **Stated as behavior**: "user can X" beats "X is implemented"; "GET /foo returns 200 with `{shape}`" beats "the endpoint exists"

## Verifying outcomes that can't be re-run

A one-shot or irreversible outcome (an event held, a lease signed) is verified against its best available proxy: a confirmation, a receipt, the observed end state, or a post-hoc retro. Testable requires an observable yardstick, not a repeatable check. The code counterpart is `../engineering/acceptance-gate.md`.

## Externally-verified goals — the `(external)` marker

A goal confirmed only outside the agent's session and after implementation, a human sign-off or a live state the agent cannot drive, carries `(external)` right after its ID:

```markdown
- G5 (external) — Changes are deployed and verified live in production
- G6 (external) — Client confirms the new checkout flow works
```

- It still names a concrete outcome and yardstick, verified against the proxy the user reports. `(external)` marks who verifies and when, not whether the goal is testable.
- At the acceptance gate an `(external)` goal not confirmable in-session is tagged `pending external`, and the task parks at `in-review` until a later run confirms it (`./task-lifecycle.md`).
- No marker means agent-verifiable.

## Anti-patterns

- "The CSV export works" → "User can export the current filter as CSV; the file's row count matches the on-screen count"
- "Performance is acceptable" → "p95 export latency under 2s for the largest tenant in staging"
- "Handles errors gracefully" → "On API failure, the UI shows the server error message and the export button re-enables"
- "Auth is implemented and tokens are validated" → split into "Login flow returns a JWT" + "Requests with an expired JWT receive 401"
- "Add a `formatCsv()` helper" → a plan step, not a goal; restate as the outcome it delivers

## Common Mistakes

- "No errors in the console" names an absence, not the behavior that proves the feature
- "The unit test passes" describes the test, and holds as soon as the test exists
- A compound bullet hides goals that coverage analysis cannot tag

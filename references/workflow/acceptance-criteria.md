# Acceptance Criteria

Quality bar for the goals in `goals.md`, each a `G<n>` bullet (`- G1 — <outcome>`). Fix a goal that fails a check below, or mark it `_(unresolved: <note>)_`, before `review-task` or `implement-task` runs.

## Each goal is

- [ ] **Testable**: verifiable by a command, a flow, an inspected state, or the best available proxy for a one-shot outcome; not "feels right"
- [ ] **Specific**: names a concrete artifact, behavior, or yardstick; no hedge words ("works", "robust", "fast enough")
- [ ] **Outcome-oriented**: lead with the benefit or observable behavior for a user, caller, or operator; internal work may name an operational outcome without inventing an end-user benefit
- [ ] **Singular**: one observable claim per bullet
- [ ] **Bounded**: the reader can tell what is in and out without guessing
- [ ] **Stated as behavior**: name what the actor can do or observe before the implementation detail; "GET /foo returns 200 with `{shape}`" beats "the endpoint exists"
- [ ] **Plain wording**: states the action and conditions directly under `./user-facing-messages.md` § *Plain wording*. Compare the goal with its source. Retain each condition and technical qualifier in the goal when shortening its wording.

Keep thresholds, compatibility obligations, and failure behavior in the goal as acceptance details. Put commands, typecheck assertions, fixture setup, and test recipes in the plan step's `Verify`, not in the goal. A document goal names what a reader can decide or use from the document, with required content and format as acceptance details.

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

For engineering tasks, the deployment and browser gate in `../engineering/acceptance-gate.md` applies independently of `(external)` goals. Add a goal only when the requested outcome warrants one; omission of a live goal does not waive live verification.

## Anti-patterns

- "The CSV export works" → "User can export the current filter as CSV; the file's row count matches the on-screen count"
- "Performance is acceptable" → "p95 export latency under 2s for the largest tenant in staging"
- "Handles errors gracefully" → "On API failure, the UI shows the server error message and the export button re-enables"
- "Auth is implemented and tokens are validated" → split into "Login flow returns a JWT" + "Requests with an expired JWT receive 401"
- "Add a `formatCsv()` helper" → a plan step, not a goal; restate as the outcome it delivers
- "The client spec records both flag values" → "Callers' PnL selection reaches every positions request as the chosen `include_pnl` boolean"; put the two-call assertion in `Verify`
- "The ADR has numbered sections" → "Reviewers can decide the Phase-1 consumption contract from the ADR, including its wire shape, coverage, and named open items"; keep required format beside that outcome

### Plain wording examples

- "The callers' positions-response surface preserves the `include_pnl=false` PnL-exclusion boundary." → "Callers receive no PnL in positions responses when `include_pnl=false`."
- "Operators' release authority is gated on p95 export latency under 2s for the largest tenant in staging." → "Operators may release only after p95 export latency is under 2s for the largest tenant in staging."
- "Reviewers can distinguish the unverified timeout-to-duplicate-payment causal path in the ADR from a confirmed failure." → "Reviewers can distinguish the ADR's unverified claim that a timeout may cause duplicate payments from a confirmed failure."

## Common Mistakes

- "No errors in the console" names an absence, not the behavior that proves the feature
- "The unit test passes" describes the test, and holds as soon as the test exists
- A compound bullet hides goals that coverage analysis cannot tag

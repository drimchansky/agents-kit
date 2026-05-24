# Acceptance Criteria

Quality bar for the bullets in `<task-slug>.spec.md`. A criterion that fails any check below is not ready for `review-task` or `implement-plan` — fix it (or mark `_(unresolved: <note>)_`) before downstream skills run.

## Each criterion is

- [ ] **Testable** — verifiable by running a command, exercising a flow, or inspecting state; not "feels right" or "works well"
- [ ] **Specific** — names a concrete artifact, behavior, or measurable yardstick; no hedge words ("works", "good", "robust", "fast enough")
- [ ] **Outcome-oriented** — describes user-visible or caller-visible behavior, not implementation steps
- [ ] **Singular** — one observable claim per bullet; split "and"-stuffed compounds into separate bullets
- [ ] **Bounded** — scope is unambiguous; reader can tell what's in vs out without guessing
- [ ] **Stated as behavior, not implication** — "user can X" beats "X is implemented"; "GET /foo returns 200 with `{shape}`" beats "the endpoint exists"

## Anti-patterns

- "The CSV export works" → "User can export the current filter as CSV; the file's row count matches the on-screen count"
- "Performance is acceptable" → "p95 export latency under 2s for the largest tenant in staging"
- "Handles errors gracefully" → "On API failure, the UI shows the server error message and the export button re-enables"
- "Auth is implemented and tokens are validated" → split into "Login flow returns a JWT" + "Requests with an expired JWT receive 401"
- "Add a `formatCsv()` helper" → not a criterion at all; that's a plan step. Restate as the user-facing outcome it delivers.

## Common Mistakes

- Treating absence of complaint as success — "no errors in the console" is not an acceptance criterion; name the behavior that proves the feature works
- Letting the criterion describe the test rather than the outcome — "the unit test passes" tautologically passes once the test exists
- Hiding multiple criteria inside one bullet — coverage analysis can't tag a compound criterion accurately
- Reusing vague phrasing from the original ticket without sharpening — the spec is the place to make requirements testable, not to mirror upstream language

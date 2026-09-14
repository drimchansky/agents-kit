# Code Style

## Functions

- [ ] Single responsibility; ≤3 parameters or an options object; prefer purity, isolated effects, and early returns.

## Comments

Prefer fewer comments because restatements drift. Apply prohibitions as invariants and preferences with judgment to new/touched comments regardless of existing density.

- [ ] Prefer clear code/names, types, runtime checks, tests, and fixtures over implementation comments.
- [ ] Comment only non-obvious current constraints: security/concurrency/performance, protocol/platform/API quirks, units/formats, external limits, surprising trade-offs. Explain why and the prevented failure.
- [ ] No restatements or duplication of types/tests/configuration/nearby code.
- [ ] No task/review/change history, phases/branches/rollouts/future merges, dated investigations/probes, TODOs, unresolved discussion, speculation, or task provenance.
- [ ] Plans/history/sources go in task/execution records; durable decisions in owned ADRs/logs (`../workflow/task-store.md` → Store-level artifacts). Keep comments concise/current; express behavior/examples through code/types/tests/fixtures.
- [ ] State reasons inline; links only supplement them. Bare pointers are banned.
- [ ] Links: official docs/enduring public resources/versioned repo content; pin canonical source.
- [ ] No outside-repo internal/discussion links or ticket codes (Notion/Jira/wikis/public/private issue/PR threads); summarize inline.
- [ ] Update/remove comments invalidated or obsoleted by changed behavior; no unrelated comment audits.
- [ ] Comment-only findings require material correctness/security/API-compatibility/maintenance misinformation about changed code; verbosity/style alone never qualifies.
- [ ] Exceptions: public-API docs, required legal/generated markers, tool directives. Keep accurate/minimal; explain non-obvious suppressions. API docs stay on exports (`typescript.md` → Naming).
- [ ] No commented-out code.

Executor adapters carry a sanctioned copy per `AGENTS.md` § *Consumer lists*.

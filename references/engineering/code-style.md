# Code Style

## Functions

- [ ] Single responsibility — do one thing well
- [ ] 3 parameters max; options object for more
- [ ] Pure functions preferred; side effects isolated
- [ ] Early returns to reduce nesting

## Comments

Default to fewer comments because a stale or restating comment costs more than the line it saves. Every prohibition below is an invariant; everything phrased as a preference is judgment. Existing comments are context to validate, not precedent to imitate — this section governs new and touched comments even where the project's existing comment density says otherwise.

This section is the home for the comment discipline. `agents/executor.md` and `agents/executor.toml` carry a condensed digest of it in their system-prompt text, so a delegated executor holds the discipline without loading this file. When this section changes, mirror the change into both.

- [ ] Treat implementation comments as a last resort. Prefer clear code and names, types, runtime checks, tests, and fixtures when they can express or enforce the contract
- [ ] Add an implementation comment only to preserve a non-obvious current invariant or constraint that a future editor could otherwise violate — especially a security, concurrency, or performance requirement, a protocol/platform or external-API quirk, a unit or format difference, another external constraint, or a surprising trade-off. Explain why it exists and what failure it prevents
- [ ] Do not add comments that restate code; duplicate a fact already encoded by types, tests, configuration, or nearby code; narrate task, review, or change history; describe phases, branches, rollouts, or future merges; record dated investigations or probes; or preserve TODOs, unresolved discussion, speculation, or task provenance. Put plans, history, and task sources in task or execution records; keep long-lived architectural decisions in owned documentation — an ADR or the project's decision log for decisions that outlive one task (e.g. a store-level `DECISIONS.md`, see `../workflow/task-layout.md` → Store-level artifacts) — never in source comments, which stay concise and scoped to the present contract; express behavior and examples through code, types, tests, and fixtures
- [ ] A comment must be self-sufficient — state the reason inline so the line makes sense without following any link. A link may supplement that explanation but never replace it; a bare pointer with no inline reason (e.g. `see JIRA-123`) is banned
- [ ] Link only to official documentation or another long-lived public resource — framework/language docs, a web standard (MDN, web.dev), an RFC or published spec, or a pinned permalink to canonical public source that defines the constraint being explained. Referencing a sibling file, symbol, or doc within this repo is also fine — it's versioned with the code. Never link an internal or discussion-thread resource outside the repo — no Notion, Jira, ticket codes, internal wikis, or issue/PR threads, public or private; summarize the point inline instead
- [ ] When changing code, validate comments whose claims depend on the changed behavior. Update or remove comments made inaccurate or unnecessary by the change as part of the same edit; do not audit unrelated comments. Report a separate comment-only finding only when it is materially misleading to correctness, security, API compatibility, or maintenance of the changed code; comment verbosity or style is never a standalone finding
- [ ] Public-API documentation, required legal or generated-file markers, and tool directives are exceptions. Keep them accurate and minimal; a suppression directive must state its non-obvious reason. Keep public-API docs on exported symbols, where consumers discover them through tooltips and generated documentation (see `typescript.md` → Naming)
- [ ] No commented-out code — version control exists

# Code Style

## Functions

- [ ] Single responsibility — do one thing well
- [ ] 3 parameters max; options object for more
- [ ] Pure functions preferred; side effects isolated
- [ ] Early returns to reduce nesting

## Comments

- [ ] Prefer self-explanatory code (clear names, small functions); reach for a comment only when intent can't be made clear in the code itself
- [ ] Comments must not duplicate the code — a comment that restates the line below it is noise; delete it
- [ ] A comment is not an excuse for unclear code — if a clear comment is hard to write, treat that as a signal to fix the code (rename, extract, simplify) rather than annotate it
- [ ] Comments must dispel confusion, not cause it — a wrong or stale comment is worse than none; update or delete comments when the code they describe changes
- [ ] Reserve inline code comments for local gotchas a future editor of that line must see — unidiomatic code, a non-obvious workaround, an external constraint, a "looks wrong but isn't". The "why it works this way" narrative and worked examples go in the tests (as comments on the test that exercises the behavior), not the production file
- [ ] When you do comment, explain "why", not "what"
- [ ] A comment must be self-sufficient — state the reason inline so the line makes sense without following any link. A link may supplement that explanation but never replace it; a bare pointer with no inline reason (e.g. `see JIRA-123`) is banned
- [ ] Link only to official documentation or another long-lived public resource — framework/language docs, a web standard (MDN, web.dev), an RFC or published spec, or a pinned permalink to canonical public source (when attributing copied code, name its origin inline and link the permalink). Referencing a sibling file, symbol, or doc within this repo is also fine — it's versioned with the code. Never link an internal or discussion-thread resource outside the repo — no Notion, Jira, ticket codes, internal wikis, or issue/PR threads, public or private; summarize the point inline instead
- [ ] When fixing a bug, comment the fix site if the code would look wrong or arbitrary without it — name the failure it prevents; the full reproduction narrative lives in the regression test
- [ ] Mark incomplete implementations with a `TODO:` comment stating what's missing and why it was deferred
- [ ] Public-API documentation is the exception — keep JSDoc on exported symbols and complex functions at the code, where consumers discover it via tooltips and generated docs (see `typescript.md` → Naming)
- [ ] No commented-out code — version control exists

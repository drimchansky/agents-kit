# Code Style

## Functions

- [ ] Single responsibility — do one thing well
- [ ] 3 parameters max; options object for more
- [ ] Pure functions preferred; side effects isolated
- [ ] Early returns to reduce nesting

## Comments

- [ ] Prefer self-explanatory code (clear names, small functions); reach for a comment only when intent can't be made clear in the code itself
- [ ] Reserve inline code comments for local gotchas a future editor of that line must see — a non-obvious workaround, an external constraint, a "looks wrong but isn't". The "why it works this way" narrative and worked examples go in the tests (as comments on the test that exercises the behavior), not the production file
- [ ] Public-API documentation is the exception — keep JSDoc on exported symbols and complex functions at the code, where consumers discover it via tooltips and generated docs (see `typescript.md` → Naming)
- [ ] When you do comment, explain "why", not "what"
- [ ] Keep the comment self-contained — state the reason inline; don't point to external docs, tickets, or URLs
- [ ] No commented-out code — version control exists

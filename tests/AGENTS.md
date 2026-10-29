# Editing tests

Apply root `AGENTS.md`. Before changing a suite, read its paragraphs in `references/maintenance/tests.md`; select checks through `references/maintenance/repository.md` § *Change routing*.

Keep suites dependency-free and isolated from real homes, credentials, vendor CLIs, and network access as their contracts require. Sources contain no comments.

The live doctor probe and live executor smoke remain opt-in. Read their maintenance sections only when that live work is intended; the executor smoke requires a request for live model calls.

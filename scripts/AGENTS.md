# Editing helpers

Apply root `AGENTS.md`. Before editing a helper, read `references/maintenance/repository.md` § *Shared conventions* and its section in `references/maintenance/scripts.md`, including cited mirrors.

Runtime helper interfaces belong in `references/scripts/<name>.md`; maintainer-only interfaces and rationale belong in the maintenance section. Change the contract with the implementation. Keep sources comment-free and dependencies at zero.

Select checks through `references/maintenance/repository.md` § *Change routing*. Every health boundary runs the whole suite from the root instructions.

# Maintaining agents-kit

This guide applies to the agents-kit source repository. Read [CORE_RULES.md](./CORE_RULES.md) before task-specific sources.

## Writing standard

Keep runtime instructions focused on model actions:

- Delete Don't Rationalize, Verification, Red flags, and CRITICAL scaffolding. Keep Core Rules and longer contract titles such as Verification cadence.
- Remove rationale, design history, and repeated ownership/loading commentary.
- Preserve each invariant beside the action it guards. Replace defensive branch lists with their invariant unless omission risks a wrong write, Git mutation, deletion, or false report.
- Put direct owner pointers beside their actions and retain cold markers. Keep helper, suite, and installer rationale in the corresponding maintenance reference.
- Write one idea per sentence, aiming for 20 words. Avoid em-dash chains and "X is what Y" constructions. Reserve `never` and `MUST` for invariants. Add no size script or ratchet.

## Ownership

Edit the authoritative owner: skills own protocols; workflow/domain references own shared guidance; templates own copy-ready task shapes; `.agents/tasks/` owns task records.

Detailed installer, helper, suite, plugin, and mirror ownership is in `references/maintenance/repository.md` § *Ownership*. Read that section when changing those boundaries.

## The `.ts` sources are unchecked by design

`setup.ts`, `scripts/`, and `tests/` use zero dependencies and direct Node type stripping. **Node 23.6 or newer is the supported floor for every `.ts` source.** State that floor only here.

There is no build, typechecker, linter, formatter, or graph-aware test scope. Every health boundary runs `node --test "tests/*.test.ts"` over the whole tree. Engineering boundary manifests still support commit-gate reuse.

Read `references/maintenance/repository.md` § *Type stripping and verification* when revisiting this support or verification choice.

## Source contracts

Before editing a helper, read `scripts/AGENTS.md`; before editing a suite, read `tests/AGENTS.md`.

For installer edits, read `references/maintenance/repository.md` § *Source contracts*. For helper edits, read its § *Shared conventions* and the helper's section in `references/maintenance/scripts.md`.

Runtime CLI/stdout/exit contracts stay in `references/scripts/<name>.md`. Maintainer-only helper contracts stay in `references/maintenance/scripts.md`; suite contracts stay in `references/maintenance/tests.md`. Sources contain no comments. Change caller-facing contracts at their owner in the same edit.

## Change routing

Inspect affected skills, direct references, and relevant Git history before editing. Reverse-search shared-contract consumers across `skills/`, `references/`, `scripts/`, `agents/`, and `CORE_RULES.md`.

For installation or adapter changes, inspect `tests/setup-install.test.ts` and `scripts/health-check.ts` together. Read the surface-to-suite mapping in `references/maintenance/repository.md` § *Change routing* when selecting checks.

After corpus prose edits, run `node scripts/dup-check.ts .`. Resolve duplicate rules to owner citations; intentional copies require an explained `tests/dup-allow.json` entry under `references/maintenance/scripts.md` § *`scripts/dup-check.ts`*. Update dependent consumers only when their consumed contract changes.

## Consumer lists

Derive citation lists by reverse search. Retain semantic registries where search cannot recover uncited consumers or classification reasons. Record sanctioned copies and update every affected mirror together.

Before changing a registry or mirrored contract, read `references/maintenance/repository.md` § *Consumer lists* for the semantic registries and mirror/import obligations.

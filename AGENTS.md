# Maintaining agents-kit

This guide is for agents maintaining this **agents-kit source repository**. It does not govern work in a consumer project that has installed the kit.

Start by reading and applying [CORE_RULES.md](./CORE_RULES.md). It is the canonical shared-rules source; follow task-specific sources only after it.

## Ownership

- `skills/<name>/SKILL.md` owns that skill's protocol and its direct reference citations.
- `references/workflow/` owns cross-skill workflow methodology; `references/workflow/domain-packs.md` owns the domain-pack interface.
- `references/<domain>/` owns domain-specific guidance.
- `setup.sh` owns installation and distribution behavior.
- `tests/` owns repository verification; `tests/setup-install.sh` covers installation and distribution behavior.
- `.agents/tasks/` owns task artifacts and their active work context.

## Change routing

Before changing the kit, identify and inspect:

- the affected `SKILL.md` files and every reference they cite directly;
- shared-contract consumers when changing a workflow reference, domain-pack interface, core rule, or distribution behavior;
- the installer integration test (`bash tests/setup-install.sh`) when changing `setup.sh`, native agent definitions, or installed payload behavior;
- relevant Git history, to preserve the reason behind an existing contract.

Keep each change with its authoritative owner; update dependent consumers only when the contract they consume changes.

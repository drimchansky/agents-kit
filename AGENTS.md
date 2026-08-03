# Maintaining agents-kit

This guide is for agents maintaining this **agents-kit source repository**. It does not govern work in a consumer project that has installed the kit.

Start by reading and applying [CORE_RULES.md](./CORE_RULES.md). It is the canonical shared-rules source; follow task-specific sources only after it.

## Ownership

- `skills/<name>/SKILL.md` owns that skill's protocol and its direct reference citations.
- `references/workflow/` owns cross-skill workflow methodology; `references/workflow/domain-packs.md` owns the domain-pack interface.
- `references/<domain>/` owns domain-specific guidance.
- `setup.sh` owns installation and distribution behavior.
- `scripts/` owns the repository's zero-dependency Node detection helpers; each script's file header owns its own CLI forms and stdout contract.
- `tests/` owns repository verification; `tests/setup-install.sh` covers installation and distribution behavior, `tests/health-check.sh` the task and install health checks, and `tests/session-triage.sh` the session triage.
- `.agents/tasks/` owns task artifacts and their active work context.

## Change routing

Before changing the kit, identify and inspect:

- the affected `SKILL.md` files and every reference they cite directly;
- shared-contract consumers when changing a workflow reference, domain-pack interface, core rule, or distribution behavior;
- the installer integration test (`bash tests/setup-install.sh`) when changing `setup.sh`, native agent definitions, or installed payload behavior — and `scripts/health-check.mjs` in the same pass, whose `--installs` mode hardcodes `setup.sh`'s ownership markers, payload categories, and per-host agent extensions;
- the harness under `tests/` covering a script you changed — `bash tests/health-check.sh` for `scripts/health-check.mjs`, `bash tests/session-triage.sh` for `scripts/session-triage.mjs`;
- relevant Git history, to preserve the reason behind an existing contract.

Keep each change with its authoritative owner; update dependent consumers only when the contract they consume changes.

# Agents Kit

Shared instructions and skills for Claude Code, Codex, and other coding agents.

## Structure

```
agents-kit/
├── AGENTS.md              # Shared rules (canonical source)
├── references/            # Domain checklists (TypeScript, React, CSS, etc.)
├── skills/                # Shared skills
├── setup.sh               # Installs agent assets
└── README.md
```

After running `setup.sh`, the installer updates agent-specific locations:

```
~/.claude/CLAUDE.md
~/.claude/references/
~/.claude/skills/explore/
~/.claude/skills/design-plan/
~/.claude/skills/implement-plan/
~/.codex/AGENTS.md
~/.codex/references/
~/.codex/skills/explore/
~/.codex/skills/design-plan/
~/.codex/skills/implement-plan/
...                              # one directory per skill
```

## How It Works

The kit has two shared parts plus agent adapters:

- **`AGENTS.md`** — The canonical, agent-neutral rules file. `setup.sh` copies it into each agent's home directory, renaming as needed (e.g. `CLAUDE.md` for Claude).
- **`skills/`** — Shared skills copied into each supported agent's skill directory. This lets you keep local agent-specific skills alongside the ones from this repo.
- **Adapters** — `setup.sh` maps the shared content into each agent's expected home directory and naming conventions. To add a new agent, add an entry to the `AGENTS` array in `setup.sh`.

**Note:** If you have your own skill with the same name as one in this repo, `setup.sh` will ask before overwriting it. Skills installed by this kit that are later removed from the repo will be cleaned up automatically on the next run. Your own skills are never touched.

## Skills

Skills are organized into two groups: an **engineering workflow** that shapes the development loop, and a set of **utilities** for ad-hoc tasks.

### Engineering workflow

The workflow runs roughly in order, but you don't need every step – pick whichever fits the task.

1. **Understand** — `explore` — Explore how something works: code, features, architecture, libraries, APIs, protocols, or domain concepts. Also use before planning to surface constraints, blast radius, and known alternatives.
2. **Plan** — `design-plan` — Break a task into steps, compare approaches, define scope. Writes the plan to `.agents/plans/<slug>.md`.
3. **Review the plan** — `review-plan` — Sanity-check the plan against the codebase: feasibility per step, missing details, pattern conflicts.
4. **Implement** — `implement-plan` — Execute a plan from `.agents/plans/`. Updates a companion `*.result.md` and marks each step DONE in the plan as work completes. Supports full-plan or step-by-step execution.
5. **Review the code** — `review-code` — Check the implementation for bugs, blast radius, and adherence to project patterns.
6. **Verify issues** — `verify-issue` — Confirm a reported bug is real, identify root cause, and assess severity. Often run on findings from `review-code`.
7. **Document** — `update-doc` — Write or refresh documentation based on the current implementation: README, AGENTS.md/CLAUDE.md, architecture notes, runbooks, etc.

Cross-cutting (use whenever the codebase has drifted from its docs):

- `validate-docs` — Audit existing documentation against the codebase for stale references, drifted descriptions, and missing context. Pairs with `update-doc` for the fix.

#### Plan and result files

`design-plan` and `implement-plan` share a convention:

- **Plan** — `.agents/plans/<slug>.md` — the contract. Steps use `- [ ]` checkboxes that `implement-plan` flips to `- [x]` as work completes.
- **Result** — `.agents/plans/<slug>.result.md` — append-only record of what shipped, deviations, and surprises. One section per step (or one combined section for full-plan runs).

### Utilities

Standalone skills that aren't tied to the engineering loop:

- `proofread` — Check a message for grammar, clarity, and factual accuracy.
- `translate` — Translate text while preserving tone and context.
- `validate-note` — Analyze personal knowledge base notes for quality and completeness.

## Installation

```bash
git clone git@github.com:drimchansky/agents-kit.git
~/agents-kit/setup.sh
```

The repo can be cloned anywhere — `setup.sh` resolves its own location automatically.

To update later:

```bash
cd ~/agents-kit && git pull
./setup.sh
```

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

## Workflow

The skills follow a natural development workflow:

1. **Understand** — `explore` — Explore how something works: code, libraries, APIs, concepts, or architecture. Also use before planning to surface constraints, blast radius, and known alternatives.
2. **Specify** — `update-spec` — Create or update a project or feature spec from conversation context, exploration findings, and validation feedback.
3. **Validate** — `validate-spec` — Check a feature spec against the codebase for feasibility, conflicts, and missing details before planning begins.
4. **Plan** — `design-plan` or `refactor` — Break a task into steps, compare approaches, define scope. `design-plan` writes the plan to `.agents/plans/YYYY-MM-DD-<slug>.md`.
5. **Implement** — `implement-plan` — Execute a plan from `.agents/plans/`. Updates a companion `*.result.md` and marks each step DONE in the plan as work completes. Supports full-plan or step-by-step execution.
6. **Review** — `code-review` — Check for bugs, impact, and adherence to project patterns.
7. **Verify** — `verify` — Verify a reported issue is real, identify root cause, and assess severity.

You don't need to use every step — pick whichever skills fit the task at hand.

### Plan and result files

`design-plan` and `implement-plan` share a convention:

- **Plan** — `.agents/plans/YYYY-MM-DD-<slug>.md` — the contract. Steps use `- [ ]` checkboxes that `implement-plan` flips to `- [x]` as work completes.
- **Result** — `.agents/plans/YYYY-MM-DD-<slug>.result.md` — append-only record of what shipped, deviations, and surprises. One section per step (or one combined section for full-plan runs).

### Utility skills

These don't belong to a specific workflow step but are available alongside the ones above:

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

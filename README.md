# Agents Kit

A personal agents kit for Claude Code, Codex, and other coding agents.

## What is this?

A personal kit of skills, rules, and reference checklists for working with coding agents. Its core is an **engineering workflow** that wraps a coding agent in a structured development loop — **understand → plan → implement → review → verify → document** — alongside a small set of standalone **utilities** (proofreading, translation, etc.) for ad-hoc tasks. Each capability is a slash-command-style skill you invoke when you need it; skills share a common rule set (`CORE_RULES.md`) and a plan/result file convention so they hand off cleanly to each other.

The same kit installs into Claude Code (as a plugin) and Codex (via setup script), so it travels with you across agents.

## Quick start

Inside Claude Code:

```
/plugin marketplace add drimchansky/agents-kit
/plugin install agents-kit@drimchansky-agents-kit
```

Then try a skill:

```
/explore how does the auth middleware work?
```

You'll know it's working when the agent's first line is:

```
✅ Core rules applied (./AGENTS.md)
```

If that line is missing, the skill's shared rules didn't load — see [How It Works](#how-it-works).

## Skills

Skills are organized into two groups: an **engineering workflow** (9 skills) that shapes the development loop, and a set of **utilities** (2 skills) for ad-hoc tasks.

### Engineering workflow

The workflow runs roughly in order, but you don't need every step – pick whichever fits the task.

| Stage      | Skill                                              | When to use                                                                         | Example                                       |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| Understand | [`explore`](skills/explore/SKILL.md)               | Understand existing code or context before changing it.                             | `/explore how does the retry queue work?`     |
| Understand | [`refine-idea`](skills/refine-idea/SKILL.md)       | Sharpen a rough idea before planning — assumptions, MVP scope, "Not Doing" list.    | `/refine-idea add a draft mode to the editor` |
| Plan       | [`design-plan`](skills/design-plan/SKILL.md)       | A change is non-trivial and needs a contract. Writes `.agents/plans/<slug>.md`.     | `/design-plan migrate auth to JWT`            |
| Plan       | [`review-plan`](skills/review-plan/SKILL.md)       | A plan exists but hasn't been validated against the code.                           | `/review-plan auth-jwt-migration`             |
| Implement  | [`implement-plan`](skills/implement-plan/SKILL.md) | A validated plan is ready to ship. Marks steps `[x]` and writes a `*.result.md`.    | `/implement-plan auth-jwt-migration`          |
| Review     | [`review-code`](skills/review-code/SKILL.md)       | Code is written and needs an audit before merge — bugs, blast radius, pattern fit.  | `/review-code`                                |
| Verify     | [`verify-issue`](skills/verify-issue/SKILL.md)     | A reported bug needs to be confirmed and root-caused before a fix.                  | `/verify-issue users see 500 on signup`       |
| Document   | [`update-doc`](skills/update-doc/SKILL.md)         | Shipped code has drifted from its docs (README, AGENTS.md, runbooks).               | `/update-doc README`                          |
| Document   | [`validate-docs`](skills/validate-docs/SKILL.md)   | Docs haven't been touched in a while or you suspect drift. Pairs with `update-doc`. | `/validate-docs`                              |

### Idea, plan, and result files

`refine-idea`, `design-plan`, and `implement-plan` share a convention — this is the contract that lets them hand off:

- **Idea** — `.agents/ideas/<slug>.md` — one-pager from `refine-idea` that `design-plan` consumes as input.
- **Plan** — `.agents/plans/<slug>.md` — the contract. Steps use `- [ ]` checkboxes that `implement-plan` flips to `- [x]` as work completes.
- **Result** — `.agents/plans/<slug>.result.md` — append-only record of what shipped, deviations, and surprises. One section per step (or one combined section for full-plan runs).

These files land in `.agents/` inside your consumer project. Commit or gitignore at your discretion — the kit doesn't enforce either.

### Reference checklists

The kit also ships domain checklists in `references/engineering/` that engineering skills (especially `implement-plan` and `review-code`) consult when relevant: `accessibility`, `code-style`, `css`, `performance`, `react`, `security`, `tanstack-query`, `testing`, `typescript`. Other domains (e.g. prose, design) can live as siblings under `references/` as new subdirectories appear; the prose-only utilities (`proofread`, `translate`) deliberately omit a References block today.

### Utilities

Standalone skills that aren't tied to the engineering loop:

| Skill                                    | When to use                                                                                 | Example                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| [`proofread`](skills/proofread/SKILL.md) | Polishing a message, email, or piece of writing for grammar, clarity, and factual accuracy. | `/proofread` (paste text) |
| [`translate`](skills/translate/SKILL.md) | Moving content between languages while preserving tone and context.                         | `/translate to Spanish`   |

## Installation

### Claude Code (plugin, recommended)

Install via the plugin marketplace from inside Claude Code:

```
/plugin marketplace add drimchansky/agents-kit
/plugin install agents-kit@drimchansky-agents-kit
```

The repo doubles as both a plugin (`.claude-plugin/plugin.json`) and a single-entry marketplace (`.claude-plugin/marketplace.json`), so a single `marketplace add` is enough — no separate marketplace repo to set up.

For local development against an unreleased clone:

```bash
git clone git@github.com:drimchansky/agents-kit.git ~/agents-kit
claude --plugin-dir ~/agents-kit
```

Either path uses the same plugin layout: skills auto-load from `skills/<name>/SKILL.md`, and symlinks inside the plugin are preserved in the cache so each skill's sibling `AGENTS.md` resolves to `CORE_RULES.md` at the kit root.

### Codex / manual install

For Codex, or for users who prefer a non-plugin install of Claude Code, run the setup script:

```bash
git clone git@github.com:drimchansky/agents-kit.git ~/agents-kit
~/agents-kit/setup.sh
```

The repo can be cloned anywhere — `setup.sh` resolves its own location automatically. The script copies `skills/` and `references/` into **both** `~/.claude/` and `~/.codex/` unconditionally (even if you only use one agent) and dereferences the per-skill `AGENTS.md` symlinks into real files at the install destination.

**Windows note:** the kit's per-skill `AGENTS.md` files are Git symlinks. They check out correctly on macOS, Linux, and WSL. On native Windows, Git requires `core.symlinks=true` (default-on with modern Git for Windows + developer mode); without it, the symlinks materialize as text files containing the literal path `../../CORE_RULES.md` and the kit's rules won't load. Verify with `ls -la skills/explore/AGENTS.md` showing a real symlink before running `setup.sh`. WSL avoids the issue entirely.

### Updating

```bash
cd ~/agents-kit && git pull
~/agents-kit/setup.sh   # only needed for non-plugin installs
```

Plugin installs pick up changes the next time the plugin cache refreshes.

## How It Works

The kit ships the rules **with each skill** instead of as a global instructions file:

- **`CORE_RULES.md`** — The canonical, agent-neutral rules file. Lives once at the repo root and is distributed to each skill via a symlink.
- **`skills/<name>/AGENTS.md`** — A relative symlink (`../../CORE_RULES.md`) inside every skill directory. The Claude Code plugin loader preserves symlinks in its cache, so they resolve at runtime; for non-plugin installs, `setup.sh` dereferences with `cp -L` and writes a real file copy into each installed skill directory. The sibling is named `AGENTS.md` so it feels native to AGENTS.md-aware tools at the consumer end.
- **`AGENTS.md`** (repo root) — Contributor-facing instructions for working on this kit. Not shipped to consumer projects.
- **`skills/<name>/SKILL.md`** — Opens with a fixed "Core Rules" directive that instructs the agent to read the sibling `./AGENTS.md` first, apply its rules for the duration of the skill, and emit `✅ Core rules applied (./AGENTS.md)` as a visible confirmation before doing anything else. If the line doesn't appear in the agent's response, the rules weren't loaded.
- **No global rules file is installed.** `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` are no longer written by this kit. Rules apply only when a skill from the kit is invoked.
- **Adapters** — `setup.sh` maps the shared content into each non-plugin agent's expected directory (`~/.claude/skills/`, `~/.codex/skills/`). To add a new agent, append to the `AGENTS` array in `setup.sh`.

If you have your own skill with the same name as one in this repo, `setup.sh` will ask before overwriting it. Skills installed by this kit that are later removed from the repo will be cleaned up automatically on the next run. Your own skills are never touched.

# Contributing to agents-kit

This file is for **agents and humans working on this repo**. If you're an agent invoked from a _consumer_ project that has installed the kit, this file does not apply to you — your rules come from `./AGENTS.md` inside the skill directory you're running, which resolves to `CORE_RULES.md` at the kit root.

## What this repo is

A kit of skills and shared rules distributed to coding agents (Claude Code, Codex, and others). It ships in two ways:

- **Claude Code plugin marketplace (preferred for end users)** — the repo carries both `.claude-plugin/plugin.json` (plugin manifest) and `.claude-plugin/marketplace.json` (single-entry marketplace whose plugin is sourced from the same repo via `"source": "./"`). End users install with `/plugin marketplace add drimchansky/agents-kit` followed by `/plugin install agents-kit@drimchansky-agents-kit`. To add a future plugin, append a new entry to `marketplace.json`'s `plugins` array with its own schema-valid `source` — no separate marketplace repo needed.
- **Claude Code `--plugin-dir`** — local-dev install against an unreleased clone: `claude --plugin-dir /path/to/agents-kit`.
- **`setup.sh` (manual / non-plugin)** — copies `skills/` and `references/` into each supported agent's home directory (`~/.claude/...`, `~/.codex/...`).

`README.md` covers user-facing structure and installation. This file covers **how to work on the kit**.

## The Core Rules contract

The kit's shared rules live in **`CORE_RULES.md`** at the repo root. They're distributed to consumer projects through a per-skill mechanism — not as a global rules file:

- Each `skills/<name>/AGENTS.md` is a **relative symlink** to `../../CORE_RULES.md`.
- Each `skills/<name>/SKILL.md` opens with a fixed **"Core Rules" directive** that instructs the agent to:
    1. Read the sibling file `./AGENTS.md`.
    2. Apply the rules for the duration of the skill.
    3. Output `✅ Core rules applied (./AGENTS.md)` verbatim, on its own line, before any other text or tool calls.

**Don't break this contract.** When you add or edit a skill:

- The directive block must be present and unmodified at the top of `SKILL.md`, between the closing `---` of the frontmatter and the existing body.
- The sibling `skills/<name>/AGENTS.md` must exist and point at `../../CORE_RULES.md`.
- The check-mark confirmation line is the user's only signal that rules were loaded; if it changes wording, every skill must be updated together.

If you want to change the rules themselves, edit `CORE_RULES.md`. The change propagates to all skills automatically — symlinks resolve at read time. There is no build step.

## Symlink caveat

Git stores symlinks as mode `120000` blobs whose content is the literal target path. They're recreated on checkout on macOS, Linux, and WSL. **Windows requires `core.symlinks=true`** (default-on with modern Git for Windows + developer mode); without it, symlinks materialize as small text files containing the literal `../../CORE_RULES.md` target path, which silently breaks the kit. If you contribute from Windows, verify with `ls -la skills/explore/AGENTS.md` showing a real symlink before pushing.

`setup.sh` dereferences with `cp -RfL` so the install destination always contains real file copies. Don't replace symlinks with file copies in the repo — that defeats the single-source-of-truth design.

## Adding a new skill

1. Create `skills/<name>/SKILL.md` with frontmatter:

    ```
    ---
    name: <name>
    description: Use when ...
    argument-hint: '[...]'
    disable-model-invocation: true
    ---
    ```

2. Insert the standard "Core Rules" directive block immediately after the closing `---`. Copy it verbatim from any existing skill (e.g. `skills/explore/SKILL.md`).
3. Write the skill body below the directive. For any engineering skill, include a `## References` block — copy the one-liner from another skill (e.g. `skills/explore/SKILL.md`) so the skill participates in the `references/engineering/` auto-pickup described under "Repo conventions". Skills that don't operate on code (`proofread`, `translate`) intentionally omit this block.
4. Add the sibling symlink:

    ```
    ln -s ../../CORE_RULES.md skills/<name>/AGENTS.md
    ```

5. Add a row for the new skill in `README.md` — either the engineering-workflow table or the utilities table. The plugin loader and `setup.sh` auto-discover skills from `skills/<name>/SKILL.md` (no manifest registration needed), but `README.md` is hand-curated and won't list the skill otherwise.

## Editing the standard directive

The directive block is hand-edited in every `skills/<name>/SKILL.md`. There's no template engine. If you change its shape (heading text, instruction count, confirmation wording), update every skill in the same change. After editing, sweep with:

```
grep -L "## Core Rules" skills/*/SKILL.md                 # should be empty
grep -L "✅ Core rules applied (./AGENTS.md)" skills/*/SKILL.md # should be empty
```

## Verifying changes

Tests 1–6 are automated locally. Run them all with one command:

```
./scripts/verify.sh
```

`scripts/verify.sh` is the **single source of truth** for the locally-automatable checks. CI runs the same script via `.github/workflows/verify.yml` on every push and pull request — if you change a check, change it there. Test 7 stays manual. Test 8 is automated in CI only (`.github/workflows/test-plugin-install.yml`) because it depends on a Node toolchain plus the Claude Code CLI; it's not part of `verify.sh`.

The list below describes what each check covers and why it exists; the implementations live in `scripts/verify.sh` (tests 1–6) or `.github/workflows/test-plugin-install.yml` (test 8). If you need to change what a check asserts, edit the script/workflow and update the description here in the same change.

**1. Shell syntax** — `bash -n` parses `setup.sh` and `scripts/verify.sh`. Catches typos before runtime.

**2. Plugin manifests** — `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` parse as JSON, contain the keys the kit actually relies on (`name`/`description`/`version` for the plugin; `name`/`owner`/`plugins` for the marketplace; `name`/`description`/`source` per marketplace plugin entry), and the marketplace lists this plugin by name. Structural only — there's no public JSON Schema for the Claude Code formats. Update both the script and this description when a new field becomes load-bearing.

**3. Symlink contract** — every `skills/<name>/AGENTS.md` is a real symlink whose target is `../../CORE_RULES.md` and which resolves to an existing file. Catches the Windows-without-`core.symlinks` regression, and any accidental file-instead-of-symlink commit.

**4. Directive contract** — every `skills/<name>/SKILL.md` carries the `## Core Rules` heading and the visible `✅ Core rules applied (./AGENTS.md)` confirmation line, and no stale `../../AGENTS.md` references remain anywhere under `skills/`. Catches drift when the directive is edited in some skills but not others.

**5. Fresh install layout** — runs `setup.sh` against a throwaway `$HOME` and confirms (a) no global rules file is written at `~/.claude/CLAUDE.md` or `~/.codex/AGENTS.md` and (b) every installed `~/.<agent>/skills/<name>/AGENTS.md` is a real file (not a symlink) byte-identical to `CORE_RULES.md`. This is the regression test for the per-skill rules contract.

**6. Stale-file cleanup on re-install** — installs into a throwaway `$HOME`, plants a canary file inside an installed skill, re-runs `setup.sh`, and confirms the canary is gone. Validates `copy_managed_dir`'s `rm -rf` of kit-managed targets before re-copy.

**7. Migration prompt** (manual — validates interactive UX, not scriptability) — Pre-create `$HOME/.claude/CLAUDE.md` and `$HOME/.codex/AGENTS.md` in a fake `$HOME`, re-run `setup.sh`. Decline → files stay; accept → files removed. The prompt is one-shot per agent home: after either answer, `setup.sh` writes a `.agents-kit-migration-acked` sentinel into the agent's home and won't ask again. To re-test, delete the sentinel (or the whole fake `$HOME`) before the next run.

**8. Plugin install/validate** (automated in CI as `.github/workflows/test-plugin-install.yml`) — runs `claude plugin validate .` against the manifests and `claude plugin install agents-kit@drimchansky-agents-kit --scope user` against the local marketplace. Catches manifest schema errors and any install-time symlink-handling regression, which is where most loader breakage surfaces. Doesn't talk to the model, so no `ANTHROPIC_API_KEY` is required. Runtime invocation of skills (the agent actually emitting `✅ Core rules applied (./AGENTS.md)` mid-session) is **not** covered — for that, run `claude --plugin-dir /path/to/agents-kit` locally and invoke any skill.

## Repo conventions

- The kit is dev-tools-on-unix targeted; symlinks are non-negotiable.
- New top-level files should be paths-only updates in `README.md`'s structure block — keep the prose explanation in "How It Works".
- `references/` is partitioned by domain. Today only `references/engineering/` exists (TypeScript, React, CSS, security, performance, testing, accessibility, code-style, tanstack-query); future domains (e.g. prose, design) can live as sibling subdirectories. Every engineering skill carries the same `## References` block that says "read any applicable checklists from `references/engineering/`", so adding a new engineering checklist requires no per-skill change — it picks up automatically. The prose-only utilities (`proofread`, `translate`) intentionally omit the References block: code-domain checklists don't apply to their work, and there's no prose-domain references subdirectory yet. When you add one, mirror the engineering convention: a per-domain subdirectory and a matching `## References` block in the skills that need it.

## Not in scope (here)

- Don't document end-user / consumer behavior in this file — that belongs in `README.md`.
- Don't restate `CORE_RULES.md` rules here — the rules live in `CORE_RULES.md` and ship to consumers via the skill sibling. This file describes the _contract_ around them, not the rules themselves.

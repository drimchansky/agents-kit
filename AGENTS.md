# Contributing to agents-kit

This file is for **agents and humans working on this repo**. If you're an agent invoked from a _consumer_ project that has installed the kit, this file does not apply to you — your rules come from `./AGENTS.md` inside the skill directory you're running, which resolves to `CORE_RULES.md` at the kit root.

## What this repo is

A kit of skills and shared rules distributed to coding agents (Claude Code, Codex, and others). It ships in two ways:

- **Claude Code plugin marketplace (preferred for end users)** — the repo carries both `.claude-plugin/plugin.json` (plugin manifest) and `.claude-plugin/marketplace.json` (single-entry marketplace whose plugin is sourced from the same repo via `"source": "./"`). End users install with `/plugin marketplace add drimchansky/agents-kit` followed by `/plugin install agents-kit@drimchansky-agents-kit`. To add a future plugin, append a new entry to `marketplace.json`'s `plugins` array with its own schema-valid `source` — no separate marketplace repo needed.
- **Claude Code `--plugin-dir`** — local-dev install against an unreleased clone: `claude --plugin-dir /path/to/agents-kit`.
- **`setup.sh` (manual / non-plugin)** — copies `skills/` and `references/` into each supported agent's home directory (`~/.claude/...`, `~/.codex/...`).

`README.md` covers user-facing structure and installation. This file covers **how to work on the kit**.

## Skill categories

The kit ships two categories of skill, and the Core Rules contract applies to only one of them:

- **Engineering-workflow skills** — operate on code and participate in the understand → plan → implement → review → verify → document loop. They carry the shared rules contract (symlink + directive, see below). Today, in workflow order: `explore`, `refine-idea`, `resume-task`, `design-plan`, `review-plan`, `implement-plan`, `review-code`, `verify-issue`, `update-doc`, `validate-docs`. Preserve the workflow ordering when listing them in docs and when inserting new ones (e.g. a new review-stage skill goes near `review-code`, not at the alphabetical end).
- **Standalone skills** — prose tools and single-purpose utilities that don't touch code and don't follow the engineering loop. They are deliberately self-contained: their `skills/<name>/` holds **only `SKILL.md`**, with **no `AGENTS.md` symlink** and **no Core Rules directive**. All guidance lives inline in `SKILL.md`. Today: `proofread`, `translate`, `fact-check`.

When in doubt, default to the engineering shape — adding the symlink + directive is cheap; retrofitting later is annoying.

## The Core Rules contract (engineering skills only)

The kit's shared rules live in **`CORE_RULES.md`** at the repo root. They're distributed to consumer projects through a per-skill mechanism — not as a global rules file. The contract applies to **engineering-workflow skills**; standalone skills are exempt by design (see "Skill categories" above).

- Each engineering skill's `skills/<name>/AGENTS.md` is a **relative symlink** to `../../CORE_RULES.md`.
- Each engineering skill's `skills/<name>/SKILL.md` opens with a fixed **"Core Rules" directive** that instructs the agent to:
    1. Read the sibling file `./AGENTS.md`.
    2. Apply the rules for the duration of the skill.
    3. Output `✅ Core agents-kit@<version> rules applied` on its own line, before any other text or tool calls. The `<version>` placeholder is substituted at runtime with the value on the **Version** line at the top of `CORE_RULES.md` (which the symlink resolves to).

**Don't break this contract.** When you add or edit an engineering skill:

- The directive block must be present and unmodified at the top of `SKILL.md`, between the closing `---` of the frontmatter and the existing body.
- The sibling `skills/<name>/AGENTS.md` must exist and point at `../../CORE_RULES.md`.
- The check-mark confirmation line is the user's only signal that rules were loaded; if it changes wording, every engineering skill must be updated together. The `<version>` placeholder in the source line stays literal — agents substitute the actual version from CORE_RULES.md at output time.
- **Bumping the kit version:** update `.claude-plugin/plugin.json` and the **Version** line near the top of `CORE_RULES.md` together. They are the two sources of truth; drift between them means the confirmation line shows a stale version. Nothing else needs to change on a version bump — the `<version>` placeholders in skills are stable across releases.

If you want to change the rules themselves, edit `CORE_RULES.md`. The change propagates to all engineering skills automatically — symlinks resolve at read time. There is no build step.

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

2. Decide the category (see "Skill categories" above):
    - **Engineering-workflow skill** (operates on code, participates in the loop) → continue with steps 3–5, then 6.
    - **Standalone skill** (prose tool, single-purpose utility) → write the full skill body in `SKILL.md` and skip directly to step 6. Do **not** add the Core Rules directive block or the `AGENTS.md` symlink.
3. Insert the standard "Core Rules" directive block immediately after the closing `---`. Copy it verbatim from any existing engineering skill (e.g. `skills/explore/SKILL.md`).
4. Write the skill body below the directive. Include a `## References` block — copy the one-liner from another engineering skill (e.g. `skills/explore/SKILL.md`) so the skill participates in the `references/engineering/` auto-pickup described under "Repo conventions".
5. Add the sibling symlink:

    ```
    ln -s ../../CORE_RULES.md skills/<name>/AGENTS.md
    ```

6. Add a row for the new skill in `README.md` — either the engineering-workflow table or the utilities table. The plugin loader and `setup.sh` auto-discover skills from `skills/<name>/SKILL.md` (no manifest registration needed), but `README.md` is hand-curated and won't list the skill otherwise.

## Editing the standard directive

The directive block is hand-edited in every engineering skill's `skills/<name>/SKILL.md`. There's no template engine. If you change its shape (heading text, instruction count, confirmation wording), update every engineering skill in the same change. After editing, **always run the sweep snippet below** — with `scripts/verify.sh` removed, this is the only drift detector for the directive contract, and running it manually after a directive edit is part of the editor's spot-check responsibility (see `## Verifying changes`). Use the presence of the `AGENTS.md` symlink as the engineering-skill criterion so standalone skills are skipped:

```
sweep() { for d in skills/*/; do [ -L "$d/AGENTS.md" ] || continue; grep -L "$1" "$d/SKILL.md"; done; }
sweep "## Core Rules"                                    # should be empty
sweep "✅ Core agents-kit@<version> rules applied"   # should be empty (literal placeholder; runtime substitution is not in source)
```

## Verifying changes

Plugin install/validate is automated in CI via `.github/workflows/test-plugin-install.yml` — it runs `claude plugin validate .` against the manifests and `claude plugin install agents-kit@drimchansky-agents-kit --scope user` against the local marketplace. Catches manifest schema errors and any install-time symlink-handling regression, which is where most loader breakage surfaces. Doesn't talk to the model, so no `ANTHROPIC_API_KEY` is required. Runtime invocation of skills (the agent actually emitting `✅ Core agents-kit@<version> rules applied` mid-session, with the version interpolated) is **not** covered — for that, run `claude --plugin-dir /path/to/agents-kit` locally and invoke any skill.

Beyond CI, contract-critical things the editor of a change is responsible for spot-checking before opening a PR (run the relevant snippet whenever the listed surface is touched):

- **Symlink contract** — every engineering skill's `skills/<name>/AGENTS.md` is a real symlink to `../../CORE_RULES.md`. Verify with `ls -la skills/*/AGENTS.md`. Catches the Windows-without-`core.symlinks` regression and accidental file-instead-of-symlink commits.
- **Directive contract** — every engineering skill's `SKILL.md` carries the `## Core Rules` heading and the `✅ Core agents-kit@<version> rules applied` confirmation line (literal `<version>` placeholder; substituted at runtime). Use the `sweep` snippet under "Editing the standard directive" above.
- **Plugin manifests** — `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` parse as JSON and contain the keys the kit relies on (`name`/`description`/`version` for the plugin; `name`/`owner`/`plugins` for the marketplace).
- **Fresh install layout** — `setup.sh` against a throwaway `$HOME` should produce no global `~/.claude/CLAUDE.md` or `~/.codex/AGENTS.md`, and real-file `AGENTS.md` copies under `~/.<agent>/skills/<name>/`.
- **Migration prompt** — pre-create `$HOME/.claude/CLAUDE.md` in a fake `$HOME`, run `setup.sh`. Decline → file stays; accept → file removed. One-shot per agent home (sentinel `.agents-kit-migration-acked`).

## Repo conventions

- The kit is dev-tools-on-unix targeted; symlinks are non-negotiable.
- New top-level files: describe them in `README.md`'s `## How It Works` section (prose, one bullet per file in the same shape as the existing entries for `CORE_RULES.md`, `skills/<name>/AGENTS.md`, etc.). The README has no separate file-tree block — `## How It Works` is the canonical spot.
- `references/` is partitioned by domain. Today only `references/engineering/` exists (TypeScript, React, CSS, review, security, performance, testing, accessibility, code-style, tanstack-query, task-lifecycle); future domains (e.g. prose, design) can live as sibling subdirectories. Every engineering skill carries the same `## References` block that says "read any applicable checklists from `references/engineering/`", so adding a new engineering checklist requires no per-skill change — it picks up automatically. Standalone skills (`proofread`, `translate`, `fact-check`) intentionally omit the References block: code-domain checklists don't apply to their work, and there's no prose-domain references subdirectory yet. When you add one, mirror the engineering convention: a per-domain subdirectory and a matching `## References` block in the skills that need it.

## Not in scope (here)

- Don't document end-user / consumer behavior in this file — that belongs in `README.md`.
- Don't restate `CORE_RULES.md` rules here — the rules live in `CORE_RULES.md` and ship to consumers via the skill sibling. This file describes the _contract_ around them, not the rules themselves.

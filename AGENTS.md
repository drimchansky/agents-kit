# Contributing to agents-kit

This file is for **agents and humans working on this repo**. If you're an agent invoked from a _consumer_ project that has installed the kit, this file does not apply to you — your rules come from `./AGENTS.md` inside the skill directory you're running, which resolves to `CORE_RULES.md` at the kit root.

## What this repo is

A kit of skills and shared rules distributed to coding agents (Claude Code, Codex, and others). It ships through `setup.sh`, which copies `skills/` and `references/` into each supported agent's home directory (`~/.claude/...`, `~/.codex/...`).

`README.md` covers user-facing structure and installation. This file covers **how to work on the kit**.

## Skill categories

The kit ships two categories of skill, and the Core Rules contract applies to only one of them:

- **Engineering-workflow skills** — operate on code and participate in the understand → plan → implement → review → verify → document loop. They carry the shared rules contract (symlink + directive, see below). Today, in workflow order: `explore`, `refine-idea`, `resume-task`, `plan-task`, `review-plan`, `implement-plan`, `review-code`, `audit`, `verify-issue`, `review-docs`. Preserve the workflow ordering when listing them in docs and when inserting new ones (e.g. a new review-stage skill goes near `review-code`, not at the alphabetical end).
- **Standalone skills** — prose tools and single-purpose utilities that don't touch code and don't follow the engineering loop. They are deliberately self-contained: their `skills/<name>/` holds **only `SKILL.md`**, with **no `AGENTS.md` symlink** and **no Core Rules directive**. All guidance lives inline in `SKILL.md`. Today: `proofread`, `translate`, `fact-check`.

When in doubt, default to the engineering shape — adding the symlink + directive is cheap; retrofitting later is annoying.

## The Core Rules contract (engineering skills only)

The kit's shared rules live in **`CORE_RULES.md`** at the repo root. They're distributed to consumer projects through a per-skill mechanism — not as a global rules file. The contract applies to **engineering-workflow skills**; standalone skills are exempt by design (see "Skill categories" above).

- Each engineering skill's `skills/<name>/AGENTS.md` is a **relative symlink** to `../../CORE_RULES.md`.
- Each engineering skill's `skills/<name>/SKILL.md` opens with a fixed **"Core Rules" directive** that instructs the agent to:
    1. Read the sibling file `./AGENTS.md`.
    2. Apply the rules for the duration of the skill.
    3. Output `✅ Core agents-kit rules applied` on its own line, before any other text or tool calls.

**Don't break this contract.** When you add or edit an engineering skill:

- The directive block must be present and unmodified at the top of `SKILL.md`, between the closing `---` of the frontmatter and the existing body.
- The sibling `skills/<name>/AGENTS.md` must exist and point at `../../CORE_RULES.md`.
- The check-mark confirmation line is the user's only signal that rules were loaded; if it changes wording, every engineering skill must be updated together.

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

6. Add a bullet for the new skill in `README.md` — either the engineering-workflow list or the utilities list. `setup.sh` auto-discovers skills from `skills/<name>/SKILL.md` (no manifest registration needed), but `README.md` is hand-curated and won't list the skill otherwise.

## Editing the standard directive

The directive block is hand-edited in every engineering skill's `skills/<name>/SKILL.md`. There's no template engine. If you change its shape (heading text, instruction count, confirmation wording), update every engineering skill in the same change. The one-liner below is a fast local check while iterating on the directive text; use the presence of the `AGENTS.md` symlink as the engineering-skill criterion so standalone skills are skipped:

```
sweep() { for d in skills/*/; do [ -L "$d/AGENTS.md" ] || continue; grep -L "$1" "$d/SKILL.md"; done; }
sweep "## Core Rules"                       # should be empty
sweep "✅ Core agents-kit rules applied"   # should be empty
```

## Verifying changes

The contracts the kit depends on:

- **Symlink contract** — every engineering skill's `skills/<name>/AGENTS.md` is a real symlink whose target is `../../CORE_RULES.md`. Catches the Windows-without-`core.symlinks` regression and accidental file-instead-of-symlink commits.
- **Directive contract** — every engineering skill's `SKILL.md` carries the `## Core Rules` heading and the `✅ Core agents-kit rules applied` confirmation line.
- **Standalone exemption** — standalone skills (`proofread`, `translate`, `fact-check`) deliberately have no `AGENTS.md` symlink and no `## Core Rules` heading in `SKILL.md`.

**Manual spot-check before opening a PR (needs a throwaway `$HOME`):**

- **Fresh install layout** — `setup.sh` against a throwaway `$HOME` produces real-file `AGENTS.md` copies under `~/.<agent>/skills/<name>/` (the `cp -RfL` dereference worked, no dangling symlinks).

## Repo conventions

- The kit is dev-tools-on-unix targeted; symlinks are non-negotiable.
- `references/` is partitioned by domain. Today only `references/engineering/` exists (TypeScript, React, CSS, review, security, performance, testing, accessibility, code-style, tanstack-query, task-lifecycle, acceptance-criteria); future domains (e.g. prose, design) can live as sibling subdirectories. Every engineering skill carries the same `## References` block that says "read any applicable checklists from `references/engineering/`", so adding a new engineering checklist requires no per-skill change — it picks up automatically. Standalone skills (`proofread`, `translate`, `fact-check`) intentionally omit the References block: code-domain checklists don't apply to their work, and there's no prose-domain references subdirectory yet. When you add one, mirror the engineering convention: a per-domain subdirectory and a matching `## References` block in the skills that need it.

## Not in scope (here)

- Don't document end-user / consumer behavior in this file — that belongs in `README.md`.
- Don't restate `CORE_RULES.md` rules here — the rules live in `CORE_RULES.md` and ship to consumers via the skill sibling. This file describes the _contract_ around them, not the rules themselves.

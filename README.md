# Agents Kit

A set of skills, agent definitions, and a task workflow for Claude Code and Codex. One command installs the same kit into both `~/.claude` and `~/.codex`, and every task gets a folder on disk (ticket, context, goals, plan, result) that any later session on either host can pick up, review, or finish. You stop re-explaining a task to each new session, and the rules an agent follows live in one place instead of in scattered prompts.

- **Two hosts, one install.** `node setup.ts` copies the skills, references, core rules, and native agent definitions into `~/.claude` and `~/.codex`. A rerun reclaims only what the kit installed and leaves your own skills untouched.
- **Zero dependencies.** Plain Node 23.6 or newer running `.ts` directly under type stripping. No `package.json`, no build step, no `node_modules`.
- **Persistent task folders.** A task is `.agents/tasks/<slug>/` holding `ticket.md`, `CONTEXT.md`, `goals.md`, `plan.md`, `result.md`. Plan it in one session, implement it in the next, resume or reconcile it from either host.
- **32 skills** covering the whole loop: idea, ticket, plan, implement, review, triage, fix, commit, rebase, PR, plus proofreading, translation, diagrams, and Notion pages.
- **Domain packs.** Methodology is domain-neutral; engineering and documentation rules load as packs from `references/<domain>/`, and a new domain is a sibling directory, not a skill rewrite.

---

## Getting started

**Requirements:** Node 23.6 or newer, and Claude Code and/or the Codex CLI.

1. Clone the kit and run the installer:

   ```sh
   git clone git@github.com:drimchansky/agents-kit.git
   cd agents-kit
   node setup.ts
   ```

   Over HTTPS: `git clone https://github.com/drimchansky/agents-kit.git`.

   The installer prints every home it touched and every item it installed or skipped. It exits 0 when both homes installed and 1 when a home was skipped.

   ```text
   Installing into /Users/you/.claude:
     archive-task
     backlog-task
     ...
     references
     CORE_RULES.md
     agents/executor
     agents/reviewer
   Installing into /Users/you/.codex:
     ...
   Done.
   ```

2. Open a project in Claude Code or Codex and start a task:

   ```text
   /plan-task Add rate limiting to the public API
   ```

   The plan lands in `.agents/tasks/<slug>/` inside the project. Follow it with `/implement-task <slug>`.

3. Optional: register the directories that hold your task folders so that `resume-task`, `maintain`, and the other discovery-driven skills see all of them:

   ```text
   /init-config
   ```

   It previews the delta to `~/.config/agents-kit/config.json` and writes only after you confirm.

4. To update, pull and rerun the installer:

   ```sh
   git pull && node setup.ts
   ```

---

## The task workflow

Every task is one flat folder named for its slug, canonically `.agents/tasks/<slug>/` at the project root. Skills find the files by their fixed names:

```
.agents/tasks/<slug>/
├── ticket.md        # optional: the product-facing ask
├── CONTEXT.md       # static grounding: problem, assumptions, references, open questions
├── goals.md         # acceptance criteria — G1…Gn, what "done" means
├── plan.md          # the contract: scope, steps, verification; carries **Status:**
├── observations.md  # optional, derived: last observed state of cited external references
└── result.md        # a rewritable current-state block above an append-only log: what happened, acceptance, completion date
```

Only `plan.md` carries a status, drawn from a closed vocabulary: `to-do`, `executing`, `blocked`, `in-review`, `done`, `skipped`. Skills hand the slug to each other, so the sequence is `prepare-ticket` → `refine-idea` (when the ask still needs sharpening) → `plan-task` → `review-task` → `implement-task`, with `resume-task` and the reconcile skills covering any session in between. Finished tasks move to `Archive/`, parked ones to `Backlog/`.

A task's `CONTEXT.md` names a **domain**. That selects a pack under `references/<domain>/` whose guidance loads on top of the neutral `CORE_RULES.md`. The `engineering` pack (the default) carries rules, exploration, planning, execution, and verification; the `documentation` pack is deliberately partial and carries rules, verification, and format checklists.

---

## Skills

Each skill is `skills/<name>/SKILL.md`, invoked as `/<name>` in Claude Code and by mentioning `$<name>` in Codex. Five are gated so the model never invokes them on its own; you have to name them.

**Task workflow**

- `prepare-ticket` — turn a described task into a self-contained ticket with acceptance criteria, optionally seeding a task folder.
- `refine-idea` — sharpen a vague idea before planning.
- `decompose-task` — split an approved design doc into ordered sibling task folders; proposes first, writes on confirmation.
- `plan-task` — write `goals.md` and `plan.md` for a task, scaffolding `CONTEXT.md` when missing.
- `review-task` — sanity-check a plan against its context, goals, and reality. Read-only.
- `implement-task` — execute a plan step by step and write `result.md`.
- `resume-task` — brief you on a task's state. Read-only.
- `reconcile-task` — write back into the task folder what the session learned, and recheck cited links.
- `resume-task-reconcile`, `review-task-reconcile` — the briefing or the review, then the reconcile, in one command.
- `backlog-task`, `archive-task` — park an unstarted task, or file a finished one. Gated.

**Code**

- `implement` — build, fix, or change something directly, without a task folder.
- `explore` — walk through code, a library, a protocol, or a concept.
- `verify-issue` — confirm or refute a reported bug.
- `review-code` — review a PR, branch, commit range, or set of paths. Flags: `-n N` independent reviewers, `-x` cross-vendor second review, `-d` draft a PR description.
- `review-code-triage-verify` — review, batch the findings by concern, verify each batch in an isolated probe, one verdict per finding.
- `triage-findings`, `triage-findings-verify` — batch findings you already have, optionally verifying each batch.
- `fix-findings` — apply a set of findings; confirmed ones automatically, the rest through one batched ask.
- `publish-pr-review` — post `review-code`'s findings to the PR as inline comments, by severity tier.
- `update-pr-description` — replace a PR body with the description `review-code -d` drafted. Gated.
- `commit` — commit staged changes after inspecting them and running the applicable checks. Never stages, never pushes.
- `rebase` — rebase onto a confirmed base, or resume a paused rebase, preserving signing.

**Writing**

- `proofread` — check a message or document; `-f` also verifies facts.
- `translate` — translate text between languages.
- `review-docs` — audit existing documentation against the codebase.
- `review-note` — validate and deepen a personal knowledge-base note.
- `prepare-diagram` — generate a Mermaid diagram for a code flow, architecture, or process.
- `create-notion-page` — draft and create a Notion page through the session's Notion tools.

**Kit**

- `init-config` — discover task roots on disk and reconcile them into `~/.config/agents-kit/config.json`. Gated.
- `maintain` — the monthly ritual: task health, install drift, uncommitted work, leftover worktrees, and agent misbehavior triaged from recent sessions. Report-first. Gated.

---

## Agents

Two native agent definitions ship with the kit, installed as `agents/*.md` for Claude Code and `agents/*.toml` for Codex:

- `executor` — the write-mode worker. Carries out one coordinator-supplied unit of work and returns evidence under the shared executor contract.
- `reviewer` — the read-plus-verify reviewer that `review-code` and the triage-verify composite launch, possibly N at a time over the same object.

---

## References and rules

- `CORE_RULES.md` — the domain-neutral rules every workflow skill loads first: scope discipline, ask before assuming, push back when warranted, build only what's asked.
- `references/workflow/` — the cross-skill methodology: task layout and lifecycle, context schema, execution loop, reconciliation, agent fan-out, probe shapes, reviewer and executor contracts.
- `references/engineering/` — the engineering pack: code style, TypeScript, React, CSS, HTML, forms, accessibility, performance, security, privacy, testing, verification, review.
- `references/documentation/` — the documentation pack: rules, verification, ADR and RFC formats, Mermaid cheatsheets.
- `references/templates/` — copy-ready shapes of the five task files.
- `references/scripts/` — the CLI and stdout contract of every helper a skill runs at run time.

Inside an installed skill, `./AGENTS.md` links to `CORE_RULES.md` and `./references` links to the installed `references/`, so a skill reads the same files wherever it runs. The four lean utilities — `create-notion-page`, `proofread`, `review-note`, `translate` — ship neither link and state the one rule each needs in place.

---

## Maintaining the kit

`AGENTS.md` is the maintainer guide: who owns which contract, how changes route, and why each script is shaped the way it is. The sources carry no comments, so that file and `references/scripts/` are where the reasoning lives.

Run the whole verification surface:

```sh
node --test "tests/*.test.ts"
```

After editing any prose, run the duplicate scan. It fails when two files in the corpus share a sentence, which is what a rule restated away from its owner looks like:

```sh
node scripts/dup-check.ts .
```

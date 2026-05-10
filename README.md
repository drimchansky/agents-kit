# Agents Kit

A personal kit for working with Claude Code, Codex, and other coding agents.

## Getting started

Install via the plugin marketplace from inside Claude Code:

```
/plugin marketplace add drimchansky/agents-kit
/plugin install agents-kit@drimchansky-agents-kit
```

For local development against an unreleased clone: `claude --plugin-dir /path/to/agents-kit`.

For Codex or non-plugin install of Claude Code, see [docs/manual-install.md](docs/manual-install.md).

## Skills

Skills are organized into two groups: an **engineering workflow** (9 skills) that shapes the development loop, and a set of **utilities** (3 skills) for ad-hoc tasks.

### Engineering workflow

The workflow runs roughly in order, but you don't need every step — pick whichever fits the task.

- [`explore`](skills/explore/SKILL.md) — Understand existing code or context before changing it. _Example: `/explore how does the retry queue work?`_
- [`refine-idea`](skills/refine-idea/SKILL.md) — Sharpen a rough idea before planning — assumptions, MVP scope, "Not Doing" list. _Example: `/refine-idea add a draft mode to the editor`_
- [`resume-task`](skills/resume-task/SKILL.md) — Brief on, resume, or hand off a task — read `.agents/tasks/<slug>/` and report in chat. _Example: `/resume-task auth-jwt-migration`_
- [`plan-task`](skills/plan-task/SKILL.md) — A change is non-trivial and needs a contract. Writes paired `.agents/tasks/<slug>/<task-slug>.spec.md` (acceptance criteria) and `<task-slug>.plan.md` (steps). _Example: `/plan-task migrate auth to JWT`_
- [`review-plan`](skills/review-plan/SKILL.md) — Confirm the implementation direction is right and still in sync with `CONTEXT.md`, the spec, and the current codebase; surface any drift between plan assumptions and code reality. _Example: `/review-plan auth-jwt-migration`_
- [`implement-plan`](skills/implement-plan/SKILL.md) — A validated plan is ready to ship. Marks steps `[x]`, writes a `*.result.md`, and runs an acceptance gate against the spec before flipping the plan to `done`. _Example: `/implement-plan auth-jwt-migration`_
- [`review-code`](skills/review-code/SKILL.md) — Code is written and needs an audit before merge — bugs, blast radius, pattern fit. _Example: `/review-code`_
- [`verify-issue`](skills/verify-issue/SKILL.md) — A reported bug needs to be confirmed and root-caused before a fix. _Example: `/verify-issue users see 500 on signup`_
- [`review-docs`](skills/review-docs/SKILL.md) — Audit a doc against the codebase and surface stale references, gaps, and drift. Applies fixes only when you ask after seeing the review. _Example: `/review-docs README`_

### Task directories

`refine-idea`, `plan-task`, `review-plan`, and `implement-plan` share a directory-based contract that lets them hand off cleanly; `resume-task` reads from the same directory but never mutates it. Each effort lives in `.agents/tasks/<slug>/` with a shared `CONTEXT.md`, paired `*.spec.md` + `*.plan.md` files, and append-only `*.result.md` records. The spec carries the acceptance criteria; `implement-plan` runs an acceptance gate against it before flipping the plan to `done`.

See [docs/task-directories.md](docs/task-directories.md) for the full contract.

### Reference checklists

The kit ships domain checklists in `references/engineering/` that engineering skills (especially `implement-plan` and `review-code`) consult when relevant.

See [docs/reference-checklists.md](docs/reference-checklists.md) for the list and conventions.

### Utilities

Standalone skills that aren't tied to the engineering loop:

- [`proofread`](skills/proofread/SKILL.md) — Polishing a message, email, or piece of writing for grammar, clarity, and factual accuracy. _Example: `/proofread` (paste text)_
- [`translate`](skills/translate/SKILL.md) — Moving content between languages while preserving tone and context. _Example: `/translate to Spanish`_
- [`fact-check`](skills/fact-check/SKILL.md) — Verifying factual claims against trustworthy live sources on the internet — not against pretraining. _Example: `/fact-check` (paste claim)_

---

For details on how skills load shared rules and how `setup.sh` orchestrates the install, see [docs/how-it-works.md](docs/how-it-works.md).

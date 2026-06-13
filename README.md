# Agents Kit

A personal kit for working with Claude Code, Codex, and other coding agents.

## Getting started

Install the kit into Claude Code and Codex with the setup script:

```bash
git clone git@github.com:drimchansky/agents-kit.git ~/agents-kit
~/agents-kit/setup.sh
```

## Skills

Skills are organized into two groups: a **workflow** (11 skills) that shapes the work loop, and a set of **utilities** (5 skills) for ad-hoc tasks. The workflow is **domain-neutral** — a spine of methodology skills plus a few engineering-specific review skills — and pulls domain knowledge from a *domain pack*. Engineering is the first and reference pack; see [Domain packs](#domain-packs).

### Workflow

The workflow runs roughly in order, but you don't need every step — pick whichever fits the task. The six spine skills (`explore`, `refine-idea`, `resume-task`, `plan-task`, `review-task`, `implement-task`) are domain-neutral; the diff/review skills (`review-commit`, `review-pr`, `audit`, `verify-issue`, `review-docs`) are engineering-specific.

- [`explore`](skills/explore/SKILL.md) — Understand existing code or context before changing it. _Example: `/explore how does the retry queue work?`_
- [`refine-idea`](skills/refine-idea/SKILL.md) — Sharpen a rough idea before planning — assumptions, MVP scope, "Not Doing" list. _Example: `/refine-idea add a draft mode to the editor`_
- [`resume-task`](skills/resume-task/SKILL.md) — Brief on, resume, or hand off a task — read the resolved task directory and report in chat. _Example: `/resume-task auth-jwt-migration`_
- [`plan-task`](skills/plan-task/SKILL.md) — A change is non-trivial and needs a contract. Writes paired `<task-slug>.spec.md` (acceptance criteria) and `<task-slug>.plan.md` (steps) in the resolved task directory. _Example: `/plan-task migrate auth to JWT`_
- [`review-task`](skills/review-task/SKILL.md) — Confirm the direction is right and still in sync with `CONTEXT.md`, the spec, and current reality; surface drift between the plan's assumptions and the work itself. _Example: `/review-task auth-jwt-migration`_
- [`implement-task`](skills/implement-task/SKILL.md) — A validated plan is ready to ship. Marks steps `[x]`, writes a `*.result.md`, and runs an acceptance gate against the spec before flipping the plan to `done`. _Example: `/implement-task auth-jwt-migration`_
- [`review-commit`](skills/review-commit/SKILL.md) — Staged changes need a sanity check before commit — correctness, completeness, accidental inclusions, pattern fit; also drafts the commit message. _Example: `/review-commit`_
- [`review-pr`](skills/review-pr/SKILL.md) — A branch needs review against its base — bugs, blast radius, pattern fit, with PR context pulled from GitHub when available. _Example: `/review-pr`_
- [`audit`](skills/audit/SKILL.md) — Audit an existing module or whole project for structure, patterns, and health — no diff, no recent-change focus. _Example: `/audit src/auth` or `/audit` (whole project)_
- [`verify-issue`](skills/verify-issue/SKILL.md) — A reported bug needs to be confirmed and root-caused before a fix. _Example: `/verify-issue users see 500 on signup`_
- [`review-docs`](skills/review-docs/SKILL.md) — Audit a doc against the codebase and surface stale references, gaps, and drift. Applies fixes only when you ask after seeing the review. _Example: `/review-docs README`_

### Task directories

`refine-idea`, `plan-task`, `review-task`, and `implement-task` share a directory-based contract that lets them hand off cleanly; `resume-task` reads from the same directory but never mutates it. A standalone effort lives in `.agents/tasks/<slug>/` with a shared `CONTEXT.md`, paired `*.spec.md` + `*.plan.md` files, and append-only `*.result.md` records. The spec carries the acceptance criteria; `implement-task` runs an acceptance gate against it before flipping the plan to `done`. Related efforts can be grouped under a project directory with a shared `PROJECT.md` (linked from each task's `CONTEXT.md` via a `**Project:**` header), and completed or `skipped` tasks can be moved into an `archive/` subdirectory; see `references/workflow/task-layout.md` for the layout and discovery rules. `CONTEXT.md` also carries a `**Domain:**` marker (default `engineering`) that selects which domain pack the skills load, and a plan that can't proceed — waiting on something external, or stuck on an unresolved failure — takes the `blocked` status; both are registered in `references/workflow/task-lifecycle.md`.

### Domain packs

The workflow spine is domain-neutral; domain-specific knowledge lives in a pack under `references/<domain>/` — a `rules.md` overlay plus exploration / planning / execution / verification / review guidance and any checklists. A task's `**Domain:**` marker selects the pack (default `engineering`). Engineering is the reference pack; a new domain (relocation, negotiation, …) is added by dropping in `references/<domain>/` and authoring tasks with that `**Domain:**` — no spine change. When a domain has no pack, the skills run the neutral methodology and say so. See `references/workflow/domain-packs.md`.

### Reference checklists

References under `references/` split into the neutral methodology and the domain packs. `references/workflow/` holds methodology every domain shares — `task-lifecycle` (status registry), `task-layout` (on-disk layout), `domain-packs` (how domains plug in), `acceptance-criteria` (the "done" bar) — consulted by the spine skills. `references/engineering/` is domain pack #1: a `rules` overlay, the `exploration` / `planning` / `execution` / `verification` / `review` bodies the spine loads by phase, and per-surface checklists (typescript, react, css, html, forms, interactions, tanstack-query, security, privacy, performance, accessibility, testing, code-style) — most-used by `implement-task`, the skill that produces the work product.

### Utilities

Standalone skills that aren't tied to the engineering loop:

- [`proofread`](skills/proofread/SKILL.md) — Polishing a message, email, or piece of writing for grammar, clarity, and factual accuracy. _Example: `/proofread` (paste text)_
- [`translate`](skills/translate/SKILL.md) — Moving content between languages while preserving tone and context. _Example: `/translate to Spanish`_
- [`fact-check`](skills/fact-check/SKILL.md) — Verifying factual claims against trustworthy live sources on the internet — not against pretraining. _Example: `/fact-check` (paste claim)_
- [`refine-idea-chat`](skills/refine-idea-chat/SKILL.md) — Chat-only sibling of `refine-idea`: sharpen a rough idea through diverge/converge/sharpen phases without writing anything to disk. _Example: `/refine-idea-chat add a draft mode to the editor`_
- [`review-note`](skills/review-note/SKILL.md) — Reviewing a personal knowledge base note on any subject — surfaces inaccuracies, gaps, and clarifications that deepen understanding. Proposes fixes; doesn't edit. _Example: `/review-note notes/stoicism.md`_

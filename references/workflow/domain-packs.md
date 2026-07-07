# Domain Packs: Neutral Spine + Pluggable Domains

How the workflow separates a **domain-neutral methodology spine** from **domain-specific
knowledge**, and how skills load the right knowledge for the task at hand. **This file is the
single source of truth for the domain-pack interface.** When the pack file set, the resolution
rule, or the spine/pack skill split changes, update it here first and propagate to the skills.
Status vocabulary lives in `task-lifecycle.md`; on-disk task layout lives in `task-layout.md`;
this file covers which body of domain knowledge a skill loads and how it finds it.

## The split

The spine skills (`explore`, `refine-idea`, `plan-task`, `review-task`, `implement-task`,
`resume-task`, `reconcile-task`) carry **methodology only** — how to understand a problem, define "done", sequence
work, validate, execute, record, and brief. Nothing in their prose assumes a particular domain.
Everything domain-specific — what to explore, how to slice work, what "verify" means, which
quality checklists apply — lives in a **domain pack** under `references/<domain>/`.

Engineering is the first and reference domain pack: `references/engineering/`. New domains are
added as sibling directories without touching the spine.

## What a domain pack provides

A pack is a directory `references/<domain>/` holding, by convention:

- **`rules.md`** — the domain rules overlay, loaded on top of neutral `CORE_RULES.md`.
- **`exploration.md`** — how to "explore the domain's reality" before planning (what sources to
  read, what to confirm, how to map blast radius / dependencies).
- **`planning.md`** — domain planning specifics: how to slice work, step-size caps, what a
  checkpoint asserts.
- **`execution.md`** — how to carry out and record one step in this domain.
- **`verification.md`** — what "verify a step / criterion" means here, plus the domain's
  acceptance-gate recipe.
- **`review.md`** — the domain's review lenses (used by review/audit skills).
- **per-surface checklists** — any number of focused checklists the domain consults situationally
  (engineering ships `typescript.md`, `react.md`, `css.md`, `security.md`, …).

A pack need not provide every file. A skill that asks for a pack file that doesn't exist treats it
as "no domain-specific guidance for this phase" and proceeds on the neutral methodology (see
**Missing-pack fallback**). `references/engineering/` is the worked example — model new packs on it.

## Resolving the active domain

The active domain is declared by a **`**Domain:**`** header in the task's `CONTEXT.md`, written
just under `**Status:**`:

```markdown
# <task name>

**Status:** refined
**Domain:** engineering
```

- **Default is `engineering`.** A `CONTEXT.md` with no `**Domain:**` header resolves to
  `engineering` — this keeps every existing task working unchanged.
- A skill loads the pack by reading `CONTEXT.md` (which it already does), taking the
  `**Domain:**` value, and reading the relevant files under `references/<domain>/`.
- Resolution is by **header value, not directory shape** — `**Domain:**` is read straight from the
  `CONTEXT.md` header, the same way `**Status:**` is (see `task-lifecycle.md`), never inferred from
  where a file sits. A skill never inspects the filesystem to guess a domain.

## Which skills resolve a domain vs. hardcode engineering

- **Spine skills** — `explore`, `refine-idea`, `plan-task`, `review-task`, `implement-task`,
  `resume-task`, `reconcile-task` — resolve `**Domain:**` and load the matching pack. `explore` resolves a domain
  only when one is relevant to the question; it has no task folder and often answers
  domain-neutrally.
- **Engineering-only skills** — `audit`, `review-commit`, `commit`, `review-pr`, `review-docs`,
  `verify-issue` — operate on a codebase or diff, not a task folder, and load
  `references/engineering/` unconditionally. They are, in effect, skills contributed by the
  engineering pack; a future domain may contribute its own skills the same way.
- **Format skills** — `migrate-task-format`, `archive-task` — operate on the task-folder
  *envelope* (file names, layout, link-headers, status vocabulary, archive location), not on any
  task's domain content. They read the neutral core but resolve **no** `**Domain:**` pack: the
  on-disk format is identical across every domain, so there is no overlay to load. Their source of
  truth is `task-layout.md` + `task-lifecycle.md`, read at run time.

## Load order

For a spine skill acting on a task:

1. Read `./AGENTS.md` (the neutral `CORE_RULES.md`) and apply it — always.
2. Resolve `**Domain:**` from `CONTEXT.md` (default `engineering`).
3. Read `references/<domain>/rules.md` and apply it on top of the neutral core.
4. As each phase of the skill calls for it, read the matching pack file
   (`exploration.md` before exploring, `execution.md` / `verification.md` before executing and
   verifying, etc.).

Engineering-only skills skip step 2 and use `engineering` directly. Format skills
(`migrate-task-format`, `archive-task`) run only step 1 — they apply the neutral core and resolve
no domain pack.

## Missing-pack fallback

When a resolved domain has no pack (e.g. a task marked `**Domain:** relocation` before a
relocation pack exists), or a pack omits a file a phase asks for:

- **State it, don't fabricate.** Say plainly that no `references/<domain>/` pack (or no such file)
  was found, and that you are proceeding on the neutral methodology only.
- **Never invent domain rules, checklists, or a verification recipe** to fill the gap. The neutral
  spine is sufficient to run the task; domain depth is an enhancement, not a precondition.
- **Don't silently fall back to engineering.** A non-engineering task must not inherit
  engineering's rules (stack detection, typecheck/lint gates, Git discipline) just because the
  engineering pack is the most complete one. Absence of a pack means *less* guidance, not *other*
  guidance.

## Adding a new domain

1. Create `references/<domain>/` and add whichever pack files apply — start with `rules.md` and
   `verification.md`; add `exploration.md` / `planning.md` / `execution.md` / `review.md` and
   checklists as the domain warrants. Model the shape on `references/engineering/`.
2. Author tasks with `**Domain:** <domain>` in their `CONTEXT.md`.
3. If the domain needs its own skills (a non-linear domain like negotiation may want a strategy
   skill rather than the linear `plan-task`), add them under `skills/` and list them here under
   the skill split.
4. No spine change is required. `setup.sh` copies `references/` wholesale, so a new pack installs
   automatically.

---
name: migrate-task-format
description: Use when asked to migrate, update, normalize, or upgrade existing `.agents/tasks/` task folders to the current task-workflow format after the conventions have changed.
argument-hint: '[target project path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.

This skill operates on the **task-folder envelope** — file names, directory layout, link-headers, and status vocabulary — not on a task's domain content. It deliberately does **not** resolve a `**Domain:**` pack: the on-disk format is the same for every task regardless of its domain, so there is no domain-specific overlay to load. Its source of truth is `./references/workflow/task-layout.md` (layout and discovery) and `./references/workflow/task-lifecycle.md` (status vocabulary), read **at run time** — never a hardcoded list of past formats.

This skill brings existing task folders under `.agents/tasks/` into conformance with the **current** task-workflow format. The format evolves over time (e.g. slug-prefixed files were flattened to role-named files, and the `PROJECT.md` grouping layer was removed), so old folders in a project drift out of shape. The skill reads the live format spec from the reference docs, scans the target project's task folders, classifies each as **conformant / structurally-fixable / needs-judgment**, previews the planned changes, and — only on confirmation — applies the **lossless structural** fixes. Anything that needs human judgment (redistributing shared context, extracting acceptance criteria) is flagged with a recommended action and left untouched.

**CRITICAL**:

- **Reconcile against the live docs, not memory.** Determine "conformant" by reading `task-layout.md` + `task-lifecycle.md` at run time. Never enforce a format rule that has no home in those docs — if you believe a rule exists but can't find it there, surface that gap instead of inventing the rule.
- **Preview before apply.** The scan/classify/preview phase mutates nothing on disk. Files are renamed, edited, or moved only after the user confirms the previewed plan.
- **Structural-only.** Apply only lossless transforms (renames, capitalization, link-header rewrites, archive moves). Never auto-derive content — flag judgment cases and stop.
- **Never half-migrate.** A folder with any judgment issue is left entirely untouched until the issue is resolved; don't apply its structural fixes in isolation, since a partial migration can strand content.
- **Never touch git.** No add, commit, checkout, stash, or `git mv`. Edits are working-tree only; the user reviews via `git diff` and commits.
- **`archive/` is a container, not a task.** Exclude it from the active scan; migrate an archived folder only when the user names it explicitly.

## When to Use

**Use when:**

- The task-workflow format changed and existing `.agents/tasks/` folders in a project need to be brought up to date
- You inherited a project whose task folders predate the current layout/status conventions
- A spine skill (`resume-task`, `plan-task`, `implement-task`) is tripping over a folder that doesn't match today's layout

**Skip when:**

- The project has no `.agents/tasks/` folder yet — there's nothing to migrate
- A single folder needs a content change that requires judgment (extracting a spec, redistributing project context) — do that by hand; this skill only flags it
- You want to *read* a task's state, not change its shape → use `resume-task`

## Process

### 1. Load the target format spec

Read the two reference docs that define the current format, and treat them as the **only** source of truth:

- `./references/workflow/task-layout.md` — directory layout, file role-names, link-headers, `archive/`, multi-part siblings, discovery rules.
- `./references/workflow/task-lifecycle.md` — the `**Status:**` vocabulary for `CONTEXT.md` / `plan.md` / `result.md`, and the `spec.md` "no status" rule.

Derive the conformance checklist from them at run time. As of this writing the current format is:

- A task is a **flat** folder `.agents/tasks/<slug>/`; the folder name is the slug.
- Four role-named files, found by fixed name: `CONTEXT.md` (capitalized), `spec.md`, `plan.md`, `result.md` (lowercase). **No `<slug>.` prefix.**
- In-folder link-headers use `./`-relative role-name targets: `**Context:** [./CONTEXT.md](./CONTEXT.md)`, `**Spec:** [./spec.md](./spec.md)`, `**Plan:** [./plan.md](./plan.md)`, `**Result:** [./result.md](./result.md)`.
- `**Status:**` values are drawn from the lifecycle vocabulary; `spec.md` carries none.
- A multi-part effort is **sibling folders** (optionally `NN-` prefixed) with no shared layer — no `PROJECT.md`, no `**Project:**` header, no cross-folder links.
- Archived tasks live at `.agents/tasks/archive/<slug>/`.

Re-derive this list from the docs rather than trusting the summary above — the docs are authoritative and may have moved on. **If you find a format rule you believe should hold but it has no home in either doc** (it lives only in a spine skill's prose), say so in the preview and do not enforce it; reconcile only what the docs define.

### 2. Resolve the target and scan

- **Target project root.** Use the path the user gave; otherwise the current project. The task root is `<target>/.agents/tasks/`. If it doesn't exist, report there's nothing to migrate and stop.
- **List candidate folders** directly under `.agents/tasks/`, **excluding `archive/`** (a container, not a task — see `task-layout.md` discovery rules). Migrate an archived folder only if the user names it explicitly.
- For each candidate, read whatever task files it contains — any of `CONTEXT.md`, `spec.md` / `*.spec.md`, `plan.md` / `*.plan.md`, `result.md` / `*.result.md`, and, for old shapes, `PROJECT.md` and nested subdirectories.

### 3. Classify each folder

Diff each folder against the §1 checklist and assign exactly one label:

- **conformant** — already matches the current format. Nothing to do.
- **structurally-fixable** — differs *only* by lossless structural transforms, all of which §5 can apply automatically:
    - file names carry a `<slug>.` prefix (`<slug>.spec.md` → `spec.md`, and so on);
    - a file's capitalization is wrong (`context.md` / `Context.md` → `CONTEXT.md`);
    - an in-folder link-header points at an old target (a prefixed name, or a non-`./` path);
    - an archived task sits under an old archive path and only needs relocating to `.agents/tasks/archive/<slug>/`.
- **needs-judgment** — differs in a way that **cannot** be resolved losslessly, so it is flagged and left untouched (§6):
    - a `PROJECT.md` grouping (a `PROJECT.md` file, a `**Project:**` header, and/or nested task subdirectories) — collapsing it requires redistributing shared context;
    - a plan carrying inline acceptance criteria with no sibling `spec.md` — extracting the spec is a judgment call;
    - a `**Status:**` value that isn't in the current vocabulary and has no obvious 1:1 mapping;
    - any shape you can't confidently match to the checklist.

**Precedence:** if a folder has *any* needs-judgment issue, classify it **needs-judgment** even when it also has structural issues — do not split the difference. Resolving the judgment issue by hand and re-running picks up the structural fixes safely. This is the rule that prevents a half-migration from stranding content.

### 4. Preview (dry-run — mutates nothing)

Before changing anything, print a per-folder preview:

- the folder name and its label;
- for **structurally-fixable** — the exact operations §5 will perform: each `old path → new path` rename and each header rewrite, as a concrete list;
- for **needs-judgment** — the specific issue found and the recommended manual action (§6);
- for **conformant** — a one-line "no changes".

End with a summary count (`N conformant, M structurally-fixable, K needs-judgment`) and an explicit confirmation prompt. **Nothing is written, renamed, or moved until the user confirms.** If the user declines, stop with no changes.

### 5. Apply lossless structural fixes (on confirmation)

Only after the user confirms the preview, and only for **structurally-fixable** folders, perform the previewed operations. Each is lossless and idempotent — an already-correct file or folder is skipped, so a re-run (or a resumed partial run) converges instead of double-applying.

**Rename slug-prefixed files to role names** (the folder name is the slug):

- `<slug>.spec.md` → `spec.md`
- `<slug>.plan.md` → `plan.md`
- `<slug>.result.md` → `result.md`
- fix capitalization: `context.md` / `Context.md` → `CONTEXT.md`

Use a plain filesystem rename. If a destination role-named file already exists, **don't overwrite it** — report the collision and skip that file (a sign the folder is partly migrated or hand-edited; leave it for the user).

**Rewrite in-folder link-headers** to `./`-relative role-name targets, in every task file that carries them:

- `**Context:**` → `[./CONTEXT.md](./CONTEXT.md)`
- `**Spec:**` → `[./spec.md](./spec.md)`
- `**Plan:**` → `[./plan.md](./plan.md)`
- `**Result:**` → `[./result.md](./result.md)`
- result-step links pointing at a prefixed result name (`./<slug>.result.md#…`) → the role-named target (`./result.md#…`), **preserving the anchor**.

Rewrite only the link **target** — never the surrounding prose or the status value.

**Normalize archive placement** for an archived task the user named explicitly: move the whole folder to `.agents/tasks/archive/<slug>/`. Moving a folder preserves its internal `./` links, so nothing inside needs rewriting.

**Idempotency & safety invariants:**

- A file or folder already in the target shape is a **no-op** — re-running on a conformant folder changes nothing.
- **Never touch git.** No `add`, `commit`, `checkout`, `stash`, or `git mv`. All changes are plain working-tree edits; the user reviews with `git diff` and commits when satisfied.
- **Never delete content.** Renames move files; header rewrites change only the link target. Nothing is removed.
- **Stay inside `.agents/tasks/`.** Don't touch source code, docs, or anything outside the task folders.

After applying, each migrated folder satisfies the §1 checklist. Report what changed, per folder.

### 6. Report needs-judgment cases (never auto-fix)

For each **needs-judgment** folder, print the specific issue and a concrete recommended manual action. **Touch nothing** — these are content and judgment changes the skill must not make.

**`PROJECT.md` grouping** (a `PROJECT.md`, a `**Project:**` header, and/or nested task subdirectories):

> Old project-grouped layout. The current format (`task-layout.md`) has no shared layer — multi-part efforts are independent sibling folders, with anything shared duplicated into each task's `CONTEXT.md`. To migrate by hand:
> 1. For each nested task, distribute the relevant shared context from `PROJECT.md` into that task's `CONTEXT.md` (its `## References` and any standing decisions).
> 2. Remove the `**Project:**` header from each `CONTEXT.md`.
> 3. Move each task folder up to `.agents/tasks/<slug>/` (prefix with `NN-` if the parts have a blocking order).
> 4. Delete the now-empty `PROJECT.md` / project folder.
> 5. Re-run this skill to apply the remaining structural fixes to the lifted folders.

Do **not** flatten the directories yourself — flattening without step 1 strands the shared context.

**Inline acceptance criteria, no `spec.md`** (a plan with an `## Acceptance Criteria` section and no sibling spec file):

> This plan carries its acceptance criteria inline. The current format keeps them in a separate `spec.md` (`task-lifecycle.md`: the spec is a distinct artifact with no status). To migrate by hand: create `spec.md` from the criteria block (`**Plan:** [./plan.md](./plan.md)`, a short description, the criteria as bullets), remove the inline block from the plan, then re-run this skill for any remaining structural fixes.

**Unmappable `**Status:**` value** (a value not in the current vocabulary, with no obvious 1:1 mapping):

> `<file>` has `**Status:** <value>`, which isn't in the current vocabulary (`task-lifecycle.md`: <the valid values for that file>). Map it by hand to the intended state, then re-run.

**Anything else you can't confidently classify:** describe what you saw and why it doesn't match the §1 checklist, and recommend the user resolve it by hand. Never guess a transform.

After listing the judgment cases, remind the user that re-running the skill once they're resolved will pick up any structural fixes in the same folders.

## Output Template

Print the preview as a per-folder list, then a summary and an explicit confirmation prompt. After the user confirms, print the same shape with the applied outcomes.

```markdown
# migrate-task-format — <target>/.agents/tasks/

## Preview

- `add-csv-export/` — **conformant** — no changes
- `legacy-export/` — **structurally-fixable**
    - rename `legacy-export.spec.md` → `spec.md`, `legacy-export.plan.md` → `plan.md`, `legacy-export.result.md` → `result.md`
    - rewrite `**Spec:**` / `**Result:**` headers and the result-step link to `./` role-name targets
- `checkout-redesign/` — **needs-judgment** — PROJECT.md grouping
    - <recommended manual action (§6)>
- `inline-criteria-task/` — **needs-judgment** — inline criteria, no spec.md
    - <recommended manual action (§6)>

**Summary:** 1 conformant, 1 structurally-fixable, 2 needs-judgment. (`archive/` excluded.)

Apply the structural fixes? Nothing changes until you confirm.
```

## Don't Rationalize

- "I'll just flatten the PROJECT.md dirs — the content move is obvious" — Distributing shared context is lossy judgment. Flag the whole grouping and leave it untouched; don't half-migrate.
- "The folder is mostly conformant, I'll apply the structural fixes and flag the rest" — A folder with any judgment issue is needs-judgment, period. Partial migration can strand content. Resolve the judgment issue, then re-run for the structural pass.
- "I'll apply the renames, then show the user" — Preview first; apply only on confirmation. This skill mutates real work products.
- "I'll enumerate the old formats I know and match those" — Reconcile against the live docs, not a memorized catalogue. The docs are the only source of truth that stays current.
- "I'll commit the migration so it's saved" — Never touch git. Edit the working tree; the user reviews with `git diff` and commits.
- "This rule isn't in the docs but I know it's the format — I'll enforce it" — If a rule has no home in `task-layout.md` / `task-lifecycle.md`, surface the gap; don't invent format from memory.
- "The destination file already exists, I'll overwrite it with the prefixed one" — A collision means the folder is partly migrated or hand-edited. Skip and report; don't clobber.

## Verification

- [ ] Loaded the target format from `references/workflow/task-layout.md` + `task-lifecycle.md` at run time; no hardcoded catalogue of past formats
- [ ] Scanned `.agents/tasks/` excluding `archive/`; every active folder labelled conformant / structurally-fixable / needs-judgment
- [ ] A folder with any judgment issue classified needs-judgment (no half-migration), even when it also has structural issues
- [ ] Preview printed; nothing created, renamed, edited, or moved before the user confirmed
- [ ] On confirm, each structurally-fixable folder conforms to `task-layout.md` — role-named files (no `<slug>.` prefix), `./`-relative link-headers, correct capitalization
- [ ] Result-step links rewritten to the role-named target with the anchor preserved
- [ ] A destination-name collision was reported and skipped, never overwritten
- [ ] needs-judgment folders reported with a concrete recommended action and left untouched
- [ ] Re-running on a conformant folder changed nothing (idempotent)
- [ ] No git state mutated (no add, commit, checkout, stash, git mv); no file outside `.agents/tasks/` touched
- [ ] Any format rule with no home in the ref docs surfaced, not invented

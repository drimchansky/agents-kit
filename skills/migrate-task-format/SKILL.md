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
- **Structural-only.** Apply only lossless transforms (renames, capitalization, link-header rewrites). Never auto-derive content — flag judgment cases and stop.
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
- `./references/workflow/task-lifecycle.md` — the `**Status:**` vocabulary for `CONTEXT.md` / `plan.md` / `result.md`, and the `goals.md` "no status" rule.

Derive the conformance checklist from the docs at run time — don't migrate against a remembered format. Read each value out of the docs every run; the **dimensions** to check stay fixed even as their values evolve:

- **Folder shape** — is each task a flat folder `.agents/tasks/<slug>/`, the folder name being the slug? (`task-layout.md`)
- **Role files** — the set of role-named files, their exact spelling and capitalization, and the rule that no stem prefix remains. (`task-layout.md`)
- **Link-headers** — which `**Header:**` lines exist and that each points at its `./`-relative role-name target. (`task-layout.md`)
- **Status vocabulary, per file** — read it from `task-lifecycle.md`, which gives each status-bearing file a **distinct** vocabulary: `CONTEXT.md` carries a one-shot *origin marker*, `plan.md` and `result.md` carry *lifecycle states* (a different pool), and `goals.md` carries **no** status. A value valid for one file is not automatically valid on another — check each file against its own column.
- **Multi-part layout** — sibling folders (optionally `NN-` prefixed), with whatever shared-layer rule the docs currently state. (`task-layout.md`)
- **Archive** — the single archive path the docs define, and the discovery rule that excludes it. (`task-layout.md`)

Read the current value of each dimension from the docs rather than assuming the shape it had last time — they are authoritative and may have moved on. **If you find a format rule you believe should hold but it has no home in either doc** (it lives only in a spine skill's prose), say so in the preview and do not enforce it; reconcile only what the docs define. You can only *auto-apply* the lossless transforms §5 enumerates: if a folder deviates in a way none of them covers — even a lossless deviation the docs newly introduced — classify it needs-judgment and note that the skill needs a new transform; never improvise one.

### 2. Resolve the target and scan

- **Target is a project root, not a task.** This skill takes the path to a *project* (the directory that contains `.agents/`), defaulting to the current project. Sanity-check the argument first: if the user passed a task folder or a bare slug (e.g. `legacy-export` or `.agents/tasks/legacy-export`) — recognizable because it *is* a task folder or names one, rather than containing an `.agents/` directory — don't silently append `/.agents/tasks/` to it (that yields a bogus nested path and a false "nothing to migrate"). Stop and ask the user for the project root, or to name an archived folder explicitly if that's what they meant.
- **Resolve the task root** as `<target>/.agents/tasks/`. If it doesn't exist, report there's nothing to migrate and stop.
- **List candidate folders** directly under `.agents/tasks/`, **excluding `archive/`** (a container, not a task — follow `task-layout.md`'s discovery rules rather than restating them). Migrate an archived folder only if the user names it explicitly. **If the scan finds zero active candidates** (the root is empty, or holds only `archive/`), report "nothing active to migrate" and stop — don't fall through to an empty preview and a confirm prompt for zero fixes.
- For each candidate, read whatever task files it contains — any of `CONTEXT.md`, `goals.md` (or a legacy `spec.md` / `*.spec.md`), `plan.md` / `*.plan.md`, `result.md` / `*.result.md`, and, for old shapes, `PROJECT.md` and nested subdirectories.

### 3. Classify each folder

Diff each folder against the §1 checklist and assign exactly one label:

- **conformant** — already matches the current format. Nothing to do.
- **structurally-fixable** — differs *only* by lossless structural transforms, all of which §5 can apply automatically:
    - a role file carries a **stem prefix** (`<anything>.plan.md` → `plan.md`, and so on) — match by the `.spec.md` / `.plan.md` / `.result.md` suffix, not by assuming the prefix equals the current folder slug (a folder renamed after its files won't match its own slug);
    - an already goal-shaped legacy goals file named `spec.md` / `*.spec.md` (has a `## Goals` list whose bullets already carry durable `G<n>` IDs), or a `**Spec:**` link-header inside an otherwise conformant task — the old goals-file name/header; renaming to `goals.md` / `**Goals:**` is a lossless transform (§5);
    - a role file's **case** is wrong (`context.md` / `Context.md` → `CONTEXT.md`; `Plan.md` / `PLAN.MD` → `plan.md`; a wrong `.MD` extension) and only needs normalizing to the canonical case;
    - an in-folder link-header points at an old target (a prefixed name, or a non-`./` path) **and actually carries a link** — a `**Result:**` (or any header) that is still a prose placeholder, not a link, is conformant for that lifecycle state and is left alone (see §5).
- **needs-judgment** — differs in a way that **cannot** be resolved losslessly, so it is flagged and left untouched (§6):
    - a `PROJECT.md` grouping (a `PROJECT.md` file, a `**Project:**` header, and/or nested task subdirectories) — collapsing it requires redistributing shared context;
    - a plan carrying inline acceptance criteria with no sibling `goals.md` — extracting goals (and assigning durable `G<n>` IDs) is a judgment call;
    - a `goals.md` (or legacy `spec.md` / `*.spec.md`) whose goals carry **no durable `G<n>` IDs**, or whose legacy spec still uses the old free-form description/criteria shape — assigning IDs or reshaping criteria into goals is content derivation, never a lossless transform;
    - a `plan.md` whose steps carry no `**Goal:**` citation line — back-filling citations maps steps to goals by judgment;
    - a `**Status:**` value not in *that file's* current vocabulary (per `task-lifecycle.md`, checked against its own column — origin marker for `CONTEXT.md`, lifecycle state for `plan.md` / `result.md`) — **always** judgment, even when a 1:1 mapping looks obvious, because §5 has no lossless status rewrite so remapping is never auto-applied;
    - a `goals.md` (or legacy `spec.md`) carrying any `**Status:**` header — it must have none, and removing the line deletes content, so flag it rather than stripping it;
    - a **destination-name collision** — a prefixed, wrong-case, or legacy-named file whose target role name is already occupied by a *distinct* file (e.g. both a legacy `spec.md` and a hand-edited `goals.md`) — since renaming would clobber or half-migrate, flag the whole folder;
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

**Rename prefixed and wrong-case files to their role names** — match each file by its role suffix, never by assuming the prefix is the folder slug:

- `*.spec.md` (any stem) **or** a legacy `spec.md` → `goals.md` only when the file is already goal-shaped (has a `## Goals` list with durable `G<n>` IDs); old free-form specs are needs-judgment, not an auto-rename
- `*.plan.md` (any stem) → `plan.md`
- `*.result.md` (any stem) → `result.md`
- fix case: `CONTEXT.md` must be capitalized, `goals.md` / `plan.md` / `result.md` lowercase, with a `.md` extension — e.g. `context.md` / `Context.md` → `CONTEXT.md`, an already goal-shaped legacy `Spec.md` / `SPEC.MD` → `goals.md`.

Use a plain filesystem rename. **A case-only difference is the rename to perform, not a collision** — on a case-insensitive filesystem (macOS default) `Context.md` and `CONTEXT.md` resolve to the same path, so don't read the destination as "already existing"; rename via a temp name (`Context.md` → `_tmp` → `CONTEXT.md`) if the OS won't do a direct case-only rename. A **genuine** collision — a *distinct* file already holding the destination role name with different content — is caught at classify time (§3), not here: such a folder is **needs-judgment** and left entirely untouched. Never rename some of a folder's files while skipping a collided one; that is the half-migration the skill forbids.

**Rewrite in-folder link-headers** to `./`-relative role-name targets — but only where the header **already carries a link** to an old target. A header that is an intentional prose placeholder, not a link, is left exactly as-is:

- `**Context:**` → `[./CONTEXT.md](./CONTEXT.md)`
- `**Goals:**`, or a legacy `**Spec:**`, → `[./goals.md](./goals.md)` (the `**Spec:** → **Goals:**` rename is lossless)
- `**Plan:**` → `[./plan.md](./plan.md)`
- `**Result:**` → `[./result.md](./result.md)` — **only if it is already a link**. A fresh `to-do` plan legitimately carries `**Result:** _(populated by implement-task: link to ./result.md)_` because no result file exists yet; that placeholder is conformant — never replace it with a link to a `result.md` that isn't there.
- result-step links pointing at a prefixed result name (`./<stem>.result.md#…`) → the role-named target (`./result.md#…`), **preserving the anchor** (the anchor is heading-derived, not slug-derived, so it carries over verbatim).

Rewrite only the link **target** — never the surrounding prose, a placeholder, or the status value.

**Archived folders.** When the user names an archived folder explicitly, apply the same in-place renames and header rewrites to it as to any other folder; it stays where it is. Do **not** invent or "normalize" an archive path: `task-layout.md` defines a single archive location and no predecessor, so there is no old-path relocation to perform (enforcing one would violate the CRITICAL rule against format that has no home in the docs).

**Idempotency & safety invariants:**

- A file or folder already in the target shape is a **no-op** — re-running on a conformant folder changes nothing.
- **Never touch git** (see CRITICAL) — all changes are plain working-tree edits; the user reviews with `git diff` and commits.
- **Never delete content.** Renames move files; header rewrites change only the link target. Nothing is removed.
- **`result.md` stays append-only.** Rewriting a stale link **target** in its header block, or renaming the file, is the one allowed exception — it never edits or reorders the execution record itself. Don't touch the step entries' content.
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

**Inline acceptance criteria, no `goals.md`** (a plan with an `## Acceptance Criteria` / inline criteria section and no sibling goals file):

> This plan carries its acceptance criteria inline. The current format keeps them in a separate `goals.md` (`task-lifecycle.md`: the goals file is a distinct artifact with no status). To migrate by hand: create `goals.md` from the criteria block as a `## Goals` list of `- G<n> — <outcome>` bullets (no `## Description`), following the goals shape `task-layout.md` / `task-lifecycle.md` define, assign each goal a durable `G<n>` ID, remove the inline block from the plan, then re-run this skill for any remaining structural fixes.

**Out-of-vocabulary `**Status:**` value** (any value not in *that file's* column in `task-lifecycle.md`, even one that looks like an obvious rename):

> `<file>` has `**Status:** <value>`, which isn't in its current vocabulary (`task-lifecycle.md`: <the valid values for that file>). Remapping a status is a judgment call the skill won't auto-apply — set it by hand to the intended state, then re-run.

**`goals.md` (or legacy `spec.md`) carrying a `**Status:**`** (the goals file must have none):

> `goals.md` carries `**Status:** <value>`, but the goals file is a static input with no lifecycle (`task-lifecycle.md`). Removing the line deletes content, so decide by hand whether to drop it or move the state onto the plan, then re-run.

**Goals file with no durable `G<n>` IDs** (a `goals.md`, or a renamed legacy `spec.md`, whose goals are plain bullets without IDs):

> The current format gives each goal a durable, never-renumbered `G<n>` ID (`task-layout.md`), cited by the plan's steps. Assigning IDs to existing goals is content derivation, not a lossless rename — the skill won't guess them. To migrate by hand: number the goals `G1`, `G2`, … in `goals.md`, then re-run.

**Plan steps with no `**Goal:**` citation** (a `plan.md` whose steps predate the citation convention):

> The current step format carries a `**Goal:**` line naming the goal ID(s) the step delivers, or `none (infra/refactor)` (`task-layout.md`). Back-filling these maps each step to the goals it delivers — a judgment call the skill won't auto-apply. To migrate by hand: add a `**Goal:**` line to each step, then re-run.

**Anything else you can't confidently classify:** describe what you saw and why it doesn't match the §1 checklist, and recommend the user resolve it by hand. Never guess a transform.

After listing the judgment cases, remind the user that re-running the skill once they're resolved will pick up any structural fixes in the same folders.

## Output Template

Print the preview as a per-folder list, then a summary and an explicit confirmation prompt. After the user confirms, print the same shape with the applied outcomes.

```markdown
# migrate-task-format — <target>/.agents/tasks/

## Preview

- `add-csv-export/` — **conformant** — no changes
- `legacy-export/` — **structurally-fixable**
    - rename already goal-shaped `legacy-export.spec.md` → `goals.md`, `legacy-export.plan.md` → `plan.md`, `legacy-export.result.md` → `result.md`
    - rewrite `**Spec:**`→`**Goals:**` / `**Result:**` headers and the result-step link to `./` role-name targets
- `checkout-redesign/` — **needs-judgment** — PROJECT.md grouping
    - <recommended manual action (§6)>
- `inline-criteria-task/` — **needs-judgment** — inline criteria, no goals.md
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
- "This rule isn't in the docs but I know it's the format — I'll enforce it" — If a rule has no home in `task-layout.md` / `task-lifecycle.md`, surface the gap; don't invent format from memory (this includes any "old archive path" — the docs define one archive location and no predecessor).
- "The destination file already exists, I'll overwrite it with the prefixed one" — A genuine collision (a distinct file already holding the role name) makes the **whole folder** needs-judgment; leave it entirely untouched and report — don't clobber, and don't rename the folder's other files around it (that half-migrates). A case-only difference is not a collision; it's the rename to perform.
- "The `**Result:**` header isn't a link yet, I'll make it one" — A `to-do` plan's `**Result:** _(populated by implement-task…)_` placeholder is conformant; linking it to a `result.md` that doesn't exist fabricates a dead link. Only rewrite headers that already carry a link.

## Verification

- [ ] Loaded the target format from `references/workflow/task-layout.md` + `task-lifecycle.md` at run time; checked each dimension's current value against the docs, not a remembered catalogue
- [ ] Confirmed the target is a project root (not a task folder or slug); stopped with guidance if not
- [ ] Scanned `.agents/tasks/` excluding `archive/`; stopped with "nothing active to migrate" when the scan found zero candidates
- [ ] Every active folder labelled conformant / structurally-fixable / needs-judgment
- [ ] A folder with any judgment issue — including a latent destination-name collision or an out-of-vocabulary status — classified needs-judgment and left entirely untouched (no half-migration)
- [ ] Status values checked against *each file's own* vocabulary (origin marker for `CONTEXT.md`, lifecycle state for `plan.md` / `result.md`, none for `goals.md`)
- [ ] Preview printed; nothing created, renamed, edited, or moved before the user confirmed
- [ ] On confirm, each structurally-fixable folder conforms to `task-layout.md` — role-named files (no stem prefix), correct case, `./`-relative link-headers
- [ ] Prefixed files matched by role suffix (any stem), not by assuming the prefix equals the folder slug; case-only renames performed without a false collision
- [ ] Already goal-shaped legacy `spec.md` / `*.spec.md` renamed to `goals.md` and `**Spec:**`→`**Goals:**` (lossless); old free-form specs, a goals file lacking durable `G<n>` IDs, or a plan whose steps lack `**Goal:**` citations, classified needs-judgment and never back-filled
- [ ] A `to-do` plan's prose `**Result:**` placeholder left intact (not turned into a link to a nonexistent result file)
- [ ] Result-step links rewritten to the role-named target with the anchor preserved
- [ ] `result.md` execution-record content untouched (only link targets / the filename changed)
- [ ] needs-judgment folders reported with a concrete recommended action and left untouched
- [ ] Re-running on a conformant folder changed nothing (idempotent)
- [ ] No git state mutated (no add, commit, checkout, stash, git mv); no file outside `.agents/tasks/` touched
- [ ] Any format rule with no home in the ref docs surfaced, not invented (incl. no invented "old archive path")

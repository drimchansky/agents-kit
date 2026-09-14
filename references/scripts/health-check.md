# `scripts/health-check.ts`

Reports task health and install drift for `maintain`.

```
node scripts/health-check.ts [--stale-days N] [--result-max-kb N] [--task-max-kb N] [--record-max-kb N] <root> [<root>...]
node scripts/health-check.ts --installs <kit-root> <home> [<home>...]
```

**Contract.** stdout is one JSON object: `{"findings":[…],"scanned":N,"unreadable":N,"unreadablePaths":[…]}`. Task findings are `{check,path,detail,root}`; `root` is the resolved absolute task root. Install findings are `{check,path,detail}`. `scanned` counts task folders or marker-owned items compared. Warnings go to stderr; exit status is always 0, including partial reads.

`unreadablePaths` names absolute paths under walked roots that could not be opened, deduplicated across passes. Treat scanned as a floor when coverage is incomplete; empty findings do not establish a clean store. Unlistable citation targets outside every walked root are excluded from this store-coverage measure.

**Emitted `check` values.** Tasks: `stale`, `done-unarchived`, `started-in-backlog`, `unknown-status`, `legacy-result-status`, `dead-anchor`, `dead-citation`, `citation-form`, `goal-id`, `no-current-state`, `oversized-result`, `oversized-task`, `oversized-record`, `duplicate-slug`, and `nested-task`. `--installs` walks no tasks and emits only `install-drift`.

**Archived and backlogged folders.** Archived tasks count in scanned but receive only duplicate-slug, nested-task, dead-citation, and citation-form checks. Backlogged tasks are exempt only from stale (`../workflow/task-backlog.md`). Both remain subject to slug uniqueness because discovery can resolve them (`../workflow/task-layout.md` § *Discovery rules for skills*).

`nested-task` alone descends into claimed tasks, including archived ones, listing hidden task descendants (`../workflow/task-store.md` § *Shared group context*). Apply container-before-recognition classification (§ *The root registry* there), regardless of misfiled role files.

`done-unarchived` includes terminal tasks in Backlog. `started-in-backlog` covers a plan past to-do, a plan without parseable status, or a planless folder holding result.md.

Age uses the newest `.md` mtime; unreadable files contribute nothing, potentially making a folder look older. Cloning or bulk touches reset ages, so a young mtime does not prove recent work.

`duplicate-slug` spans all roots recursively: one finding per colliding folder, retaining its root and naming peers by absolute directory.

**The two citation checks read every `.md` file sitting directly in the task folder.**

For `dead-citation`, read inline Markdown links with no `<scheme>:` prefix and no bare `#fragment`. Remove fragments, percent-decode targets, and resolve each segment by exact directory-listing case, regardless of filesystem case folding. Leading `/` resolves from the walked root; other link targets resolve from the task folder. Reference-style definitions are not read.

Angle-bracketed targets run through the closing `>` and may contain spaces. Trim padding with `angledTargetText` from `scripts/lifecycle-constants.ts`, also used by `scripts/sweep-scope.ts`.

Citation parsing excludes:

- Fenced content and paired inline code spans. An unclosed backtick run opens no span; adjacent real links remain readable.
- Blockquotes through their blank-line boundary, including lazy continuations. A following ATX heading, list item, or thematic break ends the quote and is read normally.
- Paired HTML comments. Find delimiters only in live lines with inline code blanked, then blank those spans in the raw lines. A delimiter inside a fence or code span cannot consume real prose. An unclosed comment opener opens no span.

The same blanked lines supply plain-text `DECISIONS.md`, `DOC_CONVENTIONS.md`, and `GROUP_CONTEXT.md` citations outside recognized links. Backticked paths are illustrations. Recognized links cover text and target, preventing duplicate plain-text findings.

A plain path must contain `/` before the filename and start with none of `/`, `~`, `./`, or `../`. Resolve it from the walked root holding the citing task. Begin with the narrow path-character run around the filename, widening across preceding spaces until a candidate resolves. This supports group names with spaces. If none resolves, report only the narrow token.

`citation-form` reports:

- Links beginning `../` regardless of resolution, and any other spelling resolving outside the citing folder, including `./../` and mid-path climbs.
- Links naming a store-level document at least one segment below their starting point, as `store-level doc link`.
- Other root-absolute links, as `root-absolute link`, regardless of resolution.

Under `../workflow/one-home.md` § *One home per fact*, `detail` supplies the replacement where expressible:

- A unique target task's bare slug when directly under its walked root or that root's own Archive/Backlog.
- A `./` link for a target inside the citing folder.
- A store-level document's root-relative path, or the target's own root-relative path otherwise.
- The holding root's absolute directory when different from the citing task's root.

Store-root and outside-store targets receive notes, not replacements or empty paths. Dead checked-step links appear under dead-citation and dead-anchor.

**Where the lifecycle is read.** Plan status alone controls lifecycle and unknown-status (`../workflow/task-lifecycle.md` § *`result.md` — no status field*). A result's legacy Status header is reported verbatim as legacy-result-status without vocabulary validation. Without a plan, result existence establishes started work; only its closing `**Completed:**` line with colon and date establishes finished work.

**Walk rules.** Prune node_modules and dotted names except `.agents` at every depth. Directory entries are listed once and passed down; citation resolution may list them again. Coverage paths are deduplicated. Archive anywhere below the store root marks all descendants archived, even Backlog beneath it. Backlog applies only to the immediate parent; tasks under groups or Archive inside it are not parked (`../workflow/task-archiving.md` § *Already archived is asked of the whole path up to the store*).

**What a scan reads.** Skip fenced content in task files. Read status only above the first `##`-or-deeper heading. Step links resolving to tombstone bullets in a Compacted stub count as resolved (`../workflow/reconciliation-compaction.md`).

**The size trigger has one measure.** Oversized-result uses `scripts/task-state.ts`'s exported `resultSize`, matching that script's compaction-plan due measurement.

**The two budget measures have no second reader.** Oversized-task sums on-disk bytes of direct `.md` files, excluding ticket.md and legacy `*.ticket.md`. Oversized-record measures each result `## Step` or `## Full Run` section through the line before the next level-2 heading, including fences. Both trigger strictly above budget, default from `scripts/lifecycle-constants.ts`, accept their respective flags, and exempt archived tasks.

**`--installs` mode** compares marked kit items and kit items wholly absent from a home. An unreadable marker is a coverage gap, not proof of user ownership; compare that item anyway. Ignore `.DS_Store`, `.localized`, `Thumbs.db`, and `._*` sidecars, not dotfiles generally. Marked staging entries are interrupted installs. Compare two symlinks by target; a link on only one side is drift. `setup.ts` preserves skill symlinks and materializes reference symlinks.

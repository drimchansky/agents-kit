---
name: stage-doc
description: Use when a doc task's deliverable needs its Notion staging round — create or refresh the private staging/diff page, keep the scratch-page ledger, and sync the local copy after the user applies. Sharing, moving, locking, live-page applies, and every Slack/Jira send stay the user's.
argument-hint: '[task folder or deliverable path] [optional: full staging page, or diff against the applied page]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is a **documentation-pack skill**: apply `./references/documentation/rules.md` on top of the core unconditionally — no `**Domain:**` resolution; the documentation pack is this skill's domain.

Own the **staging lifecycle** of a doc task's deliverable on Notion: produce or refresh the pre-publication **staging page** or the **diff page** for a review round, record every scratch page in a ledger with its state, and sync the local deliverable back after the user applies changes to the live page. The skill writes only *private* scratch pages and the task folder's own files — everything outward-facing stays the user's.

## When to Use

**Use when:**

- A doc task's deliverable (`adr.md`, `rfc.md`, … — the deliverable role in `./references/workflow/doc-task-files.md`) needs a staging page created or refreshed for review
- A locked/applied published page needs a **diff page** carrying proposed changes
- The user reports having applied staged changes and the local copy / ledger needs the sync-back

**Skip when:**

- The ask is a one-off page with no task folder behind it — that's `create-notion-page` (see *Boundary* below)
- The ask is to share, move, lock, or edit the live page, or to send anything — those are user actions; produce drafts or staged pages instead

## Hard rules — what the user keeps

- **Share, move, lock:** never share a page, move it under a shared parent, change permissions, or lock/unlock. Staged pages are created **private** (no parent) unless the user names a destination in the current request.
- **Live-page applies:** never write to the live/published page. Changes to it are staged as a private diff page; the user applies them.
- **Every Slack / Jira send:** outbound messages and issue mutations are the user's — this skill produces nothing outward (the pack's send & publish discipline).
- **Notion writes go through the session's Notion tools.** None connected → stop and say so; never improvise a write path.

## Boundary: `create-notion-page`

`create-notion-page` is the deliberately minimal, portable utility: draft arbitrary content and create it as a page — no task-folder awareness, no lifecycle, creating is the whole job. This skill is the doc-task counterpart: it stages an **existing deliverable** through review rounds, and the page lifecycle (create / update / recreate), the scratch-page ledger, and the local sync-back are exactly what the utility deliberately lacks. Staging a task deliverable → here. A standalone page → `create-notion-page`.

## Grounding

- Resolve the task folder per `./references/workflow/task-layout.md` and its deliverable per `./references/workflow/doc-task-files.md` — the deliverable role (own status header, optional `**Deliverable:**` plan link-header) and the `**Published:**` pointer line naming which copy is live truth.
- Walk up from the task folder for the store's `DOC_CONVENTIONS.md` (`./references/workflow/task-layout.md` § *Store-level artifacts*). When present, apply its published-page conventions (public-header shape, minimal-public trimming, house style) to what you stage; absent, the kit's generic format bars alone apply.
- Read the deliverable and the task's `result.md` `## Current state` before writing anything — the ledger and the `**Published:**` line say which copy is currently authoritative and which scratch pages already exist.

## Write discipline (Notion)

Two safe paths — pick by the change's shape:

- **Structural or multi-line content** (new sections, reordered blocks, anything whose old or new text spans lines) → **whole-page recreate**: build the entire body in a single `create-pages` call (it handles large, multi-section pages). The previous scratch page is superseded — ledger it as a trash candidate; the URL churns, which is acceptable **pre-share only**.
- **Inline fixes** (swap a URL, reword a phrase, backtick a token) → targeted `update-page` `update_content` search-and-replace, **only when both the old and the new string contain no newlines**.
- **Never** `insert_content` / `replace_content` — they mangle newline-bearing content (`\n` collapses to a literal "n", brackets get escaped, blocks merge broken).
- **Fetch-verify after every write** — fetch the page and confirm the rendering (headings, lists, tables, links, mentions, diagrams). Mangled → recreate via `create-pages`. Never report a write you didn't fetch back.

## Process

### 1. Resolve and read

Resolve the task folder → deliverable → `result.md` `## Current state` → `DOC_CONVENTIONS.md` walk-up. Determine the target: a **full staging page** (pre-publication review) or a **diff page** (changes against an applied/locked page — only the changed sections, with enough surrounding context to apply them by hand).

### 2. Stage

Compose the page content from the deliverable — trimmed to the public form per the store conventions when staging for publication (the local copy keeps full provenance). Write per the discipline above. Fetch-verify.

### 3. Ledger

Record the page in the task's `result.md` `## Current state` `**Pointers:**` as a dated entry — `staging <url> (YYYY-MM-DD, awaiting user)` / `diff <url> (YYYY-MM-DD, awaiting user)` — advancing existing entries (`applied` / `trashed`) rather than duplicating them; name superseded scratch pages as **trash candidates** (trashing is the user's). `./references/workflow/task-lifecycle.md` registers this skill as a `## Current state` writer. If per-page entries would push the block past its ≤1 KB contract, keep `**Pointers:**` to the live page plus the newest scratch page and move the full ledger to dated lines in the result log.

### 4. Sync back (after the user applies)

When the user reports applying staged changes to the live page: fetch the live page and confirm the applied state; fold any user-side edits back into the local deliverable; update the deliverable's `**Published:**` line (which copy is truth, dated); advance the ledger entry to `applied`; name scratch pages ready to trash.

## Don't Rationalize

- "The fix is tiny, I'll patch the live page directly" — Live-page applies are the user's, always. Stage a diff.
- "`update-page` will be fine for this paragraph" — Newline-bearing content mangles. Recreate via `create-pages`.
- "The write returned ok, no need to fetch" — The fetch is the only rendering proof. Verify every write.
- "I'll share the staging page so reviewers can see it" — Sharing is the user's, full stop.
- "The ledger can wait until the round is over" — A scratch page not in the ledger is a page nobody remembers to trash. Record at write time.

## Verification

Confirm the hard rules held before finishing:

- [ ] Only private scratch pages and task-folder files written — no share / move / lock / live-page apply / send
- [ ] Every write took a safe path (whole-page `create-pages`, or newline-free `update_content`) and was fetch-verified
- [ ] Ledger entry recorded or advanced with a date; superseded pages named as trash candidates; `## Current state` stays ≤1 KB (overflow → dated result-log lines)
- [ ] After a sync-back: the local deliverable, its `**Published:**` line, and the ledger all agree with the reported live state

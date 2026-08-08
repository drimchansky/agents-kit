# Task Layout: Directories and Discovery

How task artifacts are arranged on disk, and how skills discover them. **This file is the single source of truth for layout.** Status values and transitions live in the sibling `task-lifecycle.md`; this file covers where files sit and how they're found.

## One task, one flat folder

A task lives in a single flat folder, named for its slug. A task folder is defined by its **contents** — the role-named files below — not by its address: any folder holding them is a task folder, wherever it sits on disk. The **canonical root**, `<project-root>/.agents/tasks/`, is the default location: where skills create task folders when no path is given, and the one root every discovery rule falls back to when this machine registers no others (§ *Discovery rules for skills*). The folder name *is* the slug — the handoff token passed between `prepare-ticket` → `refine-idea` → `plan-task` → `implement-task`; the bare slug suffices for a folder in the canonical root or in any registered one, and the handoff token is the folder's path only when its root is neither. Inside sit the role-named files below, found by their fixed names (never by a path someone typed) — four core files plus three optional role files: an upstream `ticket.md`, a `diagram.md`, and a derived `observations.md`:

```
.agents/tasks/<slug>/        # the canonical default — but any parent directory works
├── ticket.md       # optional: the product-facing ask (upstream origin) — see ticket-format.md
├── CONTEXT.md      # static grounding context (origin marker + inputs)
├── goals.md        # acceptance criteria — what "done" means
├── plan.md         # the contract: scope, steps, verify criteria
├── diagram.md      # optional: the target-state shape the plan builds toward
├── observations.md # optional, derived: last observed state of the cited external references
└── result.md       # rewritable Current-state header + append-only execution log
```

One plan per folder. `CONTEXT.md` is capitalized; `ticket.md`, `goals.md`, `plan.md`, `diagram.md`, `observations.md`, and `result.md` are lowercase. A skill finds each file by its fixed role name (convention/glob), so moving, relocating, or archiving a folder never breaks a path. The in-folder `**Context:**` / `**Goals:**` / `**Plan:**` / `**Result:**` link-headers point at `./CONTEXT.md`, `./goals.md`, `./plan.md`, and `./result.md` — stable `./` links that survive folder moves; when the task has a `ticket.md` or a `diagram.md`, the plan's optional `**Ticket:**` and `**Diagram:**` headers point at `./ticket.md` and `./diagram.md` the same way. Inside `result.md`, the first `##` section is the rewritable `## Current state` block (contract in the sibling `task-lifecycle.md`); everything beneath it is the append-only log.

**The recognition set — what makes a directory a task folder.** This is the single home for that test. Every walker applies it rather than carrying its own list: the discovery rules below, `init-config`'s root discovery, and `scripts/health-check.mjs`. A directory is a task folder when it holds at least one file that is either

- one of the **role names** — `CONTEXT.md`, `goals.md`, `plan.md`, `result.md`, `ticket.md`. `diagram.md` and `observations.md` are derived companions and never establish a folder on their own; or
- a **legacy suffix form** — any file ending `.plan.md`, `.result.md`, `.spec.md`, or `.ticket.md`. These predate the fixed role names and are what `maintain`'s format sweep renames. Nothing new writes them, but the sweep reaches only the kit's own canonical root, so any other root can hold them indefinitely and recognition has to accept them.

A young folder holding only a `ticket.md`, a `CONTEXT.md`, or a hand-authored `goals.md` qualifies — that is the normal state before planning. A directory holding none of these is not a task folder; say so rather than guessing.

## The goals file: durable IDs, cited by step

`goals.md` is the single source of task intent — the testable acceptance criteria for what "done" means (the quality bar lives in the sibling `acceptance-criteria.md`). Every other artifact *references* it by ID rather than restating intent. Its shape:

```markdown
# Goals: <task title>
**Plan:** [./plan.md](./plan.md)

## Goals
- G1 — <testable, observable outcome>
- G2 — <testable, observable outcome>
```

Like the spec it replaces, `goals.md` is a static input — it carries no `**Status:**` field and no `## Description`; the title and the goals themselves carry the intent.

- **Durable, never-renumbered IDs.** Each goal carries a `G<n>` ID assigned once. Removing a goal **retires** its number (a gap is fine — deleting `G2` leaves `G1, G3`); a new goal takes the next free number, never a retired one. This is what lets a plan step cite `G2` and keep pointing at the same goal across user edits between sessions.
- **Optional `(external)` marker.** A goal verified *outside* the agent's session — a human/client sign-off, or a live/production state the agent can't drive in-session — carries an `(external)` token right after its ID: `- G5 (external) — <outcome>`. It is an optional annotation on the bullet (absent = agent-verifiable, the default); the acceptance gate tags such a goal `pending external` and parks the task at the `in-review` state until it's confirmed. Quality bar and rationale live in the sibling `acceptance-criteria.md`; the `in-review` state in `task-lifecycle.md`.
- **Steps cite the goals they deliver.** Every plan step carries a `**Goal:**` line naming the goal ID(s) it delivers (`**Goal:** G1, G3`) — or the explicit escape `**Goal:** none (infra/refactor)` for a step that delivers no user-visible goal. Coverage is then mechanical: every goal ID maps to at least one delivering step, and every non-escaped step to at least one goal.
- **Scope is a partition of goal IDs.** A plan's `## Scope` says which goals it delivers and which it defers, by explicit ID list (e.g. `delivered: G1, G3 · deferred: G4`), instead of re-prosing intent. Do not use ranges: retired goal IDs can leave gaps, so `G1-G3` is ambiguous once `G2` has been removed. Each goal is either in this plan or deferred to another — the partition is what makes goals↔scope drift unwritable.

## The diagram file: optional, dated, drawn only when warranted

`diagram.md` is an **optional** role file holding one diagram of the system the task changes — the target-state *shape*, not the plan's step sequence. A folder may have one or not, and **absence is never a gap**: the same footing a task with no `ticket.md` stands on. `plan-task` draws one when the resolved domain pack's diagram guidance says the change alters structure, and draws none when it doesn't; a domain whose pack ships no diagram guidance never gets one. There is no flag and no "none" marker — the file is there or it isn't.

Its header, followed by one fenced ` ```mermaid ` block:

```markdown
# Diagram: <task title>

**Plan:** [./plan.md](./plan.md)
**Reflects:** <what the picture is true of> — as of <the plan | Step N | the acceptance gate>, YYYY-MM-DD
```

- **No `**Status:**` field.** The diagram has no lifecycle of its own, so it stays out of the status registry and out of the pairing rule (`./task-lifecycle.md`) — the same footing as `goals.md` and `ticket.md`.
- **Currency rides on the dated `**Reflects:**` line**, not on a status. It names what the picture is true of and when that was last confirmed — world-truth, so it appears only timestamped (*One home per fact* below). `plan-task` writes it first anchored `as of the plan` — at creation the picture is a target, not yet an as-built record. `implement-task` re-anchors and re-dates it at each gate that re-checks the diagram; `resume-task` reads it to report freshness.
- **The diagram is the home of the target-state shape** — components, boundaries, and flows. Rationale stays in `CONTEXT.md`'s Recommended Direction and execution order in `plan.md`'s Steps; the plan's `**Diagram:**` link-header points here instead of re-prosing the component list. A diagram that merely restates the steps' edit surfaces is the derived duplicate *One home per fact* exists to prevent, not a diagram.
- **What it depicts, at what altitude, when a change warrants one, and the notation itself are the domain pack's** (`../engineering/planning.md` for code work). Nothing in the spine carries diagram knowledge.

## The observations file: optional, derived, rewritten by the sweep

`observations.md` is an **optional** derived role file holding the last observed state of every external reference the task folder cites **from an actionable surface** (`./reconciliation.md` § *External reference check* names them; links frozen in prior `result.md` sections — everything below `## Current state` bar an active `**Blocked:**` / `**In review:**` section — and in `goals.md` are out of scope) — one dated line per URL, written by the reconcilers' external reference check and rewritten **wholesale** on each sweep (`./reconciliation.md` § *External reference check*); nothing in it is appended or hand-maintained. A folder may have one or not, and **absence is never a gap**: it means no sweep has run yet, or nothing is cited from an actionable surface. There is no `**Status:**` field — the `_Swept:_` line carries currency — and the file sits outside the pairing rule (`./task-lifecycle.md`), the same footing as `diagram.md`.

Its shape:

```markdown
# Observations: <task title>

**Plan:** [./plan.md](./plan.md)
_Swept: YYYY-MM-DD_

- [info] [Jira CRM-123](https://example.atlassian.net/browse/CRM-123) — "Add CSV export", In Progress (observed YYYY-MM-DD)
- [info] [Design doc](https://example.notion.site/…) — "Export formats", last edited YYYY-MM-DD (observed YYYY-MM-DD); auth required — re-check manually (attempted YYYY-MM-DD)
- [warn] [PR #482](https://github.com/org/repo/pull/482) — merged (observed YYYY-MM-DD)
- [block] [Spec doc](https://docs.google.com/document/d/…) — 404, gone (observed YYYY-MM-DD)
```

- **It is the home of observed external-reference state** (*One home per fact* below): the sweep records what it saw here, and every other surface cites or digests it — never as a second home, and never as undated durable prose. The timestamped surfaces an observation may *also* appear on are enumerated once in *One home per fact* below; this bullet doesn't restate them. Sitting outside that list is the scratch-page ledger `stage-doc` owns — dated entries for the staging pages that skill creates and advances itself (`./task-lifecycle.md`); the sweep observes its `**Pointers:**` entries like any other citation and never takes the ledger over, while entries the block's ≤1 KB budget pushes out into the result log leave the sweep's scope along with them (`./reconciliation.md` § *External reference check*). The URL on each line is the citation's key, not a second home for the identifier — the identifier stays on its citing surface (`CONTEXT.md`'s `## References`, a `plan.md` step, the result's `**Pointers:**` or its active `**Blocked:**` / `**In review:**` section (`./reconciliation.md` § *External reference check* defines *active*), `ticket.md`'s References, or a deliverable's `**Published:**` line).
- **Every line is a dated cache, never live verification.** Readers — `resume-task`'s brief above all — quote a line with its date; freshness is re-derived only by the next sweep.
- **A fetch that established nothing carries its line forward, tag included** — the previous observation with its own date *and its own tag*, plus the dated failed attempt (`auth required`, `unreachable — <error>`), as the second `info` line above shows; a carried `warn` or `block` stays a `warn` or `block` (`./reconciliation.md` § *External reference check*), since the failed attempt established nothing that would soften it. That carry-forward is why the sweep reads this file before rewriting it; a first sweep with nothing to carry records the attempt alone, tagged `info`.

## One home per fact

Within a task folder, each piece of information lives in exactly **one** file — its home — and the sibling files **cite** it rather than restate it. The goals file above is the worked example (goal intent lives in `goals.md`; every other artifact cites `G<n>` IDs). The same rule holds across the artifacts:

- **The ask** — the product-facing statement of what's required (the requester's framing, and the acceptance criteria as plain sentences) — lives in `ticket.md` when the task has one (see `./ticket-format.md`). It is the upstream origin: `CONTEXT.md`'s Problem Statement cites it, and `goals.md` is derived by sharpening its criteria into `G<n>` IDs.
- **Grounding** — problem statement, chosen direction and its rationale, key assumptions, scope rationale and "Not Doing" reasons, external references, and open questions raised before planning — lives in `CONTEXT.md` (when a `ticket.md` is present, the problem statement is the ticket's, and `CONTEXT.md` cites it and carries the rest).
- **Acceptance** — what "done" means — lives in `goals.md`, cited by `G<n>` ID.
- **Execution contract** — steps, verify criteria, checkpoints, risks to execution, and the **plan-time deltas**: findings, decisions, and questions that surfaced during planning and aren't already in `CONTEXT.md` — lives in `plan.md`.
- **History** — what happened — lives in `result.md`.
- **An answer is recorded where its question lives** — a resolved `CONTEXT.md` open question is annotated there; a resolved plan-time question, in the plan. Never both.
- **External-system facts** — a fact about a system outside the folder (a PR, a branch, a commit, a ticket, a deploy) splits into two classes. The *identifier* — PR number, branch name, SHA, ticket key, URL — is a durable **pointer**: its home is whichever surface cites it — the result's `## Current state` `**Pointers:**` line for the task's own delivery vehicle, its active `**Blocked:**` / `**In review:**` section for what the task awaits, `CONTEXT.md`'s `## References` for grounding links, a `plan.md` step for a link that step's own execution leans on, `ticket.md`'s References for the upstream ask's, or a deliverable's `**Published:**` line for its published copy (§ *Doc-task files* below). The *state* of that system — open/merged/green/deployed/closed — is world-truth, not doc-truth: for a **fetchable citation on an actionable surface** (`./reconciliation.md` § *External reference check*) its home is the folder's `observations.md` (§ *The observations file* above), where every observation appears dated; a bare branch/SHA pointer has no ledger line (the file is keyed by URL) and is re-derived from the repo on demand instead. Either way it may appear elsewhere only **timestamped** — digested in the rewritable `## Current state` block or inside a dated log entry as history — never as undated durable prose. Freshness is re-derived only by the reconcilers' sweep, which rewrites `observations.md` (`./reconciliation.md` § *External reference check*); `resume-task` quotes the ledger's dated lines without fetching and drift-checks the on-disk claims (read-only, sweeping no citations), and `stage-doc` refreshes the scratch-page entries it owns (`./task-lifecycle.md`).
- **Cross-folder citations: a task by its slug, a store-level doc by its root-relative path.** `./` links survive folder moves; links *between* folders do not — archiving relocates one side. The two cases are stated separately because one form does not cover both:
    - **Another task → its bare slug**, nothing else. A slug survives the move *and* the archiving that breaks a path, and resolves against every registered root (§ *Discovery rules for skills*). A task's location is never part of the citation.
    - **A store-level doc → its path from the root that holds it**, as plain text — e.g. `Hub/Account Management/DECISIONS.md`, not a relative link. A store-level doc has no slug to be cited by (§ *Store-level artifacts*), so the path form stays for it alone.

Cite a sibling with a `./` link naming the section — `see [CONTEXT § Recommended Direction](./CONTEXT.md)` — the same stable within-folder links the file headers use. Copying a sibling's content authors future drift: two copies of one fact disagree as soon as either is edited. `review-task` flags restated grounding as cross-file drift; the fix is to keep the copy in the fact's home and collapse the other to a citation.

The rule is **within one folder** only. Across sibling task folders the opposite holds: there is no shared layer above the folders, so anything a sibling needs is duplicated into its own `CONTEXT.md` (see *Multi-part efforts* below). Self-sufficiency is the folder's property, not the file's.

## Doc-task files

A documentation task (`**Domain:** documentation` — an RFC, ADR, or other document effort) grows role-named files beyond the four core artifacts. These are the blessed roles. *One home per fact* holds throughout: the deliverable is the **content's** home, `result.md` stays the home of history and world-truth pointers, and any claim about an external copy's state appears only dated.

- **Deliverable** — the work product itself, role-named for its kind: `adr.md`, `rfc.md`, or another clearly role-named doc. It carries its **own status header** (`**Status:** Draft / Proposed / Accepted / Superseded` — the *document's* lifecycle, with acceptance provenance in the local copy; a separate axis from the plan's and result's task lifecycles in `task-lifecycle.md`). The plan may point at it with an optional `**Deliverable:**` link-header (`**Deliverable:** [./adr.md](./adr.md)`), mirroring the optional `**Ticket:**` header. **Resolving it never depends on that header**, so every skill finds the same file whether or not the plan carries one: the deliverable is the folder's `.md` outside the seven fixed-name role files (`CONTEXT.md`, `goals.md`, `plan.md`, `result.md`, `ticket.md`, `diagram.md`, `observations.md`) that **carries its own `**Status:**` header** — a `**Status:**` line in the file's own header block, directly under the `#` title and above the first `##` section, never one inside fenced or quoted content, so a patch-instruction doc quoting a target's header is not a candidate. That header is the discriminator, because no other role below has one: outbound drafts and patch-instruction docs carry a per-draft send-state marker instead, and dossiers and evidence files carry neither. Two candidates in one folder is a layout error to surface, not to guess between. Format bars live in the documentation pack (`../documentation/adr-format.md`, `../documentation/rfc-format.md`).
- **Published pointer** — when a copy of the deliverable lives outside the folder (typically a page in the org's doc tool), the deliverable's header declares which copy is live truth with a dated `**Published:**` line: the page URL plus the authority claim — e.g. `**Published:** <url> — page is live truth (applied 2026-07-28)`, or `… — local ahead of the page since 2026-07-28`. Exactly one side is authoritative at a time; every stage / apply / sync-back flips or re-dates the line. The pointer (URL) is durable; the authority claim is world-truth and therefore dated — the same discipline as *External-system facts* above.
- **Outbound drafts** — content authored to be **sent or applied by the user**: outreach messages, ticket-description drafts, reply drafts (`outreach.md`, `jira-drafts.md`, …). Paste-ready; one or more drafts per file. Each draft carries a dated **send-state** marker beside it in the file — `draft` → `sent` (delivered as-is) / `applied` (folded into an external system) / `superseded` (overtaken before sending). The marker lives with the draft because the file is the content's home; `result.md` cites the file rather than restating states.
- **Research dossiers** — grounding compiled during exploration (`research*.md`): the sources read and facts extracted, each with its link. Read-mostly once compiled; the deliverable cites dossier sections rather than restating them.
- **Review-evidence files** — verification artifacts backing a specific claim or review round (`evidence-*.md`): coverage counts, comparisons, observed states. Cited from the deliverable or the result section that makes the claim.
- **Patch-instruction docs** — instructions for changing a doc the agent doesn't own or can't safely mutate (e.g. `<target>-update-*.md`): what to change, where, and the exact replacement text — applied by the user, and carrying the same send-state lifecycle as outbound drafts.

## Multi-part efforts: sibling folders

A larger effort that won't fit one plan becomes several independent sibling task folders, not one folder holding many plans. Each sibling is a complete task folder (its own `CONTEXT.md` + `goals.md`/`plan.md`/`result.md`, plus an optional `ticket.md`). When the parts have a blocking order, express it with an `NN-` prefix on the folder names — the only place ordering can live, since the folders are otherwise independent:

```
.agents/tasks/01-schema/
.agents/tasks/02-api/
.agents/tasks/03-ui/
```

There is no shared layer above these folders — no shared context file, no cross-folder links. Anything a sibling needs is duplicated into its own `CONTEXT.md`. This keeps every folder self-sufficient: discoverable, movable, and archivable on its own.

A multi-part effort's siblings belong in **one parent directory** — the `NN-` ordering is only visible where the folders sort together, and location-relative archiving keeps finished parts (`<parent>/Archive/01-schema/`) beside the live ones.

This section owns **where** siblings live; **how to choose and land the cut** — lenses, part-quality bar, proposal, materialization — is the sibling `decomposition.md`, run by the `decompose-task` skill.

## Archiving finished tasks (optional)

Archiving is **location-relative**: a finished task folder moves into an `Archive/` subdirectory of whatever directory contains it — the same rule at every location:

```
<parent>/<slug>/  →  <parent>/Archive/<slug>/      # canonically: .agents/tasks/Archive/<slug>/
```

A completed (`done`) or `skipped` task is moved there to keep its parent's active list short. At a non-canonical location `<parent>/Archive/` may already exist with the user's own unrelated content; that's fine — archiving adds `<slug>/` beside it, and the only collision that matters is `<parent>/Archive/<slug>/` itself.

**Recognizing the directory is case-insensitive.** New archives are always *created* as `Archive/`, but wherever a skill *recognizes* an existing one — excluding it from an active scan, falling back into it for a bare slug, guarding a creation destination, or refusing to re-archive an already-archived folder — the name is matched **case-insensitively**. A lowercase `archive/` from a pre-rename layout, or the same folder on a case-insensitive filesystem (macOS's APFS), still counts as the archive. `maintain`'s format sweep normalizes a stray lowercase `archive/` container back to `Archive/`.

The `archive-task` skill performs this move — it confirms the plan is `done` or `skipped`, then relocates the whole folder — or you can `mv` it by hand; the result is identical.

Moving a whole task folder preserves its internal `./` links, since every cross-reference inside the folder is relative to the folder itself. Nothing else needs rewriting.

## Store-level artifacts (optional)

A directory tree that groups many task folders — a task **store**, like a central `Tasks/` repo with area subdirectories — may carry store-level files. Both kinds below are optional; skills detect them by existence and degrade silently when absent. There is deliberately **no standing listing artifact** — "what is in the store" is derived on demand by walking the registered roots (§ *Discovery rules for skills*), never kept on disk, because a derived enumeration goes stale silently and duplicates the walk that would have found the truth.

- **`DECISIONS.md` — the home for project-scoped decisions.** A registered root, or an area within it, may carry a `DECISIONS.md`: the single home for decisions that outlive any one task, each entry numbered and dated. Tasks cite an entry as `Decision #N — <root-relative path>` (plain text, per the cross-folder citation rule above — a store-level doc has no slug, so it keeps the path form). Task-local decisions stay in the task's own files; a task that inlines a copy of a project decision for self-sufficiency must name `DECISIONS.md` as the source.
- **`DOC_CONVENTIONS.md` — org documentation conventions.** A registered root, or an area within it, may carry a `DOC_CONVENTIONS.md`: the single home for the org-specific documentation conventions the kit's format checklists deliberately exclude — people/mention tables, house style, page-handling conventions for published docs. Discovered by **walk-up**: from the task folder, check each ancestor directory up to the registered root that contains it — the root is the bound, and an unregistered task folder walks up to its project root instead; the nearest file wins (an area-level file overrides a root-level one). Absent → only the kit's generic format bars apply. Consumed by documentation-domain work — the pack checklists and the `stage-doc` skill cite this role rather than hardcoding a path.

## Discovery rules for skills

When resolving which task to act on, the **base resolution** is shared; skills differ only in what they do when the user named nothing.

### The root registry (optional)

An optional JSON file at the fixed path `~/.config/agents-kit/config.json` names this machine's task roots. It carries exactly one class of fact: **machine-variant paths the kit cannot derive.** **Absent is the normal state**, and means the canonical-root-only behavior each rule below names as its fallback — no install ships one, and nothing writes one unasked. The `init-config` skill proposes one from what is on disk and writes it only on confirmation; hand-authoring it is equally valid.

```json
{
  "taskRoots": [
    { "path": "~/Documents/Tasks", "label": "personal" },
    { "path": "~/Work/tasks", "label": "work" },
    { "path": "~/Documents/Repositories/agents-kit/.agents/tasks", "label": "kit" }
  ],
  "kitRoot": "~/Documents/Repositories/agents-kit"
}
```

- **Discovery-only.** A registered root is **listed** and **slug-resolvable**; it is never a creation destination. New task folders are still created in the project-local canonical root, or per a user-supplied destination path (*Destination paths* below). The registry widens what skills can *find*, never where they *write*.
- **A missing path is skipped, and reported in one line per run** — never an error either way. Skipping is what lets one file describe the union of several machines; reporting is because nothing syncs this file today, which makes an unresolvable path likelier a typo than another device's layout.
- **`~` expands before a path is used, and the agent is what expands it.** The schema takes `~` precisely so an absolute `/Users/<name>/…` path cannot fail silently under the skip rule the moment the file reaches another machine — but the expansion happens where the file is read. The `scripts/*.mjs` walkers take absolute paths only and do no expansion of their own, so a skill that forwards a registry entry to one must expand it first; handed a literal `~/…` they resolve it against the process directory and report the root as unreadable.
- **Labels group listings.** A "which task?" prompt groups its options by `label`. The label is display grouping, not a selector: there is no filtering syntax and no new skill argument.
- **Walking a root is recursive, and a task folder is identified by its contents, not its position.** The canonical root is flat, but a registered root may nest tasks under area directories. Walk to unbounded depth, treat any folder matching the **recognition set** (§ *One task, one flat folder*) as a task folder and never descend into one, and descend through everything else except `node_modules` and dotted names other than `.agents` — the walk `scripts/health-check.mjs` already performs, prunes included. `.agents` is the one dotted name entered, because a canonical root sits inside it: that is what lets a project directory be registered as a root and still resolve the tasks under its `.agents/tasks`, rather than walking clean and reporting a zero indistinguishable from an empty root.
- **Run state is not config, and lives apart.** `~/.config/agents-kit/` holds this file and nothing else. Per-machine state a skill derives — `maintain`'s `.maintain-last-run` marker and its session-findings files — belongs in `~/.local/state/agents-kit/`, so a config directory never accumulates mutable run data.
- **`kitRoot` names the agents-kit source checkout** — the directory holding `setup.sh`, `CORE_RULES.md`, and `references/`, not a deployed install home. It is the one entry that is not a place tasks live; skills that operate on the kit itself read it.
- **Every key is optional, and each absence has one meaning.** No `taskRoots` (or an empty one) is the canonical-root-only behavior above — the same as no file. No `kitRoot` means this machine has no source checkout registered: a skill that needs one asks for it or takes it as an argument, and never derives it from the deployed `~/.claude` copy it is running out of, which is an install home rather than a checkout. A file carrying neither key is valid and inert.

Nothing else belongs in this file. A path the kit cannot derive is a fact; a default the kit can already reason about is a preference, and preferences stay out — a threshold copied here would manufacture the second home *One home per fact* exists to prevent.

**Base resolution (every skill):**

- **Bare slug given** → resolve among the active folders of the canonical root and of every registered root (excluding `Archive/`, matched case-insensitively — see *Archiving finished tasks*); if none matches, search each of those roots' `Archive/` before giving up — a finished task may have been archived there. A slug is **globally unique across registered roots**, so at most one folder matches; two that do are a layout error to surface, not to guess between. With no registry the search is the canonical root alone, and a task living outside it must be named by path. (Anything containing a path separator is a path; a bare kebab-case token is a slug.)
- **Explicit task folder path given** → use it verbatim, anywhere on disk; the folder's own name is the slug. Confirm it's a task folder by contents, per the **recognition set** in § *One task, one flat folder* — that section owns the file list, including the legacy suffix forms. There is no archive fallback for a path — verbatim is verbatim.
- **A full plan path given** (`.../plan.md`) → use it directly and derive the task folder from its parent — the parent folder is the task folder, wherever it sits.

Once the folder is resolved, its files are found by their fixed role names — no stem-globbing, no path a user typed. Don't guess between ambiguous candidates — ask.

**Destination paths (creating skills).** `refine-idea` and `plan-task` accept an optional destination path naming where the task folder should live. Interpret it by what's on disk:

- **Exists, and is a task folder** (top-level `CONTEXT.md`, `goals.md`, `plan.md`, or `ticket.md`) → that *is* the task folder; use it verbatim. Its name is the slug — don't derive one.
- **Exists, and is a directory** without those files → it's the **parent**: create `<path>/<slug>/` inside it. Exception: if its basename already equals the derived slug, ask — silently creating `<slug>/<slug>/` is almost never intended.
- **Doesn't exist** → if its basename equals the derived slug, the user named the folder itself: create it verbatim. Otherwise ask whether to create `<path>/<slug>/` inside it (the usual intent) or use `<path>` as the folder itself.
- **Exists, but is a file** → refuse; a destination must be a directory.

No destination path → the canonical root, `.agents/tasks/<slug>/`. Resolve the destination to an absolute path before using it. Avoid creating a live task directly under a directory named `Archive/` — location-relative archiving reads that as already archived; warn and confirm first.

**Fallback when the user named nothing** — this is the only branch that varies, by what the skill does:

- **resolve-or-create** (`refine-idea`, `plan-task`) → derive a slug from the task description and create the task folder when no folder matches — **checking every registered root, active and archived, not only the destination's**. Global slug uniqueness is what makes a bare slug resolvable anywhere, and it is breakable only here, at creation: minting a second `add-csv-export` in a project root while one already exists in another registered root is what the check exists to prevent. A match is reported with the root that holds it rather than worked around — an active one means the task already exists, an archived-only one asks whether to un-archive it or start fresh. The **destination is unchanged** by the widened check: the canonical root (`.agents/tasks/<slug>/`) by default, or a user-supplied destination path (see *Destination paths* above).
- **resolve-current-or-ask** (`implement-task`, `resume-task`, `reconcile-task`) → first check whether a task is already established **in this session** — a folder / `CONTEXT.md` resolved earlier this session (e.g. from a preceding `refine-idea`, `plan-task`, or `review-task`, or one the user named). If so, use it. Otherwise list the active folders (excluding `Archive/`) of the canonical root and every registered root, grouped by label, and ask which.
- **resolve-or-ask** (`review-task`, `archive-task`) → list the active folders (excluding `Archive/`) of the canonical root and every registered root, grouped by label, and ask which.

Archived tasks are intentionally absent from the default active listing — that is the point of archiving, not a discovery bug. Likewise, tasks in a root that is neither canonical nor registered are absent from *every* listing — unlistable by design; reach them by path, or register their root.

# Store-Level Artifacts and the Root Registry

## Store-level artifacts (optional)

A task store groups folders under a directory tree. Detect optional files by existence and continue silently when absent. Derive listings by walking registered roots (`./task-layout.md` § *Discovery rules for skills*); keep no standing listing artifact. The one exception is a group file's per-child Scope lines (§ *Shared group context*).

- **`DECISIONS.md`**: numbered, dated decisions that bind a whole root or area, or several tasks that share no inherited group file. Tasks outside registered roots inherit no group file. A decision binding only tasks that inherit one group's file goes to that group's Decisions list (§ *Shared group context*), which may cite an existing `Decision #N`. A group question's answer may also bind tasks that do not inherit its group's file. That decision goes here or to an ancestor group's Decisions list, as above. The group's Decisions line for that question keeps its `GQ<n>` id and cites that record instead of restating it. Keep task-local decisions inside the task. Cite `Decision #N — <root-relative path>` as plain text (`./one-home.md`). A self-contained inline copy of a project decision names `DECISIONS.md` as its source. `start-group` never writes `DECISIONS.md`.
- **`DOC_CONVENTIONS.md`**: organization-specific people/mention tables, house style, published-page handling, and tracker project and field rules. Walk ancestors from the task to its containing registered root; the nearest file wins. For an unregistered task, stop at its project root. A start outside any task stops at its containing registered root, else its project root; outside both, walk nothing. Without a file, apply only generic kit formats. Documentation work and tracker writes consume these conventions.
- **`GROUP_CONTEXT.md`**: ordinary task work inherits the applicable ancestor chain under § *Shared group context*, on every invocation.
- **`GROUP_LOG.md`**: a group's dated history beside its `GROUP_CONTEXT.md`, under § *Shared group context*.

## The root registry (optional)

`~/.config/agents-kit/config.json` records machine-variant paths the kit cannot derive. Absence is normal: discovery uses the canonical root. No install creates it. `init-config` writes only on confirmation; users may author it directly.

```json
{
  "taskRoots": [
    { "path": "~/Documents/Tasks", "label": "personal" },
    { "path": "~/Work/tasks", "label": "work" },
    { "path": "~/Documents/Repositories/agents-kit/.agents/tasks", "label": "kit" }
  ],
  "kitRoot": "~/Documents/Repositories/agents-kit",
  "runbookRoot": "~/Documents/Notes/runbook"
}
```

- Registration expands listing and slug discovery. It grants no creation destination; apply `./task-destinations.md`. It also participates in inherited-root selection below.
- Skip a missing task-root path and report it once per run. It is not an error.
- Expand `~` wherever the registry is read. Before passing roots as script arguments, expand them to absolute paths; walkers accept no literal tilde. Scripts reading the registry themselves, such as `task-move.ts`, expand their own entries.
- Group task prompts by `label`. Labels are display grouping, not selectors or filtering syntax.
- Walk each registered root recursively to unbounded depth. Prune `node_modules`, dotted entries except `.agents`, and non-real directories, including symlinks. Test Archive/Backlog containers case-insensitively before task recognition: descend through them regardless of misplaced role files. Then recognize folders under `./task-layout.md` § *One task, one flat folder* and stop at each recognized task. Descend through other directories. An inner registered root is searched independently even when the outer root's prunes hide it.
- Keep configuration apart from run state. `~/.config/agents-kit/` holds config; derived markers and findings belong in `~/.local/state/agents-kit/`.
- `kitRoot` identifies a source checkout holding `setup.ts`, `CORE_RULES.md`, and `references/`, not an installed agent home.
- `runbookRoot` identifies one dedicated private runbook directory, separate from task-discovery roots. When present, it must be a nonempty string containing an absolute or `~/...` path; other relative paths and non-string values are invalid. Expand tilde and resolve directory identity before use. Entry and lookup behavior belongs to `./runbook.md`.
- Absent `runbookRoot` opts out silently. When runbook context is needed, report malformed configuration or a missing or unreadable configured source. Do not infer its path from task roots.
- `openStore` in `scripts/secretary-state.ts` preserves these `runbookRoot` rules, a sanctioned copy per `references/maintenance/repository.md` § *Consumer lists*.
- `secretary.duties["runbook-maintenance"].intervalMinutes` configures the runbook duty under `../secretary/runbook-maintenance.md` § *Configuration*. Preserve unrelated and future settings.
- `secretary.duties["meeting-sync"].folder` and `.intervalMinutes` configure the meeting duty under `../secretary/meeting-sync.md` § *Configuration*.
- Every key is optional. Missing/empty taskRoots means canonical-only discovery; absent kitRoot means no registered source checkout. A file with none of these keys is inert. Omit derivable defaults.

`WALK_SKIP_DIRS`, `TASK_STORE_DIR`, and `classifyWalkEntry` in `scripts/lifecycle-constants.ts` preserve the prunes and their ordering, a sanctioned copy per `references/maintenance/repository.md` § *Consumer lists*.

## Shared group context (optional)

Name a group's file exactly **`GROUP_CONTEXT.md`**. It carries standing facts, permissions, constraints, and group-wide decisions that apply to child tasks in that group. Keep an individual task's moves, design status, decisions, and progress in that task's own artifacts. Include no status, lifecycle, plan, goal IDs, Domain, acceptance criteria, or progress rollup. Its prose is grounding, not instruction precedence; it outranks neither kit rules nor the task contract.

For an address-management group, a shared admin-only permission rule belongs here. A child task's move from another folder or its pending design belongs in that child's `CONTEXT.md` or `result.md`.

The user and `start-group` author the file's sections. `implement-task` and reconcilers may correct the file under **Surface material contradictions before dependent work** below. It may hold these sections, each optional; a group file without them stays valid:

- `## Direction`: where the group's work is heading.
- `## Scope`: what the group covers, one line per direct child task. `start-group` writes these lines, and its § *Brief* reports their drift from the child tasks on disk.
- `## Decisions`: group-wide current rules and standing facts, one line each, citing the `GROUP_LOG.md` entry or task record that holds the evidence.
- `## Open Questions`: group questions, each with a `GQ<n>` id, its addressee, and where it was asked. After each `start-group` change set other than a compaction, it lists only unanswered and waiting questions. A waiting question's answer awaits its record in `DECISIONS.md` or an ancestor group. Its entry states that answer and names that file.

**`GROUP_CONTEXT.md` has a 40 KB budget**, measured as the file's size on disk with 1 KB = 1,024 bytes (40,960 bytes). The `start-group` brief reports a file over the budget.

Only `start-group` assigns question ids. Ids are never reused: the next is one above the highest assigned in `GROUP_CONTEXT.md` or `GROUP_LOG.md`.

**A task cites a group question by id.** `start-group` writes the entry `- GQ<n>: see <group path>/GROUP_CONTEXT.md` in that task's `CONTEXT.md` `## Open Questions`. Once the question moves into the group's `## Decisions`, `start-group` rewrites the entry in its answered form: `- GQ<n>: answered, see <group path>/GROUP_CONTEXT.md § Decisions`. The answered form copies no part of the answer. Either form may carry the task's own partial answer or task-local facts after the citation. The group path is root-relative when the task's selected root is the group's registered root and the group lies below that root. It is absolute otherwise, including when the group is that root itself. Resolve a root-relative group path against the citing task's selected root. Look up the id in the cited file, even when that file lies outside the task's inherited chain, as for a task in an inner registered root. Take no other grounding from a file outside the chain. Resolve root-relative paths written in the cited file against the most specific registered root containing that file. The lookup has four outcomes for either form:

- A `## Decisions` line starting with the id answers the question and states the current rule. When that line points at a `Decision #N` or an ancestor group's Decisions list instead, read the rule from that record.
- An Open Questions entry with the id that another writer answered in place counts as answered (**Surface material contradictions before dependent work** below). Its guidance and the record it cites state the current rule.
- An open or waiting Open Questions entry with the id keeps the question open. A waiting entry states its answer, which still awaits its record in the home the entry names.
- When the cited file is missing or unreadable, or no longer holds the id, report the task entry as unresolvable.

**`GROUP_LOG.md`** sits beside `GROUP_CONTEXT.md` and holds the group's append-only dated history. Only `start-group` writes it, appending one `## Change set — YYYY-MM-DD: <topic>` entry per change set. Each entry records the user's instruction and its source, the change set's decision evidence, and each edited file and section. It quotes prior and new wording for each edit to a task's `ticket.md`, or to the Recommended Direction, MVP Scope, Not Doing, or Key Assumptions of its `CONTEXT.md`. It quotes the full prior wording of each Decisions line the change set rewrites or restates. It copies no other edited text, apart from `GROUP_CONTEXT.md` text the change set deletes. Other edits to the group file get no entry. Per-task skills do not load `GROUP_LOG.md`. Child tasks cite `GROUP_CONTEXT.md`, never `GROUP_LOG.md`.

A group file alone establishes no task. A recognition-set file such as `CONTEXT.md` does: the walk claims that group and hides tasks beneath it. Keep role files out of grouping directories. `health-check.ts` reports such hidden tasks as `nested-task` (`../scripts/health-check.md`).

**Select the root** as the most specific registered directory physically containing the task, whether resolution used a slug or path. Expand tilde, resolve directory identities, compare whole components, and collapse aliases. Missing registered paths select nothing. An explicitly registered canonical root participates normally; outside registered roots, inherit nothing.

**Read root-to-task**: the selected root's own group file, then those in ancestors through the task's immediate parent, then task-local context. Exclude siblings, descendants, and everything above the selected root. Identify the selected root and cite each source by its plain root-relative path throughout the work. Also read each `Decision #N` that a chain file's `## Decisions` line points at, under `./task-layout.md` § *Reading a resolved folder* step 4.

Registering an inner root shortens this chain without warning. Register it when only inner grounding should apply; leave it unregistered to retain outer constraints.

**Lifecycle containers are transparent.** Ignore a group file directly inside an Archive/Backlog container below the selected root, case-insensitively (`./task-archiving.md`, `./task-backlog.md`). Ordinary groups on either side still apply. Always read the selected root's own file, whatever its name. Filing in place preserves inheritance; moving between groups may change it.

**Absence is silent; unreadability is reported.** Name an applicable file that cannot be read and why; treat grounding as incomplete. Report symlinks and other non-regular group entries as unsupported rather than following them.

**Surface material contradictions before dependent work.** Quote both statements with their sources; do not resolve conflicts by read order. Apply the running skill's clarification and write rules. `implement-task` may correct a group statement disproved during execution under its Correcting Grounding rules. Reconcilers may correct the group under `./reconciliation.md` § *The upstream ask is writable, and never rewritten quietly*. Both keep decision evidence in their own task record, never as a dated heading in `GROUP_CONTEXT.md`. When they rewrite a Decisions line, the same edit replaces the line's earlier citation with that record. An answered question they leave in place cites that record and stays valid until the next `start-group` change set other than a compaction moves it into Decisions.

Read files from disk on every invocation; introduce no cache, manifest, CLI, or registry key. Do not bulk-copy group prose into tasks or sweep its links. DOC_CONVENTIONS retains its independent nearest-file lookup.

## Resolving `<kit-root>`

For `node <kit-root>/scripts/<name>.ts`, use the source checkout from config's `kitRoot`, expanding tilde before joining the path. Without that key, a Claude Code plugin install root (`./reviewer-contract.md` § *Adapter defaults*) serves, since the plugin ships `scripts/`. A `setup.ts` home cannot substitute: it contains no scripts directory.

- Missing config or key outside a plugin install: ask for the checkout path, rather than infer one from the installation.
- No available checkout: report the helper unavailable and use only the citing skill's stated fallback; otherwise stop.
- Read `references/scripts/<name>.md` for CLI/stdout contracts. Skills cite `./references/scripts/<name>.md`; references cite `../scripts/<name>.md`. Maintainer rationale: `references/maintenance/scripts.md` § *`scripts/<name>.ts`* (maintainers only).

# Store-Level Artifacts and the Root Registry

## Store-level artifacts (optional)

A task store groups folders under a directory tree. Detect optional files by existence and continue silently when absent. Derive listings by walking registered roots (`./task-layout.md` § *Discovery rules for skills*); keep no standing listing artifact.

- **`DECISIONS.md`**: numbered, dated decisions applying beyond one task, at a root or area. Cite `Decision #N — <root-relative path>` as plain text (`./one-home.md`). Keep task-local decisions inside the task. A self-contained inline copy of a project decision names `DECISIONS.md` as its source.
- **`DOC_CONVENTIONS.md`**: organization-specific people/mention tables, house style, and published-page handling. Walk ancestors from the task to its containing registered root; the nearest file wins. For an unregistered task, stop at its project root. Without a file, apply only generic kit formats. Documentation work consumes these conventions.
- **`GROUP_CONTEXT.md`**: ordinary task work inherits the applicable ancestor chain under § *Shared group context*, on every invocation.

## The root registry (optional)

`~/.config/agents-kit/config.json` records machine-variant paths the kit cannot derive. Absence is normal: discovery uses the canonical root. No install creates it. `init-config` writes only on confirmation; users may author it directly.

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

- Registration expands listing and slug discovery. It grants no creation destination; apply `./task-destinations.md`. It also participates in inherited-root selection below.
- Skip a missing path and report it once per run. It is not an error.
- Expand `~` wherever the registry is read. Before passing roots as script arguments, expand them to absolute paths; walkers accept no literal tilde. Scripts reading the registry themselves, such as `task-move.ts`, expand their own entries.
- Group task prompts by `label`. Labels are display grouping, not selectors or filtering syntax.
- Walk each registered root recursively to unbounded depth. Prune `node_modules`, dotted entries except `.agents`, and non-real directories, including symlinks. Test Archive/Backlog containers case-insensitively before task recognition: descend through them regardless of misplaced role files. Then recognize folders under `./task-layout.md` § *One task, one flat folder* and stop at each recognized task. Descend through other directories. An inner registered root is searched independently even when the outer root's prunes hide it.
- Keep configuration apart from run state. `~/.config/agents-kit/` holds config; derived markers and findings belong in `~/.local/state/agents-kit/`.
- `kitRoot` identifies a source checkout holding `setup.ts`, `CORE_RULES.md`, and `references/`, not an installed agent home.
- Every key is optional. Missing/empty taskRoots means canonical-only discovery; absent kitRoot means no registered source checkout. A file with neither is inert. Record no derivable defaults or preferences here.

`WALK_SKIP_DIRS`, `TASK_STORE_DIR`, and `classifyWalkEntry` in `scripts/lifecycle-constants.ts` preserve the prunes and their ordering, a sanctioned copy per `AGENTS.md` § *Consumer lists*.

## Shared group context (optional)

Name a group's file exactly **`GROUP_CONTEXT.md`**. It carries shared constraints, conventions, and standing facts, with no status, lifecycle, plan, goal IDs, Domain, acceptance criteria, or progress rollup. Its prose is grounding, not instruction precedence; it outranks neither kit rules nor the task contract.

A group file alone establishes no task. A recognition-set file such as `CONTEXT.md` does: the walk claims that group and hides tasks beneath it. Keep role files out of grouping directories. `health-check.ts` reports such hidden tasks as `nested-task` (`../scripts/health-check.md`).

**Select the root** as the most specific registered directory physically containing the task, whether resolution used a slug or path. Expand tilde, resolve directory identities, compare whole components, and collapse aliases. Missing registered paths select nothing. An explicitly registered canonical root participates normally; outside registered roots, inherit nothing.

**Read root-to-task**: the selected root's own group file, then those in ancestors through the task's immediate parent, then task-local context. Exclude siblings, descendants, and everything above the selected root. Identify the selected root and cite each source by its plain root-relative path throughout the work.

Registering an inner root shortens this chain without warning. Register it when only inner grounding should apply; leave it unregistered to retain outer constraints.

**Lifecycle containers are transparent.** Ignore a group file directly inside an Archive/Backlog container below the selected root, case-insensitively (`./task-archiving.md`, `./task-backlog.md`). Ordinary groups on either side still apply. Always read the selected root's own file, whatever its name. Filing in place preserves inheritance; moving between groups may change it.

**Absence is silent; unreadability is reported.** Name an applicable file that cannot be read and why; treat grounding as incomplete. Report symlinks and other non-regular group entries as unsupported rather than following them.

**Surface material contradictions before dependent work.** Quote both statements with their sources; do not resolve conflicts by read order. Apply the running skill's clarification and write rules. `implement-task` may correct a group statement disproved during execution under its Correcting Grounding rules. Reconcilers may correct the group under `./reconciliation.md` § *The upstream ask is writable, and never rewritten quietly*.

Read files from disk on every invocation; introduce no cache, manifest, CLI, or registry key. Do not bulk-copy group prose into tasks or sweep its links. DOC_CONVENTIONS retains its independent nearest-file lookup.

## Resolving `<kit-root>`

For `node <kit-root>/scripts/<name>.ts`, use the source checkout from config's `kitRoot`, expanding tilde before joining the path. A deployed `~/.claude` or `~/.codex` home cannot substitute: installations contain no scripts directory.

- Missing config or key: ask for the checkout path, rather than infer one from the installation.
- No available checkout: report the helper unavailable and use only the citing skill's stated fallback; otherwise stop.
- Read `references/scripts/<name>.md` for CLI/stdout contracts. Skills cite `./references/scripts/<name>.md`; references cite `../scripts/<name>.md`. Maintainer rationale stays in root `AGENTS.md` § *Source contracts*, under `scripts/<name>.ts`.

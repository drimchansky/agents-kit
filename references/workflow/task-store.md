# Store-Level Artifacts and the Root Registry

The two optional things that sit *outside* any one task folder — the files a task **store** may carry, and the machine registry that names this machine's task roots — split out of `./task-layout.md`, which keeps the folder shape and the discovery rules. **This file is the single source of truth for both.** Read it when a store carries store-level artifacts or a root registry (`~/.config/agents-kit/config.json`), or when registering one.

## Store-level artifacts (optional)

A directory tree that groups many task folders — a task **store**, like a central `Tasks/` repo with area subdirectories — may carry store-level files. Both kinds below are optional; skills detect them by existence and degrade silently when absent. There is deliberately **no standing listing artifact** — "what is in the store" is derived on demand by walking the registered roots (`./task-layout.md` § *Discovery rules for skills*), never kept on disk, because a derived enumeration goes stale silently and duplicates the walk that would have found the truth.

- **`DECISIONS.md` — the home for project-scoped decisions.** A registered root, or an area within it, may carry a `DECISIONS.md`: the single home for decisions that outlive any one task, each entry numbered and dated. Tasks cite an entry as `Decision #N — <root-relative path>` (plain text, per the cross-folder citation rule in `./one-home.md` — a store-level doc has no slug, so it keeps the path form). Task-local decisions stay in the task's own files; a task that inlines a copy of a project decision for self-sufficiency must name `DECISIONS.md` as the source.
- **`DOC_CONVENTIONS.md` — org documentation conventions.** A registered root, or an area within it, may carry a `DOC_CONVENTIONS.md`: the single home for the org-specific documentation conventions the kit's format checklists deliberately exclude — people/mention tables, house style, page-handling conventions for published docs. Discovered by **walk-up**: from the task folder, check each ancestor directory up to the registered root that contains it — the root is the bound, and an unregistered task folder walks up to its project root instead; the nearest file wins (an area-level file overrides a root-level one). Absent → only the kit's generic format bars apply. Consumed by documentation-domain work — the pack checklists and the `stage-doc` skill cite this role rather than hardcoding a path.

## The root registry (optional)

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

- **Discovery-only.** A registered root is **listed** and **slug-resolvable**; it is never a creation destination. New task folders are still created in the project-local canonical root, or per a user-supplied destination path (**Destination paths** in `./task-layout.md`). The registry widens what skills can *find*, never where they *write*.
- **A missing path is skipped, and reported in one line per run** — never an error either way. Skipping is what lets one file describe the union of several machines; reporting is because nothing syncs this file today, which makes an unresolvable path likelier a typo than another device's layout.
- **`~` expands before a path is used, and the agent is what expands it.** The schema takes `~` precisely so an absolute `/Users/<name>/…` path cannot fail silently under the skip rule the moment the file reaches another machine — but the expansion happens where the file is read. The `scripts/*.ts` walkers take absolute paths only and do no expansion of their own, so a skill that forwards a registry entry to one must expand it first; handed a literal `~/…` they resolve it against the process directory and report the root as unreadable.
- **Labels group listings.** A "which task?" prompt groups its options by `label`. The label is display grouping, not a selector: there is no filtering syntax and no new skill argument.
- **Walking a root is recursive, and a task folder is identified by its contents, not its position.** The canonical root is flat, but a registered root may nest tasks under area directories. Walk to unbounded depth, treat any folder matching the **recognition set** (`./task-layout.md` § *One task, one flat folder*) as a task folder and never descend into one, and descend through everything else except `node_modules` and dotted names other than `.agents` — the walk `scripts/health-check.ts` already performs, prunes included. `.agents` is the one dotted name entered, because a canonical root sits inside it: that is what lets a project directory be registered as a root and still resolve the tasks under its `.agents/tasks`, rather than walking clean and reporting a zero indistinguishable from an empty root.
- **Run state is not config, and lives apart.** `~/.config/agents-kit/` holds this file and nothing else. Per-machine state a skill derives — `maintain`'s `.maintain-last-run` marker and its session-findings files — belongs in `~/.local/state/agents-kit/`, so a config directory never accumulates mutable run data.
- **`kitRoot` names the agents-kit source checkout** — the directory holding `setup.ts`, `CORE_RULES.md`, and `references/`, not a deployed install home. It is the one entry that is not a place tasks live; skills that operate on the kit itself read it.
- **Every key is optional, and each absence has one meaning.** No `taskRoots` (or an empty one) is the canonical-root-only behavior above — the same as no file. No `kitRoot` means this machine has no source checkout registered: a skill that needs one asks for it or takes it as an argument, and never derives it from the deployed `~/.claude` copy it is running out of, which is an install home rather than a checkout. A file carrying neither key is valid and inert.

Nothing else belongs in this file. A path the kit cannot derive is a fact; a default the kit can already reason about is a preference, and preferences stay out — a threshold copied here would manufacture the second home *One home per fact* (`./one-home.md`) exists to prevent.

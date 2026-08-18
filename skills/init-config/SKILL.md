---
name: init-config
description: Use when asked to create, update, or repair this machine's agents-kit config — discovers the task roots on disk, compares them against `~/.config/agents-kit/config.json`, and previews the delta for confirmation before writing. Never writes unasked, never discards a hand-authored entry.
argument-hint: '[search directories — defaults to the usual project parents]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

Writes one file: `~/.config/agents-kit/config.json`, the **root registry** whose schema, semantics, and consumers are owned by `./references/workflow/task-store.md` § *The root registry*. Read that section at run time and treat it as the only source of truth for the file's shape — this skill carries **no** copy of the schema, so a key added or retired there needs no edit here.

This skill operates on one machine's configuration. It resolves no task, reads no `**Domain:**` pack, and touches no task folder: the config names *where* tasks live, and is not itself task content.

**CRITICAL**:

- **Never write unasked.** Discovery is read-only; the single write happens only on an explicit confirmation of a previewed file. Declining writes nothing at all, and the proposal still reaches you in the Output.
- **Never discard a hand-authored entry.** Discovery proposes; it does not adjudicate. A registered root that discovery didn't find is **kept** by default and reported, because "not found" and "wrong" are different claims — a root on an unmounted volume, a machine you also use, or a directory holding tasks this walk didn't recognize all look identical from here.
- **Never touch git**, and never write outside `~/.config/agents-kit/`. The state directory `~/.local/state/agents-kit/` belongs to `maintain`, not to this skill.

## When to Use

**Use when** the user asks to set up, generate, initialize, refresh, or fix the agents-kit config, or to register a task root — including on a new machine where no config exists.

**Skip when** the user wants to change *what a root means* rather than which roots exist (that is the contract in `task-layout.md`, not this file), or when they want a task created or found — that is `plan-task` / `refine-idea` and the discovery rules.

## Process

### 1. Read the contract, then the current file

Read `./references/workflow/task-store.md` § *The root registry* first: the fixed path, the key set, and the rules a root obeys. Everything below fills that shape.

Then read `~/.config/agents-kit/config.json` if it exists. Unreadable or invalid JSON is **not** a reason to overwrite it: report the parse error with its line, treat the file as unknown rather than empty, and offer only to write a proposal the user confirms against what they can see. A file whose top-level keys are unknown to the contract is reported the same way and its entries carried forward untouched.

### 2. Discover the roots on disk

Walk the search directories — the invocation's arguments, or, when none is given, whichever of `~/Documents`, `~/Developer`, `~/Projects`, `~/repos`, `~/src`, and `~/Work` exist, plus the current project root — and identify roots by **contents**, per the same rules discovery itself uses:

- A **task folder** is any directory matching the **recognition set** in `./references/workflow/task-layout.md` § *One task, one flat folder* — read it at run time; that section owns the file list, legacy suffix forms included, and a root whose folders still carry those forms is exactly the kind this walk must not miss. Never descend into a task folder.
- A task folder under `<x>/.agents/tasks/` belongs to the **canonical root** `<x>/.agents/tasks` — propose that, not the project directory.
- Otherwise the root is the **highest ancestor whose every sibling directory also leads to a task folder**. That is what separates a store (`Tasks/` holding `area/task/`) from a directory that merely happens to contain one. Climb out of any `Archive/` or `Backlog/` container first — each is a container, not a root (`./references/workflow/task-archiving.md`, `./references/workflow/task-backlog.md`).
- Skip `node_modules`, dotted directories other than `.agents`, and a `tests/fixtures/` tree: the first two are the walk prunes `./references/workflow/task-store.md` § *The root registry* states, and a fixture tree is this skill's own — fixture task folders are test data, and proposing them as roots is the most likely way this skill produces a wrong file.
- **`~` is reachable by argument, and is deliberately not the default.** A full-home walk enters `Library` and every other large non-dotted tree, and nothing lets it stop early: recognition is by directory contents, so every directory must be listed, and the highest-ancestor rule above cannot judge an ancestor until every subtree beneath it is known. A root outside the defaults is named as an argument once and then lives in the config, so the cost is paid on the run that needs it rather than on every run.
- **A directory the walk cannot read is counted and named, never silently skipped.** A permission-denied tree — `~/Library/Mail`, `~/Library/Messages`, anything behind a TCC prompt — is a hole in discovery, and an unreported hole reads as a clean walk. This is the discipline the rest of the kit already applies: `scripts/health-check.ts` carries `unreadable` and `unreadablePaths` in its stdout contract, and `maintain` refuses to report a skipped probe silently.
- **`kitRoot`** is a directory holding `setup.ts`, `CORE_RULES.md`, and `references/`. More than one found is a question for the user, never a guess; none found means the key is simply omitted — say so in the preview, and never fall back to a deployed install home, which is not a checkout.

Express every proposed path with `~` for the home directory — the schema takes `~` so one file survives reaching another machine, and a discovered absolute path would silently defeat that.

**Labels** are a first proposal, not a derivation: a canonical root takes its project directory's name, any other root its own basename — except a generic `tasks`, which takes its parent's name instead, since `Tasks` names nothing on its own. Say in the preview that labels are the part most worth editing, because they are what a "which task?" prompt shows.

### 3. Compare, and preview the delta

Compare discovery against the file on disk and preview **only what changes**, each line in one of four classes:

- **new** — discovered, not registered. The proposal adds it.
- **unchanged** — registered and discovered, same path and label.
- **absent** — registered, path does not exist on this machine. **Kept**, and reported as one line with the reason it might be legitimate (another machine, an unmounted volume). Removing it is an explicit choice the user makes at the gate, never the default.
- **unregistered but not proposed** — a directory the walk found and deliberately excluded (a fixtures tree, a second kit checkout). Named, so an exclusion is visible rather than silent.
- **unreadable** — a directory the walk could not open, with its error. Not a proposal either way: it is what the walk could not rule out, and a delta that hides it claims a completeness the walk didn't have.

With **no config present**, every discovered root is `new` and the preview is the whole proposed file.

Print the complete proposed JSON, not a diff alone — the confirmation is to the file's final contents, so what the user approves is what lands. Then say plainly what the file does and does not do: it is read for discovery only, absent roots are skipped and reported once per run, and deleting the file restores canonical-root-only behavior exactly.

### 4. Gate the write

Ask once, with the proposal on screen. On confirmation:

- Create `~/.config/agents-kit/` if absent, and write `config.json` — that one file, nothing else.
- **Never** create, move, or delete anything in `~/.local/state/agents-kit/`; a `maintain` marker there is that skill's business.
- Re-read the file after writing and confirm it parses and matches what was approved. A write that lands unparseable is reported at once, with the previous contents printed so nothing is lost.

Declining writes nothing. Say so explicitly rather than falling silent — a skill that ends quietly after a declined gate reads as though it wrote.

### 5. Verify against live behavior

A written config is a claim about discovery, so check the claim rather than asserting it. For each **resolvable** root, confirm at least one task folder is found beneath it and report the count; for each root reported `absent`, confirm it is named in the skip line. Report the totals as *N roots, M task folders, K skipped, U unreadable* — a root that resolves but holds zero task folders is worth naming, since it is usually a path one level off, and a non-zero `U` is why a count below is a floor rather than a total.

## Output

Lists, never tables.

- **Contract** — the path written and the section it obeys, so the schema's owner is visible.
- **Discovered** — one line per proposed root: path, label, and task-folder count; then `kitRoot`.
- **Delta** — the four classes from §3, each with its lines; omit a class with no members.
- **Excluded** — directories found and deliberately not proposed, with the reason. Omit when empty.
- **Unreadable** — directories the walk could not open, with the reason. Omit when empty.
- **Written** — `wrote <path>` or `declined (nothing written)`.
- **Verified** — the *N roots, M task folders, K skipped, U unreadable* totals, and any root resolving to zero task folders.
- **Next:** — `/maintain` when the run registered a root it did not have before (its Setup reads this file); otherwise nothing to hand off. Say when there is nothing.

## Verification

Confirm the protocol invariants before finishing:

- [ ] The schema came from `task-store.md` § *The root registry* read at run time, never from a copy in this file
- [ ] Discovery was read-only, and identified task folders by role-file contents rather than by path shape
- [ ] Every proposed path uses `~` for the home directory
- [ ] An existing config was read before anything was proposed; an unparseable or unknown-key file was reported and carried forward, never treated as empty
- [ ] Registered roots that discovery did not find were **kept** and reported, not silently dropped
- [ ] The complete proposed file was previewed and exactly one write happened, only on confirmation — or nothing was written and the decline was stated
- [ ] Nothing outside `~/.config/agents-kit/` was created, moved, or deleted; no git state mutated
- [ ] The written file was re-read, parsed, and verified against live discovery with per-root task-folder counts
- [ ] Unreadable directories were counted and named — in the delta, the preview, and the Output alike — never absorbed into a clean-looking total

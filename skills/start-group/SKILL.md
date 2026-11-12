---
name: start-group
description: Use when asked to start, open, create, or manage a task group — opens a read/write session on one group of tasks. Prints a brief of the group's direction, scope, decisions, open questions, and each child task's plan status, and prints it again from disk when asked what's next. Applies each instruction as one change set across the group file and the CONTEXT.md and ticket.md of every task below it outside Archive and Backlog, including tasks in nested groups. Leaves plan.md and goals.md to their owning skills, and child creation, parking, and archiving to theirs. Restructures an older group file or creates a new group only after you confirm.
argument-hint: "[group path or name]"
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.

Run one session on one task group until you ask to stop or the conversation ends. Load no domain pack; each child task keeps its own Domain. `./references/workflow/task-store.md` § *Shared group context* owns the group file's sections, `GQ<n>` ids, and `GROUP_LOG.md`. Keep no group state outside the files; rebuild it from disk each time.

Write only the selected group's `GROUP_CONTEXT.md` and `GROUP_LOG.md` and the `CONTEXT.md` and `ticket.md` of each task below it, outside Archive and Backlog. Those tasks include tasks in nested groups (§ *Change sets* step 1). § *Init* also creates the group's directory. § *Change sets* step 3 may create such a task's missing `CONTEXT.md`. Never write ancestor or nested group files, `DECISIONS.md`, or a task's other files. Never write through a `GROUP_CONTEXT.md`, `GROUP_LOG.md`, task folder, directory between a task and the group, or task `CONTEXT.md` or `ticket.md` that is a symlink or other non-regular entry. While the group's `GROUP_CONTEXT.md` or `GROUP_LOG.md` is such an entry, a change set writes nothing and names that entry as unsupported. A skill the session runs under § *Lifecycle* writes under its own rules.

## When to Use

**Use when** you want to see or steer a group's direction, scope, decisions, and open questions across its child tasks, or to create a group.

**Skip when** the work concerns one task: `resume-task` briefs it, `reconcile-task` records session findings, and `plan-task` changes its plan.

## Resolve the group

1. A token with a path separator is a path, used anywhere on disk. Expand `~`, then resolve a relative path against the working directory to an absolute one. Any other token is a name.
2. A path to a folder holding a role file (`./references/workflow/task-layout.md` § *One task, one flat folder*) is a task. Refuse it and name `resume-task`.
3. A name matches group directories in registered roots by whole basename, case-insensitively, outside Archive and Backlog. Walk each root under `./references/workflow/task-store.md` § *The root registry*. A group directory holds no role file, and holds a `GROUP_CONTEXT.md` entry of any kind or a task below it. List several matches with their root labels for the user to pick. With no match, ask for a path.
4. Select the root as `task-store.md` § *Shared group context* selects one for a task, and cite group files by root-relative path. Outside every registered root, read only the group's own files, skip ancestors, and cite the group by its absolute path from step 1. The brief says so and warns, as § *New group file* does, that child tasks inherit nothing from this group file. It names `init-config` to register a root.
5. Refuse a path, writing nothing, when an ancestor directory holds a role file. The path lies inside that task folder; name the task. Also refuse a path that is or lies inside an Archive or Backlog container, matched case-insensitively. Both tests check only components below the store root (`./references/workflow/task-archiving.md`). The store root is the registered root step 4 selects, else the canonical `.agents/tasks` root containing the path. With neither, both tests check the whole path.
6. Route the path. A directory holding a `GROUP_CONTEXT.md` entry of any kind, or a task below it, opens with § *Brief*. A missing directory, or one holding neither, goes to § *Init*. A path naming a file is not a group; ask for another.

## Brief

Print the brief at start, when you ask what's next, and when the session continues after compaction. Build it from disk each time.

1. **Group files.** Read the group's `GROUP_CONTEXT.md` in full. Report a `GROUP_CONTEXT.md` or `GROUP_LOG.md` that is a symlink or other non-regular entry as unsupported instead of following it (`task-store.md` § *Shared group context*). Inside a registered root, also read the ancestor group files from the root down, without writing them. Report material contradictions with the group's file under `task-store.md` § *Shared group context*.
2. **Children.** Take the group's direct subdirectories under the walk's prunes (`task-store.md` § *The root registry*), skipping Archive and Backlog containers case-insensitively. Report each symlink, and each entry that is neither a file nor a directory, as unsupported (`task-store.md` § *Shared group context*). A subdirectory holding a role file as a regular file is a child task. Another that holds `GROUP_CONTEXT.md` or a task below it is a nested group, listed by name only.
3. **Plan status.** Before the first run, check that `<kit-root>/scripts/task-state.ts` exists. Run `node <kit-root>/scripts/task-state.ts <child-dir>` for each child, never with `--repair` (`./references/scripts/task-state.md`; `<kit-root>`: `task-store.md` § *Resolving `<kit-root>`*).
    - Exit 0: take `plan.status`, the next pending step and its title, and each `structure.diagnostics` entry.
    - Exit 1 with a stderr line starting `[task-state]`: check the child's `plan.md` entry without following links, for example with `ls -ld`. An existing entry is an unreadable plan; report it with its path. Without one, check the child for legacy `*.plan.md` entries the same way. Report each one's path as a legacy plan file (`./references/workflow/task-layout.md` § *One task, one flat folder*). For a child under `<kit-root>/.agents/tasks/`, name `maintain` to rename it; `maintain` renames legacy files nowhere else. For any other child, tell the user to rename the file to `plan.md` by hand. Also tell them to repoint links in that folder that name the old file. A child with neither entry has no plan.
    - Exit 2: report the child's state as unavailable, with the stderr line.
    - Helper unavailable: the script is missing, an exit 1 has no stderr line starting `[task-state]`, or the exit is not 0, 1, or 2. Stop running the helper. Show every child's state as unavailable, citing the missing path, or the exit code and the stderr line naming the error.
4. **Questions.** Read only the `## Open Questions` section of each child's `CONTEXT.md` and `plan.md`, where each exists. Skip only fully answered entries, and show a partly answered entry by its open part. Add the group file's `## Open Questions`. Group all of them by the addressee each entry states, with unaddressed ones apart. A child entry that cites one of this group's questions under § *Change sets* step 5 appears once, under that question. When the id instead starts a `## Decisions` line, the entry appears beside that line under Answered in Decisions. The brief leaves the entry unchanged. An open part of its own shows beside its child there. A child entry citing a `GQ<n>` id of another file appears apart, with that file's path.
5. **Older group files.** For each of the four sections the group file lacks, print "none recorded". List the file's other `##` headings by name. A group with no `GROUP_CONTEXT.md` entry is reported as having none.
6. **Scope drift.** When the group file read in step 1 holds a `## Scope` section, compare its lines with the step 2 child tasks. A Scope line names a child when it names the child's directory. Report each child task no Scope line names, and each Scope line that names no child task.
7. **Offers.** Offer § *Restructure* when `GROUP_CONTEXT.md` holds text outside the four sections, apart from its title. Offer § *New group file* for a group with no `GROUP_CONTEXT.md` entry. Make neither offer while `GROUP_CONTEXT.md` or `GROUP_LOG.md` is unsupported.

```markdown
# Group: <directory name>

**Path:** `<root label>` / `<root-relative path>`, or `<absolute path>` (outside registered roots: ancestor group files not read; child tasks inherit nothing from this group file; run `init-config` to register a root)
**Inherited:** <ancestor group files read, root-relative> | none
**Group file:** `GROUP_CONTEXT.md` | none
**Other headings:** `## <heading>`, … (omit when none)
**Contradictions:** <both statements, quoted with their sources> (omit when none)
**Unsupported:** `<entry>`, … (omit when none)

## Direction
<section text> | none recorded

## Scope
<section text> | none recorded

**Scope drift:** no Scope line: `<child>`, …; no child task: "<Scope line>", … (omit when none)

## Decisions
<section text> | none recorded

## Open Questions
Group list: none recorded (only when the section is missing)

### <addressee>
- GQ<n> — <question> (asked: <where>) — answered: <answer>; awaits record in <home> (omit when not waiting); cited by `<child>` (also open: <its own open part>; omit when none)
- `<child>` (`<file>`) — <question>

### No addressee
- `<child>` (`<file>`) — <question>

### Answered in Decisions
- <Decisions line> — still cited as open by `<child>` (also open: <its own open part>; omit when none)

### Other group files
- `<child>` (`<file>`) — GQ<n>: see `<cited path>` (also open: <its own open part>; omit when none)

## Children
none (when the group has no child task)
- `<child>` — <status>; next: Step <n> — <title> | no pending step
- `<child>` — no plan
- `<child>` — plan unreadable: `<path>`
- `<child>` — legacy plan file: `<path>`, …; run `maintain` to rename it (when the child is under `<kit-root>/.agents/tasks/`)
- `<child>` — legacy plan file: `<path>`, …; rename it to `plan.md` by hand and repoint links in `<child>` that name it (for any other child)
- `<child>` — state unavailable: <stderr line> | helper unavailable: <reason>
    - `<diagnostic code>` `<file>:<line>` <detail>

**Nested groups:** <names> | none

**Offer:** <the § *Restructure* or § *New group file* offer> (omit when none)
```

## Group file entries

- A Decisions line holds one group-wide current rule or standing fact. It cites the `GROUP_LOG.md` entry of the change set that wrote it, such as `(GROUP_LOG.md § Change set — 2026-11-11: restructure)`. A line answering a group question starts with its id: `- GQ<n>: <rule> (<citation>)`.
- An Open Questions entry reads `- GQ<n> — <question> — ask <addressee> (asked: <where>)`. Take the next free id under `task-store.md` § *Shared group context*, reading `GROUP_LOG.md` only for its ids.
- A group question whose answer § *Change sets* step 7 sends to `DECISIONS.md` or an ancestor group waits in Open Questions. Its entry states the answer and names that home: `- GQ<n> — <question> — ask <addressee> (asked: <where>) — answered: <answer>; awaits record in <home>`. `<home>` is `<path>/DECISIONS.md` or `<path>/GROUP_CONTEXT.md § Decisions`, cited as § *Resolve the group* step 4 cites group files. When the home's file lies directly in the selected root, `<home>` cites that file by its absolute path.
- Once that home records the decision, the question's Decisions line points there instead of stating a rule: `- GQ<n>: see <record> (<citation>)`. `<record>` is `Decision #N — <path>`, or `<home>` itself for an ancestor group.
- A question keeps the addressee its wording or a cited source states. Ask for the others in one batch before writing.
- Create an absent `GROUP_LOG.md` with the title `# <directory name> log`.

## Restructure

The restructure is one change set over the group's own files and the task text that restates its questions or cites its headings. It runs only when you ask. Its offer maps each part of the file outside the four sections, by heading, to its destination: the log entry, Direction, Scope, Decisions, or Open Questions. It lists each decision it infers a later heading replaces, with both headings and the Decisions line that results. It lists each step 4 task edit with its file and its prior and new wording. It lists each fully answered task entry step 4 leaves unchanged, with its task and the group question it matches. That question stays open for you to answer in a later change set. It lists each `CONTEXT.md` or `ticket.md` citation that step 4 leaves because no line summarizes its heading's text. Each is a contradiction for you to resolve, listed with its file, its line, and the heading it names. It also lists, with its file and line, each other citation of a removed heading that step 4 leaves in place. Those include a task's citations under a dated decision heading or in a file the session never writes, such as `plan.md` or `result.md`. They also include each citation in any file of a task in Archive or Backlog, and in each nested group's `GROUP_CONTEXT.md`, Archive and Backlog included. The restructure changes none of them. In one batch, it asks for each missing addressee and about each task match or replacement with several defensible readings. Nothing is written before your request and those answers.

1. Draft one `## Change set — YYYY-MM-DD: restructure` entry for `GROUP_LOG.md`, numbering a repeated topic under § *Change sets* step 8. The entry holds your request and your answers to the offer. It then quotes, verbatim with each heading one level lower, the file's text below its title under **Prior text** and the four new sections under **New text**. Under **Edits**, it lists each task edit's file, section, prior wording and new wording. Under **Citations left**, it lists each citation of a removed heading that stays in a `plan.md` or `goals.md` below the group, outside Archive and Backlog. Each item gives the file, the line, and the heading the citation names.
2. Rewrite `GROUP_CONTEXT.md` as its title and the four sections:
    - **Direction:** the group's aim, as the file states it.
    - **Scope:** one line per direct child task, with what it covers and its owner as the file states them, or "not stated".
    - **Decisions:** one line per standing fact, constraint, or permission, and one line per decision still in force, each citing the entry. A decision that a later heading wholly replaces gets no line. Its text stays only in the log entry's **Prior text**. A partial replacement becomes one line stating the rule now in force. A replacement with several defensible readings follows your answer to the offer.
    - **Open Questions:** each unanswered or waiting question (§ *Group file entries*). A question with a `GQ<n>` id keeps it, and only a question without one gets a new id. An earlier number, such as "thread Q7", is kept as where it was asked.
3. Dated events and decision evidence leave the group file; the log entry keeps them.
4. **Task text.** Walk the tasks below the group outside Archive and Backlog, including tasks in nested groups, as § *Change sets* step 1 does. Find each such task's `CONTEXT.md` `## Open Questions` entry that restates a question step 2 gives a new id. An entry restates it when it names its earlier number, such as "see thread Q6", or repeats its wording. In each such entry not fully answered, replace only the restated question with the citing entry of § *Change sets* step 5. Keep the entry's partial answer and task-local facts after the citation. A match with several defensible readings follows your answer to the offer. Rewrite each such task's `CONTEXT.md` or `ticket.md` citation of a heading step 2 removes to the section now holding its text. When only the log entry keeps that text, cite the section whose line summarizes it, such as § Decisions for a dated decision still in force or partly replaced. Leave the citation unchanged when no line summarizes that text, as for a wholly replaced decision or a dated event that is not a decision. The offer and the step 5 reply list each such citation as a contradiction for you to resolve. Leave each citation under a task's dated `## Decision —` heading unchanged (`./references/workflow/context-schema.md` § *Field notes*). A task file whose edits § *Change sets* step 3 prevents stays unchanged, and the offer lists each edit it would have received. Change no other task text.
5. Just before writing, apply § *Change sets* step 9 to every file steps 2, 4, and 5 write, and to the plan status of each task step 4 edits. When that step would rebuild the change set, write nothing, say so, and make the offer again from the current files instead. Otherwise make the step 2 and 4 writes, then append the step 1 entry to `GROUP_LOG.md`. In the reply after these writes, flag each **Citations left** item for its owning skill under § *Change sets* step 4: `plan-task` for a `plan.md`, `reconcile-task` for a `goals.md`. § *Stop* lists these among the session's plan or goals flags. The reply also lists each contradiction step 4 left for you to resolve, with its file, line, and the heading it names.

## New group file

Offer a new `GROUP_CONTEXT.md` for a group without one, and for § *Init*. The offer asks for the Direction, Scope, Decisions and Open Questions to record. It also proposes each `GROUP_CONTEXT.md` line the session holds under § *Change sets*, with the held task edits that depend on it. Inside a registered root, it names every task below the group that would inherit the file, Archive and Backlog included. Outside every registered root, it warns that child tasks will not inherit the file, and names `init-config` to register a root. Nothing is written before you confirm.

Check the sections you state against the ancestor group files under § *Change sets* step 1, and reply with each held question as § *Change sets* step 10 does. The change set writes `GROUP_CONTEXT.md`, titled with the directory name, holding the sections you state and the held lines you confirm. A held question takes no `GQ<n>` id before this write. The write gives it the next free id under § *Group file entries*. The change set then appends one `## Change set — YYYY-MM-DD: new group file` entry to `GROUP_LOG.md`, numbering a repeated topic under § *Change sets* step 8. The entry holds your statement and, under **New text**, the sections written, with each heading one level lower. For each held line written, the entry also holds the instruction and decision record that § *Change sets* step 8 requires.

Just before these writes, apply § *Change sets* step 9. When a `GROUP_CONTEXT.md` entry of any kind has appeared in the group's directory since the offer, write nothing, say so, and print § *Brief* instead of rebuilding the change set.

After these writes, draft the held task edits that depend on the written lines as one new change set. Take § *Change sets* steps 1–3 with the written lines as the changed fact, so each step 5 citation names an id just assigned. Write it under step 9, with its own step 8 log entry. Under step 2, a user-invoked run applies it directly, and a model-invoked run proposes it and waits.

## Init

Init applies to a missing directory, or an existing one with no `GROUP_CONTEXT.md` entry and no task below it. It receives only paths that § *Resolve the group* steps 2 and 5 accept. Refuse it, writing nothing, when the parent directory is missing.

Otherwise make the § *New group file* offer, naming the directory it creates when missing. On confirmation, create the directory before writing the files. The session then continues on the new group with § *Brief*.

## Change sets

Turn each instruction into one change set over the files Core Rules lets the session write. When the group has no `GROUP_CONTEXT.md` entry, hold each line the change set would write there, such as a step 5 question or a step 7 Decisions line. Also hold each task edit that depends on a held line, such as a step 5 citation of a new `GQ<n>`. The change set's other edits proceed as usual. Only § *New group file* creates `GROUP_CONTEXT.md`.

1. **Find what it touches.** Search `GROUP_CONTEXT.md` and each task's `CONTEXT.md` and `ticket.md` for the changed fact: its `GQ<n>` id, its Decisions line, and prose that restates it. A task's mention of that id matches only when it cites this group's question under step 5. Find the tasks by walking the group's directory under `task-store.md` § *The root registry*, skipping Archive and Backlog containers case-insensitively. The walk stops at each task and descends through nested groups. Read each matching file in full before drafting its edit. Inside a registered root, also read the ancestor group files as § *Brief* step 1 does. Also read each nested group's `GROUP_CONTEXT.md` that the walk passes, without writing it. Before drafting, quote each material contradiction between the changed fact and an ancestor or nested group statement under `task-store.md` § *Shared group context*. Each becomes a step 2 question, and the edits that depend on it wait for the answer. Also before drafting, give each `GROUP_CONTEXT.md` `## Open Questions` entry without a `GQ<n>` id the next free id (§ *Group file entries*). Assign them in the section's order, before step 5 takes ids for new questions. Each such entry keeps its text after the id. Ask for a missing addressee in the § *Group file entries* batch. Step 8's log entry lists each assignment as an edit, with its prior and new wording.
2. **Consent.** A decision you state applies to every affected file. A change inferred from evidence you pass, such as a Slack link or a PR, follows `./references/workflow/reconciliation.md` § *Consent model: findings apply, the record carries them*. Its settled facts apply. An edit with several defensible readings becomes a question under `../../CORE_RULES.md` § *Ask Before Assuming*, and edits that depend on it wait for the answer. The change set records each such question at its home. A question about the group, or about several tasks, becomes a `GQ<n>` group question under step 5. A question about one task goes in that task's `CONTEXT.md` `## Open Questions`, even when it concerns the task's plan. Create a missing `CONTEXT.md` for it as step 3 does. A task step 3 bars from edits keeps its question in the reply only. A user-invoked run applies these edits directly; a model-invoked run proposes each change set and waits (`./references/workflow/skill-conventions.md` § *The invocation gate*).
3. **Task edits.** Read each task's plan status from disk as § *Brief* step 3 does. A task whose status is `skipped` gets no edit from steps 3–7, a created `CONTEXT.md` included (`./references/workflow/task-layout.md` § *Reading a resolved folder*). So does a task with an unreadable plan, a legacy plan file, or unavailable state. Check each task's `CONTEXT.md` and `ticket.md` without following links; one that is a symlink or other non-regular entry gets no edit. Follow these `reconciliation.md` sections. Task prose takes § *Grounding docs change on evidence, never silently*, and `ticket.md` takes § *The upstream ask is writable, and never rewritten quietly*. A task's own open question that the change answers takes § *Annotation formats*. Before step 5 or 7 writes to a task with no `CONTEXT.md` entry of any kind, create that file from `./references/templates/CONTEXT.md` under `./references/workflow/context-schema.md` § *The schema*. Infer its `**Domain:**` under `context-schema.md` § *Field notes*. Its `## Problem Statement` cites the task's `ticket.md` when one exists. Otherwise, take its framing from the first source that frames the task. Read the task's `plan.md` title or `## Scope`, then its `goals.md`, then the group's `## Scope` line naming the task's directory. When none frames the task, ask for the framing as a step 2 question that stays in the reply only. The edits that need the file wait for the answer. The created file is one of the change set's edits, with "none (file created)" as its prior wording.
4. **Plan and goals.** Search each task's `plan.md` and `goals.md` for the changed fact too, and leave both unchanged. Flag each impact with the skill that owns the edit under `./references/workflow/task-authorship.md` § *Files*: `plan-task` for a plan's scope or steps, and `reconcile-task` for a goal.
5. **New questions.** Add a group question under § *Group file entries*. Each task it concerns gets an Open Questions entry that cites the id instead of the question, as `task-store.md` § *Shared group context* defines it: `- GQ<n>: see <group path>/GROUP_CONTEXT.md`. Select each such task's root as that section does, and compare it with the group's root from § *Resolve the group* step 4. A task in an inner registered root, or below a group outside every registered root, gets the absolute group path. So does each task when the group is itself the root § *Resolve the group* step 4 selects. The entry names no section, so it still resolves after step 6 moves its id to Decisions. Task text cites one of this group's questions only when it names the id and a path that resolves to this group's `GROUP_CONTEXT.md` under that definition.
6. **Answers.** An answered group question leaves Open Questions and becomes a Decisions line that keeps its id (§ *Group file entries*). Each task entry that cites that question under step 5 becomes current guidance citing that line, under `reconciliation.md` § *Annotation formats*. The citation uses the group path step 5 gives that task. Every other entry with that id stays unchanged. Each change set also moves a group question another writer answered in place into Decisions the same way, citing the record that answer cites instead of the log entry. An answer binding several tasks, not all of which inherit this group's file, takes step 7's route instead. Its question then waits in Open Questions with that home, and the task entries citing it stay unchanged (§ *Group file entries*). Each change set also reads the home of each waiting question. Once that home records the decision, the question moves to Decisions as a line pointing there. Each task entry that cites it under step 5 then becomes current guidance as above. The change set also drafts the other task edits that waited on that decision, under steps 1–3 with the recorded decision as the changed fact.
7. **Decision homes.** A decision about one task that answers no group question goes under a dated decision heading in that task's `CONTEXT.md` (`./references/workflow/context-schema.md` § *Field notes*), even when the task has a result (`./references/workflow/one-home.md` § *One home per fact*). The task's current guidance cites that heading, and the group file gets no line. A decision binding several tasks, not all of which inherit this group's file, belongs where `task-store.md` § *Store-level artifacts* places it: an ancestor group's Decisions list or `DECISIONS.md`. It gets no Decisions line beyond step 6's pointer for a group question it answers. When you state such a decision and it answers no group question, it becomes a waiting group question with the next free id (§ *Group file entries*). So does such a decision that evidence you pass settles under step 2 and that answers no group question. Its question names the decision's subject, and its answer is the decision as you stated it or as the evidence settles it. Its addressee and where it was asked name your statement, such as `ask you (asked: start-group, YYYY-MM-DD)`. For a decision from evidence, they name that source instead, such as the link you passed. No task entry cites it under step 5. The edits that depend on the decision wait until you record it there. Step 6 applies them in the first change set that finds that record. Outside every registered root, each decision binding several tasks takes this route to `DECISIONS.md`. Every other decision becomes one Decisions line.
8. **Log entry.** Draft one `GROUP_LOG.md` entry under `task-store.md` § *Shared group context*, with a topic no earlier entry uses. A topic an earlier entry uses takes the next free number, such as `restructure 2`. It is the record that step 3's `reconciliation.md` sections require. It holds your instruction and its source. For each decision, it holds the question as worded, or your statement when none was asked, the answer, the rejected alternatives or "none stated", and the source. A one-task decision's evidence appears only as the new wording of its decision heading. A change set that writes no other file gets no entry.
9. **Write.** Just before writing, re-read every file in the change set, `GROUP_LOG.md` included. Also read the plan status of each task the change set edits, as § *Brief* step 3 does. When any file changed since the change set read it, write nothing, rebuild the change set from the current files, and say so. Do the same when such a task now has status `skipped`, an unreadable plan, a legacy plan file, or unavailable state. A user-invoked run applies the rebuilt set under step 2. A model-invoked run proposes the rebuilt set again and waits. Never write over the other change. Write the edits, then append the log entry.
10. **Reply.** List each edited file and section, then each plan or goals flag with its skill. List each task edit step 3 prevented, with the task and why: its plan status, or the unsupported file. Then list each held question, each held `GROUP_CONTEXT.md` line, and each decision to record in `DECISIONS.md` or an ancestor group's Decisions list, with the edits waiting on each. With a held `GROUP_CONTEXT.md` line, also make the § *New group file* offer.

## Lifecycle

Hand a request to create, park, or archive a child to its skill, under that skill's own invocation and confirmation rules. The session itself creates and moves no task folder.

- **Create:** `prepare-ticket` for one child, given a new folder inside the group's directory, or `decompose-task` for several, given the group's directory as the parent.
- **Park:** `backlog-task`. **Archive:** `archive-task`.
- A run the session starts on your request is model-invoked (`./references/workflow/skill-conventions.md` § *The invocation gate*). A confirm-gated skill on that section's roster proposes its run, and nothing moves before your confirmation.
- Report the skill's output as printed, including a refusal.
- When the run adds or removes a direct child task, rebuild the Scope drift from disk as § *Brief* step 6 does. For each added or removed child that drift names, offer a change set that adds or removes its Scope line. Apply an accepted offer as an instruction under § *Change sets*.
- Moving an existing task into the group is a manual move, outside the session (`./references/workflow/task-relocation.md` § *3. Report*).

## Stop

When you ask to stop, apply nothing still pending. Reply with each held question, each held `GROUP_CONTEXT.md` line, and each decision to record in `DECISIONS.md` or an ancestor group's Decisions list, the edits waiting on each, and each plan or goals flag from the session.

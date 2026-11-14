---
name: start-group
description: Use when asked to start, open, create, or manage a task group — opens a read/write session on one group of tasks. Prints a brief of the group's direction, scope, a Decisions summary, open questions, and each child task's plan status, next step, owner, and blockers. The brief then lists the group's blockers and the children ready now, ending with a paste-ready command for each. Prints it again from disk when asked what's next. Drafts a team status for the group's thread in chat on request, without posting it. Applies each instruction as one change set across the group file and the CONTEXT.md and ticket.md of every task below it outside Archive and Backlog, including tasks in nested groups. Leaves plan.md and goals.md to their owning skills, and child creation, parking, and archiving to theirs. Compacts a group file over its size budget, restructures an older one, or creates a new group only after you confirm.
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

Print the brief at start, when you ask what's next, and when the session continues after context compaction. Build it from disk each time.

1. **Group files.** Read the group's `GROUP_CONTEXT.md` in full. Report a `GROUP_CONTEXT.md` or `GROUP_LOG.md` that is a symlink or other non-regular entry as unsupported instead of following it (`task-store.md` § *Shared group context*). Measure a `GROUP_CONTEXT.md` that is a regular file by its size on disk in bytes, for example with `wc -c`. When that size exceeds the budget in `task-store.md` § *Shared group context*, print the **Size:** line with the size and the budget. Inside a registered root, also read the ancestor group files from the root down, without writing them. Report material contradictions with the group's file under `task-store.md` § *Shared group context*.
2. **Children.** Take the group's direct subdirectories under the walk's prunes (`task-store.md` § *The root registry*), skipping Archive and Backlog containers case-insensitively. Report each symlink, and each entry that is neither a file nor a directory, as unsupported (`task-store.md` § *Shared group context*). A subdirectory holding a role file as a regular file is a child task. Another that holds `GROUP_CONTEXT.md` or a task below it is a nested group, listed by name only.
3. **Plan status.** Before the first run, check that `<kit-root>/scripts/task-state.ts` exists. Run `node <kit-root>/scripts/task-state.ts <child-dir>` for each child, never with `--repair` (`./references/scripts/task-state.md`; `<kit-root>`: `task-store.md` § *Resolving `<kit-root>`*).
    - Exit 0: take `plan.status`, each step's number, title and checkbox, `nextPendingStep`, `currentState`, and each `structure.diagnostics` entry.
    - Exit 1 with a stderr line starting `[task-state]`: check the child's `plan.md` entry without following links, for example with `ls -ld`. An existing entry is an unreadable plan; report it with its path. Without one, check the child for legacy `*.plan.md` entries the same way. Report each one's path as a legacy plan file (`./references/workflow/task-layout.md` § *One task, one flat folder*). For a child under `<kit-root>/.agents/tasks/`, name `maintain` to rename it; `maintain` renames legacy files nowhere else. For any other child, tell the user to rename the file to `plan.md` by hand. Also tell them to repoint links in that folder that name the old file. A child with neither entry has no plan.
    - Exit 2: report the child's state as unavailable, with the stderr line.
    - Helper unavailable: the script is missing, an exit 1 has no stderr line starting `[task-state]`, or the exit is not 0, 1, or 2. Stop running the helper. Show every child's state as unavailable, citing the missing path, or the exit code and the stderr line naming the error.
4. **Questions.** Read only the `## Open Questions` section of each child's `CONTEXT.md` and `plan.md`, where each exists. Skip only fully answered entries, and show a partly answered entry by its open part. Add the group file's `## Open Questions`. Group all of them by the addressee each entry states. List under **You** each group question addressed `ask you`. Also list there each entry, or open part, marked "Awaiting decision" or recording a held choice with its options and a recommendation, when it states no other addressee (`reconciliation.md` § *Consent model: findings apply, the record carries them*). List the other entries without an addressee under **No addressee**. Apply § *Change sets* step 5's citation test to each child entry in either citation form of `task-store.md` § *Shared group context*. For an entry that cites this group's file, look up its id in the group file step 1 read. The lookup has the four outcomes of `task-store.md` § *Shared group context* and reads no other file. An answered-form entry whose id the lookup finds answered is fully answered. Show an open part of its own as that child's question. Each id answered this way gets one line under Answered in Decisions. That line shows the id as answered for every child citing it, and repeats no Decisions line text. An entry of either form that the lookup finds unresolvable appears under Unresolvable, with its child and file. Any other child entry that cites one of this group's questions under § *Change sets* step 5 appears once, under that question. Those include an answered-form entry whose id the lookup finds open or waiting. When the id instead starts a `## Decisions` line, the entry appears beside that line under Answered in Decisions. The brief leaves the entry unchanged. An open part of its own shows beside its child there. Any other child entry citing a `GQ<n>` id of another file, in either citation form, appears apart with that file's path.
5. **Older group files.** For each of the four sections the group file lacks, print "none recorded". List the file's other `##` headings by name. A group with no `GROUP_CONTEXT.md` entry is reported as having none.
6. **Scope drift.** When the group file read in step 1 holds a `## Scope` section, compare its lines with the step 2 child tasks. A Scope line names a child when it names the child's directory. Report each child task no Scope line names, and each Scope line that names no child task.
7. **Offers.** Offer § *Restructure* when `GROUP_CONTEXT.md` holds text outside the four sections, apart from its title. Otherwise, offer § *Compact* when the step 1 size exceeds the budget. Offer § *New group file* for a group with no `GROUP_CONTEXT.md` entry. Make no offer while `GROUP_CONTEXT.md` or `GROUP_LOG.md` is unsupported.
8. **Child lines.** Give each child task its owner. Treat a `done` or `skipped` plan as having no pending step, even when it has an unchecked step. Give a child with a pending step its next step and that step's blockers. Give a child without a plan its planning blockers.
    - **Owner:** take it from the group's `## Scope` line that names the child's directory (step 6). Print `owner <name>`, else `owner not stated`.
    - **Next step:** take the earliest unchecked step, in plan order, of the child's own plan that Current state's **Next:** names. When Next names no unchecked step of that plan, take `nextPendingStep`. When Next names steps of that plan and all are checked, mark Current state out of date.
    - **Depends on:** also read the `**Depends on:**` line under the next step's `### Step` heading in the child's `plan.md`. Never take it from task-state's `steps[].dependsOn`. A line that starts with `none` cites nothing. The line, or a Current state item, cites a task when it names that task's directory. A `Step <n>` directly after that name cites that step of the task.
    - **Blockers** of the next step come from three sources:
        - Current state: each item it says the next step waits on. When it holds the step without naming an item, the hold itself. The Depends on line's checks below also apply to an item that cites another step 2 child, a task in the group's Archive container, or a step of either. For a `blocked` or `in-review` child whose `currentState` is null, this source gives one item the task files record. That item is `Blocked section in result.md (no Current state)` or `In review section in result.md (no Current state)`, matching the status.
        - The Depends on line: each item it cites, under the checks below. An item the line names a fallback for blocks nothing.
            - Own step or group question: a step of the child's own plan while unchecked, and a group question while open.
            - Another child: one the line cites, or a cited step of it, blocks until the citation is met under `./references/workflow/task-siblings.md`. A cited child without a plan, or a cited step of it, blocks nothing when that child is recorded done as step 9 defines it.
            - Archived task: when the line cites a task that is not a step 2 child, look for its folder in the group's Archive container, matched case-insensitively. Run task-state on a folder found there as step 3 runs it, never with `--repair`. When the run exits 0, the check for another child applies to that archived task and its cited steps. A run that exits non-zero keeps the cited task or step blocking. Either way, a blocking archived task or step is named as that task.
            - Other item: any other item, such as a PR, a ticket, or a review, blocks unless Current state or an answered Open Questions entry records it done. A cited task that is neither a child nor in the group's Archive container, such as one inside a nested group, is such an item.
        - Open Questions from step 4: an open entry, or its open part, blocks only when the Depends on line cites it, it names the next step, or Current state names it as what the step waits on. A group entry names a child's step only beside that child's directory.
    - **Planning blockers:** only an open Open Questions entry that says the child's planning waits on it blocks a child without a plan.
    - **Kinds:** name each blocker once, as a group question `GQ<n>` with its addressee, a person, a PR, another child task, or another item the task files record, such as a ticket. Name a child's own question by its addressee, else by its subject. Print `nothing` when no blocker remains.
    - The blockers of an `in-review` or `blocked` child with no pending step are the items its Current state says it waits on. The Depends on line's checks apply to these items as the Current state source above applies them. Such a child shows `nothing` when none of them blocks. Such a child whose `currentState` is null shows the item the Current state source above gives it, instead of `nothing`. Any other child whose plan has no pending step shows no blockers. A child with an unreadable plan, a legacy plan file, or unavailable state also shows no blockers.
9. **Ready.** List each child that has work left and nothing blocking it:
    - A child without a plan whose planning shows `nothing`. A child without a plan is recorded done instead when the group file or its Open Questions record its work, or the ticket its Scope line names, as done. Its line shows `no plan; recorded done` and one file that records it, preferring the group file.
    - A child whose plan is `to-do`, `executing`, or `blocked` and whose next step shows `nothing`.
    - An `executing` or `blocked` child with no pending step, shown as `next: acceptance`. A `blocked` one qualifies only when its child line shows `waits on: nothing`.
    - For each ready child, print `/plan-task <token>` when it has no plan, else `/implement-task <token>`. The token follows `./references/workflow/task-layout.md` § *One task, one flat folder*: the bare slug where discovery resolves it, the folder path otherwise.
10. **Blockers list.** Name each distinct blocker from the child lines once, with the children it holds. Two lines name the same blocker when they name the same group question, person, PR, child task, or item. Order the list from the most children held to the fewest, and break ties by Children order.
11. **Decisions summary.** Print the number of Decisions lines and how many of them hold no log citation. Then print at most 8 lines that cite one of three kept change sets. A Decisions line is a line of the group file's `## Decisions` section that starts with `- `.
    - A line holds no log citation when it names no `GROUP_LOG.md § <heading>`, such as a line citing another writer's record (`task-store.md` § *Shared group context*, § *Change sets* step 6). Leave that count out when it is 0.
    - Read only the `## Change set` headings of `GROUP_LOG.md`, for example with `grep '^## Change set' GROUP_LOG.md`, and no other line of the log. A later heading is a more recent change set.
    - A line cites a change set when it names `GROUP_LOG.md § <heading>` with that heading's full text (§ *Group file entries*). Take the change sets that any Decisions line cites.
    - Skip each change set whose topic is `restructure` or `compaction`, alone or followed by a space and a number, such as `restructure 2` (§ *Change sets* step 8). Keep the three most recent of the rest.
    - Rank each line that cites a kept change set by the most recent kept change set it cites. Order those lines from the newest rank to the oldest, in section order within a rank.
    - Print the first 8 of them as written, and state how many of them are left out.
    - Print the counts alone when `GROUP_LOG.md` is missing or unsupported, or when no change set is kept.
    - When you ask for the full Decisions section, read `GROUP_CONTEXT.md` again and print that section as it stands on disk.

```markdown
# Group: <directory name>

**Path:** `<root label>` / `<root-relative path>`, or `<absolute path>` (outside registered roots: ancestor group files not read; child tasks inherit nothing from this group file; run `init-config` to register a root)
**Inherited:** <ancestor group files read, root-relative> | none
**Group file:** `GROUP_CONTEXT.md` | none
**Size:** <size> bytes, over the <budget> budget (omit when within it)
**Other headings:** `## <heading>`, … (omit when none)
**Contradictions:** <both statements, quoted with their sources> (omit when none)
**Unsupported:** `<entry>`, … (omit when none)

## Direction
<section text> | none recorded

## Scope
<section text> | none recorded

**Scope drift:** no Scope line: `<child>`, …; no child task: "<Scope line>", … (omit when none)

## Decisions
<n> lines, <r> without a log citation; showing <k> citing `<date>: <topic>`, … (<m> more; ask for the full section) | <n> lines, <r> without a log citation (ask for the full section) | none recorded (omit `, <r> without a log citation` when <r> is 0)
- <Decisions line, as written>

## Open Questions
Group list: none recorded (only when the section is missing)

### You
- GQ<n> — <question> (asked: <where>) — answered: <answer>; awaits record in <home> (omit when not waiting); cited by `<child>` (also open: <its own open part>; omit when none)
- `<child>` (`<file>`) — <question>

### <addressee>
- GQ<n> — <question> (asked: <where>) — answered: <answer>; awaits record in <home> (omit when not waiting); cited by `<child>` (also open: <its own open part>; omit when none)
- `<child>` (`<file>`) — <question>

### No addressee
- `<child>` (`<file>`) — <question>

### Answered in Decisions
- GQ<n>: answered for `<child>`, …
- <Decisions line> — still cited as open by `<child>` (also open: <its own open part>; omit when none)

### Unresolvable
- `<child>` (`<file>`) — GQ<n>: not in `GROUP_CONTEXT.md` | `GROUP_CONTEXT.md` missing or unreadable (also open: <its own open part>; omit when none)

### Other group files
- `<child>` (`<file>`) — GQ<n>: see `<cited path>` | GQ<n>: answered, see `<cited path>` (also open: <its own open part>; omit when none)

## Children
none (when the group has no child task)
- `<child>` (<owner>) — <status>; next: Step <n> — <title>; Current state out of date (omit when not); blocked by: <blocker>, … | nothing
- `<child>` (<owner>) — <status>; no pending step; waits on: <blocker>, … | nothing (omit `waits on` unless `in-review` or `blocked`)
- `<child>` (<owner>) — no plan; planning blocked by: <blocker>, … | nothing
- `<child>` (<owner>) — no plan; recorded done: `<file>`
- `<child>` (<owner>) — plan unreadable: `<path>`
- `<child>` (<owner>) — legacy plan file: `<path>`, …; run `maintain` to rename it (when the child is under `<kit-root>/.agents/tasks/`)
- `<child>` (<owner>) — legacy plan file: `<path>`, …; rename it to `plan.md` by hand and repoint links in `<child>` that name it (for any other child)
- `<child>` (<owner>) — state unavailable: <stderr line> | helper unavailable: <reason>
    - `<diagnostic code>` `<file>:<line>` <detail>

**Nested groups:** <names> | none

## Blockers
none (when no child line names a blocker)
- <blocker> — `<child>`, …

## Ready
none (when no child is ready)
- `<child>` — plan it | next: Step <n> — <title> | next: acceptance

**Offer:** <the § *Restructure*, § *Compact*, or § *New group file* offer> (omit when none)

**Run in a fresh session:** (omit when no child is ready)
- `/plan-task <token>` | `/implement-task <token>`
```

## Team status

When you ask for a team status, draft in chat a progress update for the group's discussion thread. Never post or send it, and write no file or Slack draft for it.

1. **Period.** Cover today, or the period you name.
2. **Reads.** Build § *Brief* from disk without printing it. Read no other file.
3. **Children.** Give each child task one line, in Children order:
    - Its ticket, from its Scope line, else from its Current state **Pointers:**. With no ticket in either, its subject: what its Scope line says it covers. A Scope line whose coverage reads "not stated" gives no subject. A child with neither a ticket nor a subject is unnamed.
    - Its status in plain words, from its plan status and Current state, or as recorded done.
    - A moved mark when its Current state `_Updated:` date falls in the period.
    - Its PRs, each with its role. Take the PRs its **Pointers:** record as its own. Add those its Current state, its child line, or a group file line naming it records as its base or blocker.
    - What it waits on, from its child line's blockers.
4. **Group events.** Add the group's events from each change set whose `## Change set` heading is dated in the period. Read each from its heading and the Decisions lines that cite it (§ *Brief* step 11). When no Decisions line cites such a change set, report it by its heading's topic and say its details are not shown. Leave out `restructure` and `compaction` change sets, as § *Brief* step 11 defines them.
5. **Language.** Write in the thread language that a group file Decisions line records, else in your request's language.
6. **Wording.** Name a child by its ticket, else by its subject from step 3, also where another child waits on it. Call an unnamed child an unnamed task, on its own line and where another child waits on it. Name each other blocker by a person, a ticket, a PR, or its subject. Leave out local step names and numbers, goal ids, group question ids, task folder names, and file paths. These rules bind only the draft. Above the draft, name each unnamed child by its folder name and say what it lacks.

```markdown
**Team status** — <period>; language: <language> (<Decisions line> | your request)
**Unnamed:** `<child>` (no ticket; no Scope line | no ticket; Scope line coverage not stated), … (omit when none)

<draft>
```

## Group file entries

- A Decisions line holds one group-wide current rule or standing fact and one citation. A change set that writes or rewrites a line cites its own `GROUP_LOG.md` entry, such as `(GROUP_LOG.md § Change set — 2026-11-11: restructure)`. A line holding an answer another writer recorded cites the record that answer cites instead (§ *Change sets* step 6). Who stated or agreed the rule, when, message links, commits, and PR or review state go to the change set's log entry. Names and ticket keys that the rule itself states stay in the line, such as a ticket's owner. A change set that rewrites or restates a Decisions line quotes the line's full prior wording, word for word, in its log entry. A line answering a group question starts with its id: `- GQ<n>: <rule> (<citation>)`.
- An Open Questions entry reads `- GQ<n> — <question> — ask <addressee> (asked: <where>)`. Take the next free id under `task-store.md` § *Shared group context*, reading `GROUP_LOG.md` only for its ids.
- A group question whose answer § *Change sets* step 7 sends to `DECISIONS.md` or an ancestor group waits in Open Questions. Its entry states the answer and names that home: `- GQ<n> — <question> — ask <addressee> (asked: <where>) — answered: <answer>; awaits record in <home>`. `<home>` is `<path>/DECISIONS.md` or `<path>/GROUP_CONTEXT.md § Decisions`, cited as § *Resolve the group* step 4 cites group files. When the home's file lies directly in the selected root, `<home>` cites that file by its absolute path.
- Once that home records the decision, the question's Decisions line points there instead of stating a rule: `- GQ<n>: see <record> (<citation>)`. `<record>` is `Decision #N — <path>`, or `<home>` itself for an ancestor group.
- A question keeps the addressee its wording or a cited source states. Ask for the others in one batch before writing.
- Create an absent `GROUP_LOG.md` with the title `# <directory name> log`.

## Restructure

The restructure is one change set over the group's own files and the task text that restates its questions or cites its headings. It runs only when you ask. Its offer maps each part of the file outside the four sections, by heading, to its destination: the log entry, Direction, Scope, Decisions, or Open Questions. It lists each decision it infers a later heading replaces, with both headings and the Decisions line that results. It lists each step 4 task edit with its file and its prior and new wording. It lists each fully answered task entry step 4 leaves unchanged, with its task and the group question it matches. That question stays open for you to answer in a later change set. It lists each `CONTEXT.md` or `ticket.md` citation that step 4 leaves because no line summarizes its heading's text. Each is a contradiction for you to resolve, listed with its file, its line, and the heading it names. It also lists, with its file and line, each other citation of a removed heading that step 4 leaves in place. Those include a task's citations under a dated decision heading or in a file the session never writes, such as `plan.md` or `result.md`. They also include each citation in any file of a task in Archive or Backlog, and in each nested group's `GROUP_CONTEXT.md`, Archive and Backlog included. The restructure changes none of them. In one batch, it asks for each missing addressee and about each task match or replacement with several defensible readings. Nothing is written before your request and those answers.

1. Draft one `## Change set — YYYY-MM-DD: restructure` entry for `GROUP_LOG.md`, numbering a repeated topic under § *Change sets* step 8. The entry holds your request and your answers to the offer. Under **Removed text**, it quotes the file's text that the four new sections do not carry, with each heading one level lower. That text includes each part the offer maps to the log entry, each decision a later heading wholly replaces, and the dated events and decision evidence step 3 moves out. Under **Edits**, it lists each heading of the prior file with its destination from the offer. It then lists each task edit's file and section, with the `GQ<n>` id it cites or the removed heading whose citation it rewrites. For each such edit to a `ticket.md`, or to a `CONTEXT.md` Recommended Direction, MVP Scope, Not Doing, or Key Assumptions section, it quotes the prior and new wording. Under **Citations left**, it lists each citation of a removed heading that stays in a `plan.md` or `goals.md` below the group, outside Archive and Backlog. Each item gives the file, the line, and the heading the citation names.
2. Rewrite `GROUP_CONTEXT.md` as its title and the four sections:
    - **Direction:** the group's aim, as the file states it.
    - **Scope:** one line per direct child task, with what it covers and its owner as the file states them, or "not stated".
    - **Decisions:** one line per standing fact, constraint, or permission, and one line per decision still in force, each citing the entry. A decision that a later heading wholly replaces gets no line. Its text stays only in the log entry's **Removed text**. A partial replacement becomes one line stating the rule now in force. A replacement with several defensible readings follows your answer to the offer.
    - **Open Questions:** each unanswered or waiting question (§ *Group file entries*). A question with a `GQ<n>` id keeps it, and only a question without one gets a new id. An earlier number, such as "thread Q7", is kept as where it was asked.
3. Dated events and decision evidence leave the group file; the log entry keeps them.
4. **Task text.** Walk the tasks below the group outside Archive and Backlog, including tasks in nested groups, as § *Change sets* step 1 does. Find each such task's `CONTEXT.md` `## Open Questions` entry that restates a question step 2 gives a new id. An entry restates it when it names its earlier number, such as "see thread Q6", or repeats its wording. In each such entry not fully answered, replace only the restated question with the citing entry of § *Change sets* step 5. Keep the entry's partial answer and task-local facts after the citation. A match with several defensible readings follows your answer to the offer. Rewrite each such task's `CONTEXT.md` or `ticket.md` citation of a heading step 2 removes to the section now holding its text. When only the log entry keeps that text, cite the section whose line summarizes it, such as § Decisions for a dated decision still in force or partly replaced. Leave the citation unchanged when no line summarizes that text, as for a wholly replaced decision or a dated event that is not a decision. The offer and the step 5 reply list each such citation as a contradiction for you to resolve. Leave each citation under a task's dated `## Decision —` heading unchanged (`./references/workflow/context-schema.md` § *Field notes*). A task file whose edits § *Change sets* step 3 prevents stays unchanged, and the offer lists each edit it would have received. Change no other task text.
5. Just before writing, apply § *Change sets* step 9 to every file steps 2, 4, and 5 write, and to the plan status of each task step 4 edits. When that step would rebuild the change set, write nothing, say so, and make the offer again from the current files instead. Otherwise make the step 2 and 4 writes, then append the step 1 entry to `GROUP_LOG.md`. In the reply after these writes, flag each **Citations left** item for its owning skill under § *Change sets* step 4: `plan-task` for a `plan.md`, `reconcile-task` for a `goals.md`. § *Stop* lists these among the session's plan or goals flags. The reply also lists each contradiction step 4 left for you to resolve, with its file, line, and the heading it names.

## Compact

The compaction is one change set over the group file's `## Decisions` section and `GROUP_LOG.md`. It runs only when you ask. It changes no other section and no task file. It skips § *Change sets* step 6, so questions answered in place and waiting questions stay in Open Questions. Its offer lists every bullet line of § Decisions in order, each with one outcome:

- **Kept:** the line already holds one rule or standing fact and one citation (§ *Group file entries*), and no later line wholly replaces it.
- **Restated:** the line is in force but holds more, such as evidence or several citations. The offer shows its new wording, which states the same rule with one citation under § *Group file entries*. A line that a later line partly replaces is restated as the part still in force. A line whose id the search below finds cited is restated when a later line wholly replaces it. Its new wording states the rule now in force, with one citation.
- **Moved:** the line is no longer in force, and the offer gives the reason. Such lines include a rule a later line wholly replaces, a dated event, and PR or review state.

A line of § Decisions that is not a bullet, such as a label above a group of lines, stays unchanged and unlisted. A restated line keeps its `GQ<n>` id. For each line that starts with an id, search the group's directory tree for citations of that id under § *Change sets* step 5. A citation names the whole id, so `GQ12` does not cite `GQ1`. The search covers Archive and Backlog and skips the group's own `GROUP_CONTEXT.md` and `GROUP_LOG.md`. Never move a line whose id the search finds cited; keep or restate that line.

The offer ends with the drafted file's size in bytes and the budget. When that size still exceeds the budget, the offer says so. It names the largest restated lines, if any, with their sizes, and asks which to tighten or move. The compaction cannot change text outside § Decisions, a line of § Decisions that is not a bullet, or a kept line. When that text alone exceeds the budget, the offer gives its size and says the compaction cannot bring the file within the budget. It adds that such text changes only through an ordinary instruction under § *Change sets*. In one batch, it also asks about each line whose outcome or new wording has several defensible readings. Nothing is written before you accept the offer and answer those questions.

1. Draft one `## Change set — YYYY-MM-DD: compaction` entry for `GROUP_LOG.md`, numbering a repeated topic under § *Change sets* step 8. The entry holds your request and your answers to the offer. Under **Removed text**, it quotes each moved line word for word, followed by the reason it left. Under **Edits**, it names `GROUP_CONTEXT.md` § Decisions. For each restated line, it names the line's `GQ<n>` id where it has one and quotes its full prior wording under § *Group file entries*.
2. Rewrite § Decisions as the offer drafts it: kept lines unchanged, restated lines in their new wording, and no moved line.
3. Just before writing, apply § *Change sets* step 9 to `GROUP_CONTEXT.md` and `GROUP_LOG.md`. When that step would rebuild the change set, write nothing, say so, and make the offer again from the current files instead. Otherwise make the step 2 write, then append the step 1 entry to `GROUP_LOG.md`.

## New group file

Offer a new `GROUP_CONTEXT.md` for a group without one, and for § *Init*. The offer asks for the Direction, Scope, Decisions and Open Questions to record. It also proposes each `GROUP_CONTEXT.md` line the session holds under § *Change sets*, with the held task edits that depend on it. Inside a registered root, it names every task below the group that would inherit the file, Archive and Backlog included. Outside every registered root, it warns that child tasks will not inherit the file, and names `init-config` to register a root. Nothing is written before you confirm.

Check the sections you state against the ancestor group files under § *Change sets* step 1, and reply with each held question as § *Change sets* step 10 does. The change set writes `GROUP_CONTEXT.md`, titled with the directory name, holding the sections you state and the held lines you confirm. A held question takes no `GQ<n>` id before this write. The write gives it the next free id under § *Group file entries*. The change set then appends one `## Change set — YYYY-MM-DD: new group file` entry to `GROUP_LOG.md`, numbering a repeated topic under § *Change sets* step 8. The entry holds your statement and names each section written. For each held line written, the entry also holds the instruction and decision record that § *Change sets* step 8 requires.

Just before these writes, apply § *Change sets* step 9. When a `GROUP_CONTEXT.md` entry of any kind has appeared in the group's directory since the offer, write nothing, say so, and print § *Brief* instead of rebuilding the change set.

After these writes, draft the held task edits that depend on the written lines as one new change set. Take § *Change sets* steps 1–3 with the written lines as the changed fact, so each step 5 citation names an id just assigned. Write it under step 9, with its own step 8 log entry. Under step 2, a user-invoked run applies it directly, and a model-invoked run proposes it and waits.

## Init

Init applies to a missing directory, or an existing one with no `GROUP_CONTEXT.md` entry and no task below it. It receives only paths that § *Resolve the group* steps 2 and 5 accept. Refuse it, writing nothing, when the parent directory is missing.

Otherwise make the § *New group file* offer, naming the directory it creates when missing. On confirmation, create the directory before writing the files. The session then continues on the new group with § *Brief*.

## Change sets

Turn each instruction into one change set over the files Core Rules lets the session write. When the group has no `GROUP_CONTEXT.md` entry, hold each line the change set would write there, such as a step 5 question or a step 7 Decisions line. Also hold each task edit that depends on a held line, such as a step 5 citation of a new `GQ<n>`. The change set's other edits proceed as usual. Only § *New group file* creates `GROUP_CONTEXT.md`.

1. **Find what it touches.** Search `GROUP_CONTEXT.md` and each task's `CONTEXT.md` and `ticket.md` for the changed fact: its `GQ<n>` id, its Decisions line, and prose that restates it. A task's mention of that id matches only when it cites this group's question under step 5. Find the tasks by walking the group's directory under `task-store.md` § *The root registry*, skipping Archive and Backlog containers case-insensitively. The walk stops at each task and descends through nested groups. Read each matching file in full before drafting its edit. Inside a registered root, also read the ancestor group files as § *Brief* step 1 does. Also read each nested group's `GROUP_CONTEXT.md` that the walk passes, without writing it. Before drafting, quote each material contradiction between the changed fact and an ancestor or nested group statement under `task-store.md` § *Shared group context*. Each becomes a step 2 question, and the edits that depend on it wait for the answer. Also before drafting, give each `GROUP_CONTEXT.md` `## Open Questions` entry without a `GQ<n>` id the next free id (§ *Group file entries*). Assign them in the section's order, before step 5 takes ids for new questions. Each such entry keeps its text after the id. Ask for a missing addressee in the § *Group file entries* batch. Step 8's log entry lists each id this step assigns.
2. **Consent.** A decision you state applies to every affected file. A change inferred from evidence you pass, such as a Slack link or a PR, follows `./references/workflow/reconciliation.md` § *Consent model: findings apply, the record carries them*. Its settled facts apply. An edit with several defensible readings becomes a question under `../../CORE_RULES.md` § *Ask Before Assuming*, and edits that depend on it wait for the answer. The change set records each such question at its home. A question about the group, or about several tasks, becomes a `GQ<n>` group question under step 5. A question about one task goes in that task's `CONTEXT.md` `## Open Questions`, even when it concerns the task's plan. Create a missing `CONTEXT.md` for it as step 3 does. A task step 3 bars from edits keeps its question in the reply only. A user-invoked run applies these edits directly; a model-invoked run proposes each change set and waits (`./references/workflow/skill-conventions.md` § *The invocation gate*).
3. **Task edits.** Read each task's plan status from disk as § *Brief* step 3 does. A task whose status is `skipped` gets no edit from steps 3–7, a created `CONTEXT.md` included (`./references/workflow/task-layout.md` § *Reading a resolved folder*). So does a task with an unreadable plan, a legacy plan file, or unavailable state. Check each task's `CONTEXT.md` and `ticket.md` without following links; one that is a symlink or other non-regular entry gets no edit. Follow these `reconciliation.md` sections. Task prose takes § *Grounding docs change on evidence, never silently*, and `ticket.md` takes § *The upstream ask is writable, and never rewritten quietly*. A task's own open question that the change answers takes § *Annotation formats*. Before step 5 or 7 writes to a task with no `CONTEXT.md` entry of any kind, create that file from `./references/templates/CONTEXT.md` under `./references/workflow/context-schema.md` § *The schema*. Infer its `**Domain:**` under `context-schema.md` § *Field notes*. Its `## Problem Statement` cites the task's `ticket.md` when one exists. Otherwise, take its framing from the first source that frames the task. Read the task's `plan.md` title or `## Scope`, then its `goals.md`, then the group's `## Scope` line naming the task's directory. When none frames the task, ask for the framing as a step 2 question that stays in the reply only. The edits that need the file wait for the answer. The created file is one of the change set's edits, and step 8's log entry lists it as created.
4. **Plan and goals.** Search each task's `plan.md` and `goals.md` for the changed fact too, and leave both unchanged. Flag each impact with the skill that owns the edit under `./references/workflow/task-authorship.md` § *Files*: `plan-task` for a plan's scope or steps, and `reconcile-task` for a goal.
5. **New questions.** Add a group question under § *Group file entries*. Each task it concerns gets an Open Questions entry that cites the id instead of the question, as `task-store.md` § *Shared group context* defines it: `- GQ<n>: see <group path>/GROUP_CONTEXT.md`. Select each such task's root as that section does, and compare it with the group's root from § *Resolve the group* step 4. A task in an inner registered root, or below a group outside every registered root, gets the absolute group path. So does each task when the group is itself the root § *Resolve the group* step 4 selects. The entry names no section, so it still resolves after step 6 moves its id to Decisions. Task text cites one of this group's questions only when it names the id and a path that resolves to this group's `GROUP_CONTEXT.md` under that definition.
6. **Answers.** An answered group question leaves Open Questions and becomes a Decisions line that keeps its id (§ *Group file entries*). Each task entry that cites that question under step 5 becomes the answered form that `task-store.md` § *Shared group context* defines. The citation uses the group path step 5 gives that task. The entry keeps its partial answer and task-local facts after the citation. It takes no `reconciliation.md` § *Annotation formats* edit and adds no dated decision heading to the task's `CONTEXT.md`. Every other entry with that id stays unchanged. Each change set also moves a group question another writer answered in place into Decisions the same way, task entries included. Its Decisions line cites the record that answer cites instead of the log entry. An answer binding several tasks, not all of which inherit this group's file, takes step 7's route instead. Its question then waits in Open Questions with that home, and the task entries citing it stay unchanged (§ *Group file entries*). Each change set also reads the home of each waiting question. Once that home records the decision, the question moves to Decisions as a line pointing there. Each task entry that cites it under step 5 then takes the answered form as above, citing this group's § Decisions. The change set also drafts the other task edits that waited on that decision, under steps 1–3 with the recorded decision as the changed fact.
7. **Decision homes.** A decision about one task that answers no group question goes under a dated decision heading in that task's `CONTEXT.md` (`./references/workflow/context-schema.md` § *Field notes*), even when the task has a result (`./references/workflow/one-home.md` § *One home per fact*). The task's current guidance cites that heading, and the group file gets no line. A decision binding several tasks, not all of which inherit this group's file, belongs where `task-store.md` § *Store-level artifacts* places it: an ancestor group's Decisions list or `DECISIONS.md`. It gets no Decisions line beyond step 6's pointer for a group question it answers. When you state such a decision and it answers no group question, it becomes a waiting group question with the next free id (§ *Group file entries*). So does such a decision that evidence you pass settles under step 2 and that answers no group question. Its question names the decision's subject, and its answer is the decision as you stated it or as the evidence settles it. Its addressee and where it was asked name your statement, such as `ask you (asked: start-group, YYYY-MM-DD)`. For a decision from evidence, they name that source instead, such as the link you passed. No task entry cites it under step 5. The edits that depend on the decision wait until you record it there. Step 6 applies them in the first change set that finds that record. Outside every registered root, each decision binding several tasks takes this route to `DECISIONS.md`. Every other decision becomes one Decisions line.
8. **Log entry.** Draft one `GROUP_LOG.md` entry under `task-store.md` § *Shared group context*, with a topic no earlier entry uses. A topic an earlier entry uses takes the next free number, such as `restructure 2`. It holds your instruction and its source. For each decision, it holds the question as worded, or your statement when none was asked, the answer, the rejected alternatives or "none stated", and the source. For a one-task decision, it names the dated decision heading in the task's `CONTEXT.md` instead of copying that record. It lists each edited file and section, naming the decision or `GQ<n>` id each edit applies. It serves as the record that step 3's `reconciliation.md` sections require. It quotes the prior and new wording of each `ticket.md` edit. It does the same for each edit to a `CONTEXT.md` Recommended Direction, MVP Scope, Not Doing, or Key Assumptions section. It quotes each piece of text the change set deletes from `GROUP_CONTEXT.md`, such as a Decisions line no longer in force. A rewritten line is an edit, not a deletion. It quotes each rewritten Decisions line's full prior wording under § *Group file entries*. It quotes no other text from an edited file. A change set that writes no other file gets no entry.
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

# Task Approach Comparisons

`approaches.md` is optional retained research and engineer selection. Copy `../templates/approaches.md`; placement follows `./task-layout.md`.

## Record shape

Use `**Decision:** pending` or `selected`, without a Status header. Link grounding in `CONTEXT.md` and any ticket or inherited sources.

Keep decision criteria, viable options, source evidence, trade-offs, research coverage, and unresolved questions where present. Use `A1`, `A2`, … for options, distinct from goal identifiers. Researcher count sets no option count.

Compare fit with existing patterns, complexity, compatibility, risk, effort, and maintenance. Each option states benefits, drawbacks, assumptions, and evidence. Separate source observations from inference and untested feasibility. Consolidate equivalent proposals; retain conflicting claims until checked against their sources.

Date research coverage. Report requested and completed independent native passes, failed or unavailable passes with reasons, and any inline fallback separately. Cross-vendor coverage follows `./probe-cross-check.md` when requested.

Include no raw probe transcripts, acceptance goals, or execution steps. Omit empty optional sections and template prompts.

## Selection and revision

`choose-approach` owns comparison and selection writes. A recommendation or researcher consensus leaves the decision pending until the engineer explicitly chooses.

Save pending research before asking for a choice. That pending save records the recommended option and its reasons. When selected, the current decision cites `## Decision — YYYY-MM-DD: <unique topic>`. Record the engineer's answer, selected option, rejected alternatives and reasons, and selection evidence there. Preserve the answer's meaning; mark unavailable reasons as unstated rather than inventing them.

Later research may refresh the current comparison. Preserve every dated decision, reopen, and decline record at its original anchor. Keep each decision's cited option descriptions, rejected alternatives, and supporting evidence there too. Append a new, uniquely anchored decision for a superseding choice and link the prior decision. Keep prior evidence in dated sections before replacing current option descriptions.

When the engineer reopens a selection, append `## Reopen — YYYY-MM-DD: <unique topic>`. Record the engineer's answer and its source there, and link the prior decision. Mark the current decision pending and cite that reopen record.

When the engineer declines an approach-wait entry presented for confirmation, append `## Decline — YYYY-MM-DD: <unique topic>`. Name the entry's decision and its source there, and record the engineer's answer. A decline record changes no current decision.

## Approach-wait entries

`start-group` records a decision that selects, supersedes, or reopens this record's approach as an approach-wait entry in the task's `CONTEXT.md` `## Open Questions`:

`- Approach decision — <decision> (stated: <source>) — awaits record in ./approaches.md by choose-approach; waiting: <edits>`

- `<decision>` is the decision as the engineer stated it or as the evidence settles it.
- `<source>` names the engineer's statement, such as `you, start-group, YYYY-MM-DD`. For a decision that evidence settles, it names that source instead, such as a link. Keep each entry's source unique across the task's `CONTEXT.md` entries and `approaches.md` records. Keep the plain source for its first use. For same-day repeats, append `(2)`, then increment past existing ordinals, such as `you, start-group, YYYY-MM-DD (3)`.
- `<edits>` names each edit that waits on the decision.

An entry is open until one of this record's dated records is its release record, whether or not `start-group` has answered the entry. `## Current decision` need not cite that record. A release record cites the entry's source. A selection's or supersession's release record is its dated decision anchor. A reopen's release record is its dated reopen anchor, even after a later selection. A declined entry's release record is its dated decline anchor. § *Selection and revision* gives each record's shape.

A release record ends the wait. Apply the entry's waiting edits only while `## Current decision` cites that release record. Apply none for a decline record.

An open entry holds planning and execution under § *Other readers and writers*.

## Other readers and writers

Planning verifies the selected choice against current sources and cites its dated anchor; it records only plan-time refinements. A pending comparison, an open approach-wait entry, or material evidence contradicting a selected choice holds the planner. A held planner writes no `plan.md`. It may write `goals.md`, a recognized pre-plan state (`./task-layout.md` § *Reading a resolved folder*). Its handoff names the deciding questions, the open entry, or the contradicting evidence, and routes to `choose-approach`. Execution starts or continues no step while this record reads `**Decision:** pending` or the task's `CONTEXT.md` holds an open approach-wait entry. It also neither starts nor continues a step that a plan `## Open Questions` entry citing this record gates. Both stops route to `choose-approach`. While this record reads `selected` and no approach-wait entry is open, execution starts or continues no step until the plan's `## Approach` cites the dated decision anchor that `## Current decision` cites. This approach-citation stop covers a plan citing an older anchor and a plan citing none. It routes to `plan-task`.

A `pending` comparison routes a task with or without a plan to `choose-approach`, with the unresolved deciding questions in its `## Current decision`. An open approach-wait entry also routes a task with or without a plan to `choose-approach`. Otherwise a `selected` comparison routes a task without a plan to `plan-task`, which cites the dated decision.

Other task workflows read and cite this record. They may flag evidence requiring revision but cannot change the comparison or selection. Result history indexes original decision, reopen, and decline anchors without copying their contents. General answer placement in `./one-home.md` does not relocate this evidence.

This file adds no task-recognition role, documentation deliverable, or automatic reference-sweep surface. Generic Markdown citation checks, folder budgets, and whole-folder moves still apply. The loader reads supplementary evidence but cannot rewrite it; preserve its repair refusals under `./task-authorship.md`.

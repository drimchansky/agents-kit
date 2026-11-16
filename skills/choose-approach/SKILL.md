---
name: choose-approach
description: Use when asked to compare implementation approaches through independent source research and discuss which to choose before planning. Retains pending research and the engineer's selection in approaches.md.
argument-hint: "[problem description, task slug or folder; defaults to the session's task] [-n N] [-x [N]]"
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.
2. Resolve `**Domain:**` from `CONTEXT.md`, defaulting to engineering. For missing context, infer it under `./references/workflow/context-schema.md` § *Field notes*. Apply `./references/<domain>/rules.md` and `exploration.md`; report missing files and use neutral methodology.

Compare approaches and discuss the choice. Write only `approaches.md` and a missing `CONTEXT.md`, apart from normal loader repairs. This skill creates no goals, plan, result, or lifecycle transition.

## Flags

- `-n N`: request N independent native research passes; default 1. Require a positive whole integer. Missing, zero, negative, fractional, or malformed counts stop for clarification before any launch. Resolve a count/task-input ambiguity with the user.
- `-x [N]`: add N independent cross-vendor source-research passes; omitted means none, bare means one. Apply `./references/workflow/probe-cross-check.md` and `./references/workflow/probe-engines-cross-vendor.md` only with this flag. A following decimal-digits token is a count unless task-input ambiguity requires clarification. Negative, fractional, zero, or malformed intended counts stop before any probe launches. Other tokens remain task input. Validate both flags before launching; use task resolution, not commit or PR parsing, to settle ambiguity. <!-- cold -->

## 1. Resolve and ground the task

Accept a problem description, existing refinement artifacts, a slug, a folder, or the current session's task. Use **resolve-or-create** and the session-task rule in `./references/workflow/task-layout.md` § *Discovery rules for skills*. For a supplied `CONTEXT.md` or `ticket.md` path, resolve its parent task folder. New destinations follow `./references/workflow/task-destinations.md`.

When a task has `plan.md` but no `approaches.md`, resolve § *3. Compare and discuss*'s save-or-unsaved choice before loading.

Apply `./references/workflow/task-layout.md` § *Reading a resolved folder* on existing tasks. Report repairs and unresolved diagnostics before relying on the returned state. Load inherited grounding before task-local context. A new destination reads its applicable chain under `./references/workflow/task-store.md` § *Shared group context* too.

Read the description, `CONTEXT.md`, and any `ticket.md`. Clarify a missing problem or consequential constraints before research. Scaffold missing context from `./references/templates/CONTEXT.md` under the schema, citing an existing ticket. Preserve existing framing and every existing core artifact from the post-loader baseline; write no semantic repair there.

Read any retained comparison under `./references/workflow/task-approaches.md`. Resume from its evidence and deciding questions instead of automatically repeating research. Launch further passes only for a specific unresolved question or an explicit request for fresh research. Keep prior coverage dated; distinguish it from newly requested passes. Also read each approach-wait entry in the task's `CONTEXT.md` `## Open Questions` (`./references/workflow/task-approaches.md` § *Approach-wait entries*).

An explicit read-only request suppresses all task writes, including scaffolding and comparison saves. A `skipped` task (`./references/workflow/task-lifecycle.md` § *Status values*) permits no task writes, including context scaffolding and comparison saves. Present unsaved research as such.

## 2. Research independently

Prepare one self-contained brief: problem, constraints, criteria, absolute working root, task paths, inherited sources, and relevant source locations. Separate settled constraints from unresolved choices. Give every researcher this same brief without preferred options, the session's recommendation, or other researchers' answers. A focused follow-up adds the same unresolved question for every pass.

Launch the requested native probes using `./references/workflow/probe-engines.md`, `./references/workflow/agent-fanout.md`, and `./references/workflow/probe-shape-approach-research.md`. Assign each its own scratch directory through `./references/workflow/agent-scratch.md` § *Assignment*. Supply applicable domain exploration guidance in each prompt. Start each without inherited session conversation or another pass's output.

With `-x`, launch the supplementary cold probes as soon as the common brief is ready, alongside native research. Use `./references/workflow/probe-cross-check.md` and its engine recipe, preserving content-sharing, scratch, and waiting requirements. Give every pass the same brief and dedicated approach prompt; provide no native answers. <!-- cold -->

Inspect sources while probes run. Collect them through `./references/workflow/delegated-waiting.md`; apply the dedicated prompt's synthesis rules. Source research excludes prototypes, benchmarks, builds, typechecks, and tests, including inline work. Leave runtime feasibility unverified when sources cannot settle it.

Retain successful passes when another fails. If native research is unavailable or returns no usable evidence, research the missing question inline within existing permissions. Report each failure or unavailable pass and label inline fallback; it never counts as an independent pass. Re-check unsupported claims inline without inventing coverage. If evidence remains insufficient, retain the gap for discussion.

Denied actions remain denied across every path. Stop the affected action, report the restriction, and continue only permitted source inspection. Fallback grants no broader access, experiment, vendor launch, or task write. A denied comparison save stays unsaved; claim no retained record.

With `-x`, pool completed cross-vendor proposals among themselves before merging that pool once with native research. Apply the dedicated prompt's synthesis and `./references/workflow/probe-cross-check.md` coverage rules. Retain successful source evidence when other passes drop; inline inspection adds no cross-vendor completion. <!-- cold -->

## 3. Compare and discuss

Consolidate evidence under `./references/workflow/probe-shape-approach-research.md` § *Synthesis*. Record the comparison through `./references/workflow/task-approaches.md`, using `./references/templates/approaches.md` for a new record.

Before saving a new comparison for a task with a plan, explain that saving holds the plan's execution. The hold lasts until selection is recorded and the plan cites that decision (`./references/workflow/task-approaches.md` § *Other readers and writers*). Offer an unsaved presentation and await the engineer's choice. Choosing it invokes § *1. Resolve and ground the task*'s read-only rule, including labeling the research unsaved.

For a new or reopened comparison, save it pending before presenting it. A reopen saves its dated reopen record too. Present each option's material consequences in neutral terms, one recommended option with reasons tied to those consequences, and the smallest deciding questions. Follow `../../CORE_RULES.md` § *Ask Before Assuming*, including its recommendation sequence. With one viable option, explain the constraint and ask only about remaining consequential choices; fabricate no alternative.

The engineer may choose any supported option, reopen a selection, request focused source research, or leave the choice pending. Record selection, supersession, or a reopen only from that explicit answer under the artifact's revision rules. An answer against the recommendation is still the engineer's choice. An ambiguous answer cannot select or supersede an approach; preserve the decision held before that answer.

An approach-wait entry that is no longer open under `./references/workflow/task-approaches.md` § *Approach-wait entries* needs no record or confirmation. Any other entry counts as the engineer's explicit answer when three conditions hold. Its source names the engineer's own statement, such as `you, start-group, YYYY-MM-DD (2)`. Its decision maps to exactly one supported option or unambiguously reopens the choice. Its stated date follows every dated decision, reopen, and decline record in `approaches.md`. Record such an entry under the artifact's revision rules, citing its source. Present each remaining entry for the engineer's explicit confirmation before recording anything. That covers an entry sourced from evidence, such as a link, and one matching no option or several. Record a confirmed entry the same way. When the engineer declines a presented entry, append its decline record under the artifact's revision rules. Leave each entry unchanged; `start-group` answers it from its release record.

## Output

Link the comparison and its current decision; state whether it was saved. Summarize the recommendation and its reasons, material trade-offs, unresolved questions, and any explicit selection. Cite original dated decision evidence for a selected record.

Report `Native research: completed <c>/<N>; <failed or unavailable pass numbers and reasons, or none>; inline fallback <used with reason or none>`. For resumed discussion without new research, say `Native research: reused <dated coverage>; no new passes requested`. Keep source evidence distinct from inference and untested feasibility.

Only when `-x` was requested, report exactly one `Cross-check:` outcome using `./references/workflow/probe-cross-check.md`; retain it in the comparison's research coverage too. Keep it separate from Native research. <!-- cold -->

Close with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*). Name the task token, loader repairs or unresolved diagnostics, retained or unsaved comparison, and pending deciding questions. When the saved comparison is pending and the task has a `plan.md`, Know also says it holds that plan's execution (`./references/workflow/task-approaches.md` § *Other readers and writers*). Next is continued `choose-approach` discussion while pending, or `/plan-task` after selection. With an existing plan, that `/plan-task` revises the plan so its `## Approach` cites the new decision before `/implement-task` runs. Selecting an approach does not authorize plan execution.

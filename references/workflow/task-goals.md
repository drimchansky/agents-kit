# The Goals File: Durable IDs, Cited by Step

The contract for `goals.md`: the testable acceptance criteria for "done", which every other artifact cites by ID. Quality bar: `./acceptance-criteria.md`. Copy-ready shape: `../templates/goals.md`. Folder placement: `./task-layout.md`.

`goals.md` is a static input: no `**Status:**` field and no `## Description`.

Each `- G<n> —` bullet leads with one user, caller, or operator outcome. Preserve the observable details that decide acceptance, including thresholds, compatibility, and failure behavior. Put commands and test recipes in the delivering plan step's `Verify`; the goal remains understandable without reading that step.

- **Durable, never-renumbered IDs.** Each goal carries a `G<n>` assigned once. Retire a goal by moving its bullet under a `## Retired` heading after `## Goals`, keeping its ID and wording and adding the date and reason. Current IDs may then leave gaps (`G1, G3` is fine). A new goal takes the next free number, never a retired one, so a step citing `G2` keeps pointing at the same goal across edits.
- **Retired IDs stay citable history.** Task Markdown may still name a retired goal, for example in decisions, records, and reconciliation entries. Plan Scope and step `**Goal:**` fields cite only current goals. Add an ID removed before this convention to `## Retired` when its old references are diagnosed as unknown.
- **Optional `(external)` marker** right after the ID (`- G5 (external) — <outcome>`), per `./acceptance-criteria.md` § *Externally-verified goals — the `(external)` marker*; absent means agent-verifiable.
- **Steps cite the goals they deliver.** Every plan step carries `**Goal:** G1, G3`, or `**Goal:** none (infra/refactor)` for a step with no user-visible goal. Coverage is then mechanical: every goal ID maps to at least one step, and every non-escaped step to at least one goal.
- **Scope is a partition of goal IDs.** A plan's `## Scope` lists delivered and deferred goals by explicit ID (`delivered: G1, G3 · deferred: G4`). No ranges: retired IDs leave gaps, so `G1-G3` is ambiguous once `G2` is gone.

**Text that only looks like an ID.** The structural scan reads every `G<n>` token in task Markdown as a goal reference, so `G1GC` is malformed and `G20` unknown. Write such text in inline code, a quotation, a fence, a blockquote, or an HTML comment; the scan skips those. Plan Scope and step `**Goal:**` fields still validate numeric IDs inside inline code. The ticket and the deliverable keep their wording: unknown or malformed IDs there are not diagnosed. A bracketed ID with no link definition, such as `[G1, G2]`, is plain text. A goal ID inside a link label is judged by the link's target. A target outside the task, or one the scan cannot resolve such as a `#fragment`, is diagnosed; write that ID as code.

Normal task loading repairs only proven identifier defects and their task-local references before assessing coverage (`./task-layout.md` § *Reading a resolved folder*). The repair preserves every goal's acceptance wording and never supplies evidence that it is met. An unresolved or failed repair leaves coverage unreliable until its diagnostics are addressed.

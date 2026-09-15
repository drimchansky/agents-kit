# Skill Conventions: How Behavior Varies

Classify new or changed variations as composites or flags. Keep protocols and write surfaces in each SKILL.md.

Different deliverables keep separate skill contracts, as `implement-task` and `implement` do.

## The rule

Default to **composites for sequential phases and flags for modal or interleaved behavior**, because complete phase outputs provide composition boundaries.

A tiny sequential phase may stay a flag; state that exception in the skill.

Whole-phase iteration stays composite; state its cap, exit criterion, and per-pass display rules there. Write permissions do not determine classification.

### The diagnostic

- Entirely before or after the base protocol, with its output complete and printed at the boundary: composite. Keep the base skill whole; the composite orders phases.
- Inside a phase, changing execution or merging intermediate work before verdicts finalize: flag.

Scattered flag conditionals suggest a misclassified phase. A modal flag modifies one phase.

## Current members

### Composites — sequential phases

- `review-code-triage-verify` — review a PR, branch, range, or path set; batch findings; verify each batch.
- `triage-findings-verify` — batch existing findings, then verify each batch.
- `maintain` — format sweep, health sweep, active-task listing, then session analysis. Its phases run inline without invoking sibling skills. It reconciles no task content; **Next** hands that to `resume-task-reconcile`. This composite has no base skill.
- `resume-task-reconcile` — print the resume brief, then reconcile docs to it.
- `review-task-reconcile` — print the plan assessment, then reconcile docs and incorporate answers.
- `decompose-task` — propose ordered sibling parts from an approved source; after confirmation, materialize each through `prepare-ticket` and seeded `CONTEXT.md`.

Pass each phase's modal flags through unchanged, except the `review-code-triage-verify` settle override below.

### Modal flags — interleaved behavior

- `--amend` (`commit`) — replace the latest commit, changing message selection, state guards, and verification within the commit workflow. The long form matches Git and avoids its staging flag `-a`.
- `-x` (`review-code`, `review-docs`, `review-task`) — use a cross-vendor read-only probe (`./probe-cross-check.md`), merging before verdicts finalize. A composite passes it to its review phase. Document one Flags entry, one launch line, and one `Cross-check:` output line per skill. `review-code-triage-verify` suppresses the review's standalone reviewer settle and, with `-x`, the probe's verify-before-adopt step. Its phase 3 verifies every candidate (`./reviewer-contract.md` § *The settle*).
- `-d` (`review-code`) — draft a PR description from the review's existing change map.
- `-n N` (`review-code`) — launch N independent reviewers within the review pass and pool returns before finalizing findings.
- `-f` (`proofread`) — verify facts during analysis, merging into its errors/improvements list before finalization.

## Adding a behavior

1. Apply the diagnostic.
2. For a composite, create a skill whose phases execute sibling skills, or run inline when no sibling provides that phase. Apply pipeline overrides: one Core Rules block, one Output, and composite-controlled **Next**. For a flag, update the host skill's Flags and `argument-hint`.
3. Register the behavior under **Current members**.

## The invocation gate

Disable model invocation for terminal filing or publishing skills without their own confirmation gate. Preview-and-confirm permits model invocation.

A **counted choice** also qualifies when every write option names its exact payload and size, and another option writes nothing. Write only the selection. A numbered chat list and a structured question qualify equally. Selecting a target alone does not authorize the act.

Also disable model invocation for sweeps beyond the current project, across registered roots or into installed state. A per-change confirmation does not authorize that sweep. Resolving one named task across roots is not such a sweep.

Close both host mechanisms together: SKILL.md frontmatter `disable-model-invocation: true` for Claude Code, and sibling `agents/openai.yaml` with `policy.allow_implicit_invocation: false` for Codex. `setup.ts` deploys both.

**Gated skills:**

- `update-pr-description` — replaces a live PR body.
- `archive-task` — files a task into `Archive/`.
- `backlog-task` — files a task into `Backlog/`.
- `maintain` — sweeps and rewrites installed state across every registered root.
- `init-config` — walks the home project parents and writes the machine's root registry.

Update this roster in the same change that opens or closes both host mechanisms.

Deliberate non-members:

- `publish-pr-review` offers counted severity tiers, including comment counts and posting nothing. Its selection gates the PR write.
- `create-notion-page` drafts and creates a parentless page in the user's Private section, visible only to them and cheap to delete. It shares nothing and changes no permissions.
- `commit` and `rebase` use the explicit-request authorization below.

Other skills produce local work or chat output, or confirm their own write, as `decompose-task` does.

Read invocation origin from the typed command opening the run; Claude Code supplies a preceding `<command-name>` block. Missing or indistinguishable markers count as **model-invoked**. Do not infer user invocation.

`skills/commit/SKILL.md` and `skills/rebase/SKILL.md` require an explicit request for their Git operation, including natural language. Skill selection alone authorizes neither write. An explicit engineering full-plan request grants checkpoint commits only under `./task-delivery.md` § *Checkpoint commits*. When `implement-task` runs `commit` there, that request is the explicit request `commit` requires. That sanction changes neither invocation flags nor this roster.

An open skill using invocation as consent states the user/model split beside that permission. Apply `./reconciliation.md` § *Consent model: findings apply, the record carries them* for reconcilers, or `./executor-routing.md` § *The registry and its authorization* for write-mode consumers.

## Cold citations

A SKILL.md citation marked `<!-- cold -->` on the same line is skipped on the typical invocation path. Unmarked citations load when the skill runs. The skill's own SKILL.md and core-rules citation (`AGENTS.md`) remain hot regardless of markers.

State the cold citation's loading condition beside it: a flag, file presence, or another conditional branch. The marker classifies the citation; it never supplies its condition.

One marker covers every citation on its line. Split citations with different conditions onto separate lines. A repeatedly cited file is cold only when every citation is marked; one unmarked citation makes it hot.

A condition reached on most runs is hot, including routine health boundaries. Split such a file into hot guidance and a conditional satellite before marking the latter cold.

The marker has no runtime interpreter; judge it against the loading path.

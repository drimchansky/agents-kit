# Skill Conventions: How Behavior Varies

Classify new or changed variations as composites or flags. Keep protocols and write surfaces in each SKILL.md.

Different deliverables keep separate skill contracts, as `implement-task` and `implement` do.

## The rule

Default to **composites for sequential phases and flags for modal or interleaved behavior**, because complete phase outputs provide composition boundaries.

A tiny sequential phase may stay a flag; state that exception in the skill.

Whole-phase iteration stays composite; state its cap, exit criterion, and per-pass display rules there. Write permissions do not determine classification.

A composite may supervise an in-flight phase through caller-supplied context; state that exception in the composite.

### The diagnostic

- Entirely before or after the base protocol, with its output complete and printed at the boundary: composite. Keep the base skill whole; the composite orders phases.
- Inside a phase, changing execution or merging intermediate work before verdicts finalize: flag.

Scattered flag conditionals suggest a misclassified phase. A modal flag modifies one phase.

## Current members

### Composites — sequential phases

- `review-code-triage-verify` — review a PR, branch, range, or path set; batch findings; verify each batch.
- `triage-findings-verify` — batch existing findings, then verify each batch.
- `maintain` — format sweep, health sweep, active-task listing, then session analysis. Its phases run inline without invoking sibling skills. It reconciles no task content; its Handoff's Next hands that to `resume-task-reconcile`. This composite has no base skill.
- `resume-task-reconcile` — print the resume brief, then reconcile docs to it.
- `review-task-reconcile` — print the plan assessment, then reconcile docs and incorporate answers.
- `decompose-task` — propose ordered sibling parts from an approved source; after confirmation, materialize each through `prepare-ticket` and seeded `CONTEXT.md`.
- `review-pr-loop` — review a PR and publish available findings before waiting for checks, then watch its head. Whole-phase iteration: the cap is 10 passes, a pass with no original Critical/Major findings and passing checks ends after APPROVE or COMMENT on the reviewer's own PR, and a closed PR ends it too. Each pass displays progress, provenance when a review completes, and every submission or its no-submission reason. It pins `publish-pr-review`'s supplied tiers and selection, its own gate carrying that consent, and substitutes the PR's checks for the review phase's verification scripts. Its head checks run inside the review phase under § *The rule*'s supervision exception.

Pass each phase's modal flags through unchanged, except the `review-code-triage-verify` settle override below.

### Modal flags — interleaved behavior

- `--amend` (`commit`) — replace the latest commit, changing message selection, state guards, and verification within the commit workflow. The long form matches Git and avoids its staging flag `-a`.
- `-x` (`review-code`, `review-docs`, `review-task`) — use a cross-vendor read-only probe (`./probe-cross-check.md`), merging before verdicts finalize. A composite passes it to its review phase. Document one Flags entry, one launch line, and one `Cross-check:` output line per skill. `review-code-triage-verify` suppresses the review's standalone reviewer settle and, with `-x`, the probe's verify-before-adopt step. Its phase 3 verifies every candidate (`./reviewer-contract.md` § *The settle*).
- `-d` (`review-code`) — draft a PR description from the review's existing change map.
- `-n N` (`review-code`) — launch N independent reviewers within the review pass and pool returns before finalizing findings.
- `-f` (`proofread`) — verify facts during analysis, merging incorrect ones into its errors list before finalization and rendering every checked claim once in its Facts ledger (`./user-facing-messages.md` § *Blocks*).

## Adding a behavior

1. Apply the diagnostic.
2. For a composite, create a skill whose phases execute sibling skills, or run inline when no sibling provides that phase. Apply pipeline overrides: one Core Rules block and one Output, closed by one Handoff in place of the inner skills' blocks (`./user-facing-messages.md` § *Blocks*). For a flag, update the host skill's Flags and `argument-hint`.
3. Register the behavior under **Current members**.

## The invocation gate

A run is **user-invoked** through either of two doors.

- **Typed command.** Read from the host's marker: Claude Code's preceding `<command-name>` block; on Codex, the user's own `$<name>` mention. A host whose marker cannot tell a typed command from a skill the model loaded counts the run as model-invoked.
- **Confirmed proposal.** Read from the exchange that preceded the launch: the agent proposed one run naming the skill, its arguments, and the writes it will cover, Git mutations included, and asked as a question; the user confirmed with the word the question names or an explicit yes, in chat or through the structured question tool. A bare acknowledgement confirms nothing; ask again. "yes", "go", or the word the question names confirms; "ok", "thanks", "nice", or a reaction emoji acknowledges. This door needs no host marker.

Every other run is **model-invoked**, including one the model starts from a loose request. Do not infer user invocation.

Silence, and any reply made while no question is pending, open nothing. A write the proposal left unnamed takes its own confirmation; the run stays user-invoked. The grant is run-scoped: it covers the proposed run alone, and a later run proposes again.

A confirmed proposal carries the sanctions the first door carries. They are the task branch and worktree lifecycle (`./task-delivery.md` § *Branch and worktree creation* → **The sanction**), executor delegation (`./executor-routing.md` § *The registry and its authorization*), and reconciler auto-apply (`./reconciliation.md` § *Consent model: findings apply, the record carries them*). Every sanctioned write, these three included, holds only when the proposal named it. `fix-findings`' commit per concern batch is one such write (`skills/fix-findings/SKILL.md` § *Batch commits*).

A skill whose run or first write needs that consent is **confirm-gated**. Membership follows one of three grounds: a filing or publishing write with no preview of its own, a sweep beyond the current project, or the user's preference. A filing or publishing skill that previews its computed payload before a single write gates itself and stays off this roster. A sweep stays on the roster whatever it previews. A confirm-gated skill carries, directly after its Core Rules block, this exact line: ``**Model invocation:** requires a confirmed proposal (`./references/workflow/skill-conventions.md` § *The invocation gate*).`` Its protocol places the proposal ahead of its first write. Set neither `disable-model-invocation: true` in its frontmatter nor `allow_implicit_invocation: false` in an `agents/openai.yaml`; the first blocks Claude Code's skill tool and the second blocks Codex's implicit invocation, each its host's second door.

A model-invoked run makes that proposal and waits; the confirmation opens the second door for the writes the proposal named. A user-invoked run has passed it; a preview of a payload computed during the run, where the protocol keeps one, still runs.

A **counted choice** qualifies as the proposal when every write option names its exact payload and size, and another option writes nothing. Write only the selection, from a numbered chat list or a structured question alike. Selecting a target alone does not authorize the act.

A sweep beyond the current project, across registered roots or into installed state, is an action the proposal names by scope. A per-change confirmation does not authorize it, and resolving one named task across roots is not such a sweep. Reading the registry and checking that its paths exist builds the scope proposal and is not the sweep.

**Confirm-gated skills:**

- `implement` — the user's preference for explicit invocation; the proposal is its § *1. Frame the Ask*.
- `fix-findings` — the user's preference for explicit invocation; the proposal is its § *The Gate: Auto vs Ask*.
- `explore` — the user's preference for explicit invocation; the proposal is its § *Determine Scope*.
- `update-pr-description` — a publishing write with no preview of its own; the proposal is its § *Preconditions — stop if unmet*.
- `review-pr-loop` — a publishing write with no preview of its own; the proposal is its § *Setup*.
- `archive-task` — a filing write with no preview of its own; the proposal is its § *1. Resolve the target task folder*.
- `backlog-task` — a filing write with no preview of its own; the proposal is its § *1. Resolve the target task folder*.
- `maintain` — a sweep beyond the current project; the proposal is its § *Setup — resolve targets*.
- `init-config` — a sweep beyond the current project; the proposal is its § *2. Discover the roots on disk*.

Update this roster in the same change that adds or removes a skill's `**Model invocation:**` line. `README.md` § *Skills* carries the confirm-gated count and each `Confirm-gated.` label as a sanctioned copy per `AGENTS.md` § *Consumer lists*; update them with the roster.

Skills that gate their own write another way stay off the roster:

- `publish-pr-review` offers counted severity tiers, including comment counts and posting nothing. Its selection gates the PR write, except under `review-pr-loop`, whose own gate carries that consent.
- `create-notion-page` drafts and creates a parentless page in the user's Private section, visible only to them and cheap to delete. It shares nothing and changes no permissions.
- `commit` and `rebase` use the explicit-request authorization below.
- `prepare-daily-status` drafts in chat; an explicit send, update, or Slack-review request authorizes its matching Slack write. Selecting the skill does not authorize delivery.
- `prepare-release-announcement` prepares chat copy and requires a user request for Slack delivery or revision. Its drafting capability remains discoverable.
- `prepare-epic` drafts to a confirmed file. An explicit push request authorizes creating the tracker epic; selecting the skill does not authorize that write.

Other skills produce local work or chat output, or preview their own write, as `decompose-task` does.

`skills/commit/SKILL.md` and `skills/rebase/SKILL.md` require an explicit request for their Git operation, including natural language. Skill selection alone authorizes neither write. An explicit request to implement an engineering task grants checkpoint commits under `./task-delivery.md` § *Checkpoint commits*; through the second door, only a proposal that named them. When `implement-task` runs `commit` there, that request is the explicit request `commit` requires. A `fix-findings` run grants concern-batch commits only under `skills/fix-findings/SKILL.md` § *Batch commits*. There, the invocation through either door is the explicit request `commit` requires. Through the second door, the proposal must have named the batch commits. Those sanctions change nothing on this roster.

An open skill using invocation as consent states the user/model split beside that permission. Apply `./reconciliation.md` § *Consent model: findings apply, the record carries them* for reconcilers, or `./executor-routing.md` § *The registry and its authorization* for write-mode consumers.

## Cold citations

A SKILL.md citation marked `<!-- cold -->` on the same line is skipped on the typical invocation path. Unmarked citations load when the skill runs. The skill's own SKILL.md and core-rules citation (`AGENTS.md`) remain hot regardless of markers.

State the cold citation's loading condition beside it: a flag, file presence, or another conditional branch. The marker classifies the citation; it never supplies its condition.

One marker covers every citation on its line. Split citations with different conditions onto separate lines. A repeatedly cited file is cold only when every citation is marked; one unmarked citation makes it hot.

A condition reached on most runs is hot, including routine health boundaries. Split such a file into hot guidance and a conditional satellite before marking the latter cold.

The marker has no runtime interpreter; judge it against the loading path.

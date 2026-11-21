# Delegated Review Session

This file is for the session that launches and settles delegated reviewers. Its reviewers follow the companion `./reviewer-contract.md` and do not open this one.

## The launch

Launch the named native `reviewer` adapter using § *Adapter defaults* and a packet built from host Setup.
Each primary reviewer independently reviews the complete object.
`-n N` counts complete passes, never a split by concern or path.
Generic or targeted probes cannot substitute for primary reviewers.

Use inline review only when the user explicitly asks for it or for a listed § *Degrade rule* failure, recording its concrete reason on `Review pass:`.
Review size, simplicity, available context, and the pinned model's standing relative to the session model do not establish failure.

## Safety blocks

Require an explicit security-denial signal preventing a usable pass: non-None Safety blocked, or a denied-launch host signal. A denied check within a complete return takes ordinary intake; other failures take § *Degrade rule*. Preserve only the supplied code/message. Infer neither the triggering operation nor a code defect from the denial.

Denied work cannot retry through the session, another reviewer, `-x`, or a later composite phase. Keep completed verification outcomes. Remaining scripts are unavailable unless the signal establishes independence from the denied operation and existing authorization.

A blocked fleet member is unavailable; usable returns stand with reduced coverage recorded. If none stands, terminally block the review: no inline fallback or clean/no-findings rendering. Report cross-check output only as unattached evidence, not a primary-review substitute.

## The settle

The host owns final verdicts (`./agent-fanout.md`). Classify explicit safety signals first under § *Safety blocks*. Before settlement or post-return launches, check in order:

1. **Identity:** match the Setup-recorded identity. On mismatch, stop and report without settlement or further launches.
2. **Completeness:** require every return heading; an explicit None counts as present. Identity, Verification scripts, Change map, and Summary require the content `./reviewer-contract.md` § *The return* states. Malformed returns take § *Degrade rule* as `reviewer failed`.

For fleets, check every return. Record unavailable members and reasons; pool survivors by location under `./agent-fanout.md` § *Merge contract*, with completed/requested coverage. If none survives, prioritize identity hard stop, then safety-block outcome, then degrade. Losing reviewer 1 requires session-run verification before output, subject to Safety blocks if that reviewer was blocked. Under a packet substituting its own evidence, or carrying the PR-form skip (`verification scripts: skip — the session reads the PR's checks`) or the fork-PR skip, the session runs nothing instead.

After intake:

- Adopt cited findings; re-derive or drop uncited ones. Pass Improvements through.
- Spot-check only Critical/Major anchors against the object. Also spot-check each Critical/Major `Pre-existing` label against the merge-base and the diff (`../engineering/review.md` § *Pre-existing findings*). Remove the label when the merge-base lacks the defect or the diff reaches or worsens it. Remove it too when either check is unclear. Keep the finding's severity; pooled returns that disagree on a label leave the entry unlabeled. Use `git show <head-sha>:<path>` for Divergence paths; Minor findings settle on citations.
- Assign final verdicts and mark changed severities.
- Merge `-x` before finalizing findings (`./probe-cross-check.md`).

Composites running `./verify-pipeline.md` § *The review phase* suppress these post-intake steps because their verify phase assigns each finding's verdict. Intake and the `Pre-existing` label spot-check still run.

On every path, including composites and identity hard stops, remove each reviewer's scratch directory under `./agent-scratch.md` § *Cleanup*, whether or not that reviewer returned.

## Adapter defaults

The install root is the directory holding the kit's `skills/`: `~/.claude` or `~/.codex` for a `setup.ts` install, or the plugin root for a Claude Code plugin install. Adapters: `agents/reviewer.md` under the Claude install root, launched as `agents-kit:reviewer` from the plugin, and `~/.codex/agents/reviewer.toml`. Read model for `Review pass:` and effort for launch announcements. Claude uses `model:`/`effort:`; Codex uses `model =`/`model_reasoning_effort =`. Prompt posture supplements withheld tools (`./probe-engines.md`); live security remains authoritative.

Inherit the parent session's permissions; omit sandbox, approval, and network overrides from the Codex adapter. Verification writes require permission from the parent; the reviewer's no-edit posture still applies.

Unresolved pins in a `setup.ts` install require user retuning in the installed definition and removal of its sibling `.agents-kit-reviewer` marker (`./executor-routing.md` § *Write-mode engine registry*). A plugin install has no durable retune: each update replaces its cached definition. Report and fall back inline; make no installation edits. A kit adapter cites installed reviewer-contract.md in its body. Other same-name definitions are user agents: do not launch them with this packet; report `adapter not installed`.

## Degrade rule

Subject to Safety blocks, announce an explicit user request or an unavailable or unusable delegated review, and run the host's inline pass. Preserve object, root, and output obligations. Always record `Review pass:` as `delegated (<model>)` or `inline (<reason>)`. Reasons are limited to:

- `user requested`: the user explicitly asked for an in-session review pass.
- `no subagent support`: host cannot launch subagents.
- `adapter not installed`: absent kit adapter or definition missing the `reviewer-contract.md` citation.
- `adapter not registered`: kit file exists but launch reports unknown agent type.
- `unresolved model pin`: the pinned model does not resolve on this host.
- `reviewer failed`: no return, ordinary non-security error, or malformed report. A consumer's deliberate cancellation is not a failure (`../../skills/review-pr-loop/SKILL.md` § *Review head checks*).

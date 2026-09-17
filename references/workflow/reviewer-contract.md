# Delegated Review Contract

A read-only reviewer examines one identified object, runs verification, and returns evidence. Method: `../engineering/review.md`. Final verdicts and rendering belong to the host skill. Posture, Launch packet, and The return address reviewers; other sections address the session.

## Posture

- **Read-only:** edit no review-object or tracked file; stage nothing and mutate no Git state.
- **Execute-only verification:** run project scripts over the reviewed set and reproduce candidates in scratch (`../engineering/review.md` § *Verification Scripts*).
- **Instruction hierarchy:** before review, load effective-root AGENTS/CLAUDE and the packet's CORE_RULES and engineering rules. Apply their invariants as review lenses.
- **Security:** live parent sandbox, approval, and managed policies override defaults and this contract. Preserve access boundaries. A denial preventing a usable pass is Safety blocked; otherwise record the denied check under Verification scripts without retrying.
- **No nested fan-out:** the session launches and settles any `-x` cross-check.

## Launch packet

Supply the object by identity, not pasted text:

- A `pr` diff, `<base>...HEAD` or `<merge-base>...<b>`, with head and merge-base SHAs; or a `paths` set at one commit, with head SHA and path-list digest.
- One absolute effective root, possibly a worktree.
- PR context and every extracted URL.
- Absolute paths under the install root (§ *Adapter defaults*) for `../engineering/review.md`, its per-surface checklists, CORE_RULES, and `../engineering/rules.md`.
- User context/constraints verbatim or `none`; host Review Focus verbatim; verification-scripts instruction.

The reviewer:

- Requires an unambiguous object, identity, and root from an authorized § *Consumers* packet; otherwise reports the gap and reviews nothing.
- Recomputes a paths-set digest and assembles the object using:

    ```bash
    git ls-files --full-name --error-unmatch -- <paths> | LC_ALL=C sort | git hash-object --stdin
    ```

    Preserve `LC_ALL=C` and `--full-name`; digest mismatch hard-stops settlement.
- Runs commands at that root, without inferring another from adapter or shell.
- Fetches links and reports inaccessible context; loads triggered checklists.
- Builds the change map and searches blast radius for every modified export.
- Runs verification and reproduces candidate failures before adoption. For multiple reviewers, only reviewer 1 receives this instruction; others receive `verification scripts: skip — reviewer 1 runs them`. A packet substituting its own evidence names its own skip reason instead. Conflicting constraints follow § *Posture*.

## The return

Return evidence only, without final verdict or audience-facing artifact. Include every heading; empty fields use `None`, subject to § *The settle*'s four required substantive fields:

- `Summary`: changes, intent, and assessment (approve/request changes/needs discussion). For paths, explain the set and give its health assessment (`../engineering/review.md` § *Reviewing a path set*).
- `Findings`: `../engineering/review.md` § *Findings output shape*, with file:line evidence and a one-line excerpt.
- `Improvements`: non-blocking suggestions; file:line optional.
- `Identity`: object identity resolved at the effective root.
- `Verification scripts`: every launched script and outcome, with failures/warnings merged into Findings. Name unexposed scripts as skipped. A packet's skip instruction returns `skipped (<the packet's reason>)`, not None.
- `Divergence`: every reviewed path differing on disk from the object (`../engineering/review.md` § *Verification Scripts*). Keep failures/reproductions on divergent bytes here, excluded from Findings.
- `Inaccessible context`: each unfetched URL and reason, with no invented content.
- `Change map`: files grouped by intent, or by concern for paths sets.
- `Safety blocked`: None for completed passes, including denied checks. Otherwise give only the host's exact error code/message and completed evidence elsewhere. Substantive-field requirements are waived for these blocked returns.

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
2. **Completeness:** require every return heading; an explicit None counts as present. Identity, Verification scripts, Change map, and Summary require content. Scripts list each exposed command/outcome, `none exposed`, or `skipped (<the packet's reason>)`. Malformed returns take § *Degrade rule* as `reviewer failed`.

For fleets, check every return. Record unavailable members and reasons; pool survivors by location under `./agent-fanout.md` § *Merge contract*, with completed/requested coverage. If none survives, prioritize identity hard stop, then safety-block outcome, then degrade. Losing reviewer 1 requires session-run verification before output, subject to Safety blocks if that reviewer was blocked. Under a packet substituting its own evidence, the session runs nothing instead.

After intake:

- Adopt cited findings; re-derive or drop uncited ones. Pass Improvements through.
- Spot-check only Critical/Major anchors against the object. Use `git show <head-sha>:<path>` for Divergence paths; Minor findings settle on citations.
- Assign final verdicts and mark changed severities.
- Merge `-x` before finalizing findings (`./probe-cross-check.md`).

Composites running `./verify-pipeline.md` § *The review phase* suppress these post-intake steps because their verify phase assigns each finding's verdict. Intake still runs.

## Consumers

Authorization membership: `review-code` launches reviewers; `review-code-triage-verify` and `review-pr-loop` consume them through their review-code phase. The packet gate checks this list. Like `./executor-contract.md` § *Bindings*, it defines authorization rather than reconstructing citations.

## Adapter defaults

The install root is the directory holding the kit's `skills/`: `~/.claude` or `~/.codex` for a `setup.ts` install, or the plugin root for a Claude Code plugin install. Adapters: `agents/reviewer.md` under the Claude install root, launched as `agents-kit:reviewer` from the plugin, and `~/.codex/agents/reviewer.toml`. Read model for `Review pass:` and effort for launch announcements. Claude uses `model:`/`effort:`; Codex uses `model =`/`model_reasoning_effort =`. Prompt posture supplements withheld tools (`./probe-engines.md`); live security remains authoritative.

Inherit the parent session's permissions; omit sandbox, approval, and network overrides from the Codex adapter. Verification writes require permission from the parent; the reviewer's no-edit posture still applies.

Unresolved pins in a `setup.ts` install require user retuning in the installed definition and removal of its sibling `.agents-kit-reviewer` marker (`./executor-routing.md` § *Write-mode engine registry*). A plugin install has no durable retune: each update replaces its cached definition. Report and fall back inline; make no installation edits. A kit adapter cites installed reviewer-contract.md in its body. Other same-name definitions are user agents: do not launch them with this packet; report `adapter not installed`.

## Degrade rule

Subject to Safety blocks, announce an explicit user request or an unavailable or unusable delegated review, and run the host's inline pass. Preserve object, root, and output obligations. Always record `Review pass:` as `delegated (<model>)` or `inline (<reason>)`. Reasons are limited to:

- `user requested`: the user explicitly asked for an in-session review pass.
- `no subagent support`: host cannot launch subagents.
- `adapter not installed`: absent kit adapter or definition missing this contract citation.
- `adapter not registered`: kit file exists but launch reports unknown agent type.
- `unresolved model pin`: the pinned model does not resolve on this host.
- `reviewer failed`: no return, ordinary non-security error, or malformed report.

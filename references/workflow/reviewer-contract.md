# Delegated Review Contract

This is the host-neutral contract for a delegated **reviewer** — the kit's second delegate kind, between the read-only probe of `./agent-fanout.md` and the write-mode executor of `./executor-contract.md`. A reviewer takes one named review object, reviews it, runs verification over it, and returns evidence to the session that launched it; this file owns that posture, its packet, its return, and the settle. The review itself — lenses, severity calibration, findings shape — stays in `../engineering/review.md`; base resolution, the verdicts, the drafted PR description, and the rendered output stay with the host skill. Host adapters select native model, effort, and tool defaults, then load their installed copy of this contract.

Two audiences read this file. § *Posture*, § *Launch packet*, and § *The return* address the **reviewer**, which loads the file in its own sidechain. § *The launch*, § *The settle*, § *Consumers*, § *Adapter defaults*, and § *Degrade rule* address the **session** that launched it, which reads them cold at the launch, the settle, and the fallback rather than restating them in the host skill — a reviewer that cannot launch never reads this file, so what the session owes on that path has to reach the session.

## Posture

- **Read-only toward the review object and everything the project tracks.** The reviewer writes no file, stages nothing, and mutates no Git state.
- **Execute-only toward verification.** It runs the project's verification scripts over the reviewed set, and the scratch reproduction of a candidate's failure mode — both under `../engineering/review.md` § *Verification Scripts*, which owns the bar for each and is not restated here. Scratch invocations and the caches a tool manages for itself are not writes under this contract.
- **Bound by the instruction hierarchy at the effective root.** Read and follow what applies there — `AGENTS.md` / `CLAUDE.md`, `CORE_RULES.md`, the engineering rules overlay (`rules.md`) — before reviewing, as `./executor-contract.md` § *Execution boundaries* binds an executor to the same root. The two halves arrive differently: `AGENTS.md` / `CLAUDE.md` the reviewer discovers at the root itself, while `CORE_RULES.md` and the overlay sit in the install home rather than at the root of a consumer repository and reach the reviewer as absolute paths in the packet. Either way, an invariant they state is a lens on the reviewed set, not context to skip.
- **A live parent sandbox, approval setting, or managed security policy takes precedence** over this contract and any adapter default. A denied verification run is reported to the session as a blocker; never broaden access to get it to run.
- **No fan-out of its own.** A reviewer launches no agents — a native subagent cannot reliably spawn further subagents. The `-x` cross-check and the `-p` lens fleet stay session-launched and merge in the settle.

## Launch packet

Treat the session's launch prompt as the source of truth — the reviewer sees no session context and fetches none. It supplies:

- **the review object, named concretely, with its identity** — never pasted diff text: the diff `<base>...HEAD`, with the reviewed head SHA and the merge-base SHA. The reviewer assembles the object itself;
- **one absolute effective working root** — the tree the object lives on, which may be a worktree rather than the main checkout. Every command runs there; never infer a location from the adapter or the shell's directory;
- **the kind** — `pr`, the one value today;
- **the PR context** — title, description, review comments and discussion threads, and every URL extracted from them. Links travel as URLs, not as fetched content: the reviewer fetches them itself and records what it could not reach;
- **the absolute installed paths of the review pack and of the installed rules § *Posture* binds the review to** — `../engineering/review.md` and the per-surface checklists beside it, plus the install home's `CORE_RULES.md` and the engineering overlay `../engineering/rules.md`, as the host installed them. The reviewer reads them itself, loading the checklists the diff's domains trigger;
- **the user's own context and constraints as given with the invocation** — the why behind the change, a focus to take, a constraint to honour — verbatim, or an explicit `none`. The session holds them and the reviewer sees no session context, so unsent context is silently dropped from the pass; where a constraint conflicts with this contract, § *Posture* governs;
- **the host skill's § *Review Focus*, verbatim** — the emphasis the skill owns (what to read first, what to prioritize), which the review pack does not carry. The session composes it into the packet at launch from the skill it already holds, so nothing is copied on disk and nothing needs mirroring.

The change map, the blast-radius search over every modified export, and the link reading are the reviewer's own work, not the session's — moving them off the main thread is what the delegation buys.

Before reviewing, confirm the object, its identity, and the effective root are present and unambiguous. If any is missing or ambiguous, or the prompt is not a review packet from a consumer registered below, report that and review nothing.

## The return

Return evidence, not a verdict — and never an audience-facing artifact: the PR description is the session's to draft, from the `Change map` below, under rules the reviewer never sees. Include every heading, using an explicit `None` where one is empty — except the headings § *The settle*'s intake check 2 names as never empty, where a `None` fails that check:

- `Summary` — what changed, its intent, and the reviewer's overall assessment (approve / request changes / needs discussion). Evidence like the rest — the session restates the assessment after settling, but only the reviewer read the diff, so the summary's substance comes from here.
- `Findings` — in the shape `../engineering/review.md` § *Findings output shape* defines, each entry additionally carrying its cited `file:line` evidence and a one-line excerpt of what stands at that line. The excerpt is what lets the session settle from the return instead of re-deriving the review.
- `Improvements` — non-blocking suggestions. Not findings — they carry no required `file:line`, and the settle passes them through rather than dropping them as uncited.
- `Identity` — the object's identity echoed back as the reviewer resolved it at the effective root: the head and merge-base SHAs.
- `Verification scripts` — each script launched and its outcome, its failures and warnings already merged into `Findings`; a script the project does not expose is named as skipped.
- `Divergence` — every reviewed path where the effective root's on-disk content diverges from the review object, under the bar `../engineering/review.md` § *Verification Scripts* sets: a script failure or reproduction at such a path is reported here as context, never merged into `Findings`. `None` when the tree carries the object.
- `Inaccessible context` — every link the reviewer could not fetch, each with its URL and the reason (auth-walled, private workspace, 404, tool unavailable). Never fabricate what sits behind one.
- `Change map` — the reviewed set grouped by file and intent, compact enough to read at a glance and complete enough for the session to draft from and to derive its lens set from. Returned on every pass.

## The launch

Session-facing. How the session starts a pass, and the one home for it: the host skills cite this section rather than restating it. Spawn the native `reviewer` subagent — the kit-installed adapter § *Adapter defaults* describes; a host with no adapter, or one that cannot launch it, takes the host skill's inline fallback under § *Degrade rule*. The launch prompt is a review packet per § *Launch packet*, whose items the host skill composes from what its own Setup resolved; the reviewer loads this file's reviewer-facing sections in its own sidechain, while the session hands the packet over and then settles the return by the session-facing ones, read cold at that point.

## The settle

Session-facing. What the session does with the return. `./agent-fanout.md`'s rule that the invoking skill owns its verdicts holds for a reviewer exactly as it does for a probe. Two **intake checks** come first, in this order, before any settle step below and before any post-return launch — the `-p` lens fleet included, since a fleet derived from a return the session has not yet validated launches against the wrong object or an incomplete map:

1. **Identity.** The `Identity` echo matches the identity the host skill's Setup recorded — the head and merge-base SHAs. A mismatch means the reviewer resolved a different object: stop and report; settle nothing, launch nothing.
2. **Completeness.** Every § *The return* heading is present — an explicit `None` counts, an absent heading does not. A return missing one is malformed: a matching `Identity` echo with findings but no `Verification scripts` would render `delegated (<model>)` with the always-run guarantee silently unmet. Four headings may never be `None`, and a `None` under one of them is malformed exactly as an absent heading is: `Identity`, `Verification scripts`, `Change map`, and `Summary` — the script heading lists each exposed script with its outcome, and a project exposing none says so as a listing (`none exposed`), never as `None`, or the check meant to catch that unmet guarantee passes on it, and a `None` map leaves the session with nothing to draft from and the lens fleet with no set to derive. Take § *Degrade rule*'s path with reason `reviewer failed`.

Then:

- **Adopt each finding whose evidence is cited.** An entry carrying a `file:line` and its excerpt is adopted as it stands; an uncited entry is an opinion, and the session re-derives it or drops it. `Improvements` are exempt — not findings, they pass through as returned.
- **Spot-check the Critical and Major anchors only** — re-read each cited line before rendering the finding, against the review object rather than the disk at any path the return lists under `Divergence` (`git show <head-sha>:<path>`): the on-disk line there is the content the object never carried. Minor findings settle on their citation; re-deriving a tier in full costs back what the delegation saved.
- **Assign the final verdicts**, marking any severity changed from the one the reviewer returned.
- **Merge the `-x` probe here**, before findings are finalized, per `./probe-cross-check.md`.
- **Under a composite, the steps after the intake checks are suppressed.** The composite's phase 3 gives every finding exactly one verdict, so a standalone settle would settle it twice — the same reason it suppresses the cold settling of `-p` candidates. The intake checks still run: a composite that forwards a malformed return verifies against a pass that never ran in full.

## Consumers

Session-facing. The skills authorized to launch or consume a delegated reviewer — the membership § *Launch packet*'s gate checks a packet against: `review-pr` launches one, and `review-pr-triage-verify` consumes this contract through its phase 1's execution of that skill. Authorization is contract content, the same class as `./executor-contract.md` § *Bindings* — not a record of who cites this file, which reverse search reconstructs.

## Adapter defaults

Session-facing. The adapters are `~/.claude/agents/reviewer.md` and `~/.codex/agents/reviewer.toml`; each carries its own model and effort pins, and the `<model>` on the `Review pass:` line is read from the installed definition — its `model:` line on Claude, `model =` on Codex — never from this file. The Claude adapter withholds the write tools and keeps `Bash`, which verification needs, so the read-only posture is enforced for the named tools and promised for the rest — the trust `./probe-engines.md` records for every native subagent. The Codex adapter sets `sandbox_mode = "workspace-write"`, since the verification scripts and scratch reproductions § *Posture* mandates write outside the tracked tree and a `read-only` sandbox would deny them; there the posture toward the tracked tree is prompt-borne, the same trust. On either host the live parent sandbox, approval setting, or managed security policy stays authoritative. A pin that does not resolve, or sits at or below the session's own model, is the user's to retune in the installed definition, removing its sibling `.agents-kit-reviewer` marker so the install keeps the retune — the recovery `./executor-routing.md` § *Write-mode engine registry* gives the executor, with why the pins are full model names; a session that hits it mid-review reports it and takes the inline fallback, never editing the install. What makes the file at that path the kit adapter is its body citing the installed `reviewer-contract.md`, not the marker: a same-name definition without that citation is the user's own agent and is never launched under a packet — § *Degrade rule* reads it as `adapter not installed`.

## Degrade rule

Session-facing. Where the reviewer cannot launch, or launched and did not produce a usable pass, announce it and run the host skill's own inline review pass, which stays the fallback protocol. Degrading changes the runner, never the review object, the effective root, or what the output owes. The output records which happened on its mandatory `Review pass:` line — `Review pass: delegated (<model>)` when a reviewer produced the pass, `Review pass: inline (<reason>)` when the session did — and the reason is one of a closed set, each with the test that selects it:

- `no subagent support` — the host cannot launch a subagent at all.
- `adapter not installed` — no kit adapter at the installed path for this host: no definition, or one that does not cite this contract (§ *Adapter defaults*).
- `adapter not registered` — the kit definition is on disk but the launch fails on an unknown agent type: the harness's registry predates the write, as it does for a session that outlives the install. A kit definition's presence falsifies the previous reason, which is what keeps this one distinct.
- `unresolved model pin` — the adapter launched but its pinned model does not resolve on this host, or resolves at or below the session's own model; § *Adapter defaults* has the recovery for either.
- `reviewer failed` — a launched reviewer did not return, returned an error, or returned a malformed report (§ *The settle*, intake check 2).

An unrecorded degrade reads exactly like a delegated pass, which is why the line is owed on either path.

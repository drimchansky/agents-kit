# Delegated Review Contract

This is the host-neutral contract for a delegated **reviewer** — the kit's second delegate kind, between the read-only probe of `./agent-fanout.md` and the write-mode executor of `./executor-contract.md`. A reviewer takes one named review object, reviews it, runs verification over it, and returns evidence to the session that launched it; this file owns that posture, its packet, its return, and the settle. The review itself — lenses, severity calibration, findings shape — stays in `../engineering/review.md`; base resolution, the verdicts, the drafted PR description, and the rendered output stay with the host skill. Host adapters select native model, effort, and tool defaults, then load their installed copy of this contract.

Two audiences read this file. § *Posture*, § *Launch packet*, and § *The return* address the **reviewer**, which loads the file in its own sidechain. § *The launch*, § *The settle*, § *Consumers*, § *Adapter defaults*, and § *Degrade rule* address the **session** that launched it, which reads them cold at the launch, the settle, and the fallback rather than restating them in the host skill — a reviewer that cannot launch never reads this file, so what the session owes on that path has to reach the session.

## Posture

- **Read-only toward the review object and everything the project tracks.** The reviewer writes no file, stages nothing, and mutates no Git state.
- **Execute-only toward verification.** It runs the project's verification scripts over the reviewed set, and the scratch reproduction of a candidate's failure mode — both under `../engineering/review.md` § *Verification Scripts*, which owns the bar for each and is not restated here. Scratch invocations and the caches a tool manages for itself are not writes under this contract.
- **Bound by the instruction hierarchy at the effective root.** Read and follow what applies there — `AGENTS.md` / `CLAUDE.md`, `CORE_RULES.md`, the engineering rules overlay (`rules.md`) — before reviewing, as `./executor-contract.md` § *Execution boundaries* binds an executor to the same root. The two halves arrive differently: `AGENTS.md` / `CLAUDE.md` the reviewer discovers at the root itself, while `CORE_RULES.md` and the overlay sit in the install home rather than at the root of a consumer repository and reach the reviewer as absolute paths in the packet. Either way, an invariant they state is a lens on the reviewed set, not context to skip.
- **A live parent sandbox, approval setting, or managed security policy takes precedence** over this contract and any adapter default. A denied verification run is reported to the session as a blocker; never broaden access to get it to run.
- **No fan-out of its own.** A reviewer launches no agents — a native subagent cannot reliably spawn further subagents. The `-x` cross-check stays session-launched and merges in the settle.

## Launch packet

Treat the session's launch prompt as the source of truth — the reviewer sees no session context and fetches none. It supplies:

- **the review object, named concretely, with its identity** — never pasted diff or file text: the diff, `<base>...HEAD` on a branch against its base and `<merge-base>...<b>` on a commit range, with the reviewed head SHA and the merge-base SHA; or a path set, named as its own paths with the head SHA and the digest of the sorted path list, which the reviewer recomputes with this exact command:

    ```bash
    git ls-files --full-name --error-unmatch -- <paths> | LC_ALL=C sort | git hash-object --stdin
    ```

    The `LC_ALL=C` and the `--full-name` are both load-bearing, and the command travels here in full for that reason: the session and the reviewer both compute this digest, § *The settle*'s intake check 1 makes any mismatch a hard stop, and either pin missing lets the identical object digest two ways and the check kill a legitimate pass. An unpinned `sort` collates by each process's own locale; `git ls-files` without `--full-name` prints paths relative to the current working directory, so a session invoked from a subdirectory disagrees with a reviewer that runs at the root as this contract's next item requires. A reviewer that has to guess the recipe is the failure this literal prevents; the packet carries no path to the host skill, so nothing else here can supply it. The reviewer assembles the object itself;
- **one absolute effective working root** — the tree the object lives on, which may be a worktree rather than the main checkout. Every command runs there; never infer a location from the adapter or the shell's directory;
- **the kind** — `pr` for a diff, a branch's against its base or a commit range alike, and `paths` for a set of tracked files at one commit;
- **the PR context** — title, description, review comments and discussion threads, and every URL extracted from them. Links travel as URLs, not as fetched content: the reviewer fetches them itself and records what it could not reach;
- **the absolute installed paths of the review pack and of the installed rules § *Posture* binds the review to** — `../engineering/review.md` and the per-surface checklists beside it, plus the install home's `CORE_RULES.md` and the engineering overlay `../engineering/rules.md`, as the host installed them. The reviewer reads them itself, loading the checklists the reviewed set's domains trigger;
- **the user's own context and constraints as given with the invocation** — the why behind the change, a focus to take, a constraint to honour — verbatim, or an explicit `none`. The session holds them and the reviewer sees no session context, so unsent context is silently dropped from the pass; where a constraint conflicts with this contract, § *Posture* governs;
- **the host skill's § *Review Focus*, verbatim** — the emphasis the skill owns (what to read first, what to prioritize), which the review pack does not carry. The session composes it into the packet at launch from the skill it already holds, so nothing is copied on disk and nothing needs mirroring;
- **the verification-scripts instruction** — that the reviewer runs the project's verification scripts over the reviewed set, and reproduces a candidate's failure mode in scratch before adopting it, as § *Posture* binds it on either kind: the reviewed set is the diff on a `pr` object and the files themselves on a `paths` one. Where the session puts several reviewers on one object, only the first carries that instruction and each of the others carries `verification scripts: skip — reviewer 1 runs them`: the scripts exercise the one tree, so repeating them per reviewer buys no evidence and costs contention on it. A reviewer carrying the skip says so under its return's `Verification scripts` heading rather than leaving that heading empty.

The change map, the blast-radius search over every modified export, and the link reading are the reviewer's own work, not the session's — moving them off the main thread is what the delegation buys.

Before reviewing, confirm the object, its identity, and the effective root are present and unambiguous. If any is missing or ambiguous, or the prompt is not a review packet from a consumer registered below, report that and review nothing.

## The return

Return evidence, not a verdict — and never an audience-facing artifact: the PR description is the session's to draft, from the `Change map` below, under rules the reviewer never sees. Include every heading, using an explicit `None` where one is empty — except the headings § *The settle*'s intake check 2 names as never empty, where a `None` fails that check:

- `Summary` — what changed, its intent, and the reviewer's overall assessment (approve / request changes / needs discussion), or on a `paths` object what the set does and a health verdict from the closed set `../engineering/review.md` § *Reviewing a path set* fixes. Evidence like the rest — the session restates the assessment after settling, but only the reviewer read the object, so the summary's substance comes from here.
- `Findings` — in the shape `../engineering/review.md` § *Findings output shape* defines, each entry additionally carrying its cited `file:line` evidence and a one-line excerpt of what stands at that line. The excerpt is what lets the session settle from the return instead of re-deriving the review.
- `Improvements` — non-blocking suggestions. Not findings — they carry no required `file:line`, and the settle passes them through rather than dropping them as uncited.
- `Identity` — the object's identity echoed back as the reviewer resolved it at the effective root: the head and merge-base SHAs, or on a `paths` object the head SHA and the path-list digest.
- `Verification scripts` — each script launched and its outcome, its failures and warnings already merged into `Findings`; a script the project does not expose is named as skipped. A packet carrying the skip in § *Launch packet* is answered here with the listing `skipped (reviewer 1 runs them)` — a listing like any other, and not `None`.
- `Divergence` — every reviewed path where the effective root's on-disk content diverges from the review object, under the bar `../engineering/review.md` § *Verification Scripts* sets: a script failure or reproduction at such a path is reported here as context, never merged into `Findings`. `None` when the tree carries the object.
- `Inaccessible context` — every link the reviewer could not fetch, each with its URL and the reason (auth-walled, private workspace, 404, tool unavailable). Never fabricate what sits behind one.
- `Change map` — the reviewed set grouped by file and by intent, or by file and concern on a `paths` object, which carries no intent to read. Compact enough to take in at a glance and complete enough for the session to draft from, and returned on every pass.

## The launch

Session-facing. How the session starts a pass, and the one home for it: the host skills cite this section rather than restating it. Spawn the native `reviewer` subagent — the kit-installed adapter § *Adapter defaults* describes; a host with no adapter, or one that cannot launch it, takes the host skill's inline fallback under § *Degrade rule*. The launch prompt is a review packet per § *Launch packet*, whose items the host skill composes from what its own Setup resolved; the reviewer loads this file's reviewer-facing sections in its own sidechain, while the session hands the packet over and then settles the return by the session-facing ones, read cold at that point.

## The settle

Session-facing. What the session does with the return. `./agent-fanout.md`'s rule that the invoking skill owns its verdicts holds for a reviewer exactly as it does for a probe. Two **intake checks** come first, in this order, before any settle step below and before any post-return launch:

1. **Identity.** The `Identity` echo matches the identity the host skill's Setup recorded — the head and merge-base SHAs, or on a `paths` object the head SHA and the path-list digest. A mismatch means the reviewer resolved a different object: stop and report; settle nothing, launch nothing.
2. **Completeness.** Every § *The return* heading is present — an explicit `None` counts, an absent heading does not. A return missing one is malformed: a matching `Identity` echo with findings but no `Verification scripts` would render `delegated (<model>)` with the always-run guarantee silently unmet. Four headings may never be `None`, and a `None` under one of them is malformed exactly as an absent heading is: `Identity`, `Verification scripts`, `Change map`, and `Summary` — the script heading lists each exposed script with its outcome, and a project exposing none says so as a listing (`none exposed`), as does a reviewer whose packet carried § *Launch packet*'s skip, never as `None`, or the check meant to catch that unmet guarantee passes on it, and a `None` map leaves the session with nothing to draft from. Take § *Degrade rule*'s path with reason `reviewer failed`.

**Where the session put several reviewers on one object**, both checks run per return, and a return failing either is dropped rather than ending the pass: the session records on its own output which return went and why, runs the steps below on the returns still standing — pooled by location first, per `./agent-fanout.md` § *Merge contract* — and takes a failed check's path above only once nothing stands. The object was identical, so a lost return costs that reviewer's reading and no more; losing the first one costs the verification scripts with it, every other packet having carried the skip, and the session runs them itself before its output.

Then:

- **Adopt each finding whose evidence is cited.** An entry carrying a `file:line` and its excerpt is adopted as it stands; an uncited entry is an opinion, and the session re-derives it or drops it. `Improvements` are exempt — not findings, they pass through as returned.
- **Spot-check the Critical and Major anchors only** — re-read each cited line before rendering the finding, against the review object rather than the disk at any path the return lists under `Divergence` (`git show <head-sha>:<path>`): the on-disk line there is the content the object never carried. Minor findings settle on their citation; re-deriving a tier in full costs back what the delegation saved.
- **Assign the final verdicts**, marking any severity changed from the one the reviewer returned.
- **Merge the `-x` probe here**, before findings are finalized, per `./probe-cross-check.md`.
- **Under a composite, the steps after the intake checks are suppressed.** The composite's phase 3 gives every finding exactly one verdict, so a standalone settle would settle it twice. The intake checks still run: a composite that forwards a malformed return verifies against a pass that never ran in full.

## Consumers

Session-facing. The skills authorized to launch or consume a delegated reviewer — the membership § *Launch packet*'s gate checks a packet against: `review-code` launches one, and `review-code-triage-verify` consumes this contract through its phase 1's execution of that skill. Authorization is contract content, the same class as `./executor-contract.md` § *Bindings* — not a record of who cites this file, which reverse search reconstructs.

## Adapter defaults

Session-facing. The adapters are `~/.claude/agents/reviewer.md` and `~/.codex/agents/reviewer.toml`; each carries its own model and effort pins, and both are read from the installed definition rather than from this file: the `<model>` on the `Review pass:` line from its `model:` line on Claude and its `model =` on Codex, and the `<effort>` a host skill names where it announces a fleet launch — the one place any skill prints it — from its `effort:` line on Claude and its `model_reasoning_effort =` on Codex. The Claude adapter withholds the write tools and keeps `Bash`, which verification needs, so the read-only posture is enforced for the named tools and promised for the rest — the trust `./probe-engines.md` records for every native subagent. The Codex adapter sets `sandbox_mode = "workspace-write"`, since the verification scripts and scratch reproductions § *Posture* mandates write outside the tracked tree and a `read-only` sandbox would deny them; there the posture toward the tracked tree is prompt-borne, the same trust. On either host the live parent sandbox, approval setting, or managed security policy stays authoritative. A pin that does not resolve, or sits at or below the session's own model, is the user's to retune in the installed definition, removing its sibling `.agents-kit-reviewer` marker so the install keeps the retune — the recovery `./executor-routing.md` § *Write-mode engine registry* gives the executor, with why the pins are full model names; a session that hits it mid-review reports it and takes the inline fallback, never editing the install. What makes the file at that path the kit adapter is its body citing the installed `reviewer-contract.md`, not the marker: a same-name definition without that citation is the user's own agent and is never launched under a packet — § *Degrade rule* reads it as `adapter not installed`.

## Degrade rule

Session-facing. Where the reviewer cannot launch, or launched and did not produce a usable pass, announce it and run the host skill's own inline review pass, which stays the fallback protocol. Degrading changes the runner, never the review object, the effective root, or what the output owes. The output records which happened on its mandatory `Review pass:` line — `Review pass: delegated (<model>)` when a reviewer produced the pass, `Review pass: inline (<reason>)` when the session did — and the reason is one of a closed set, each with the test that selects it:

- `no subagent support` — the host cannot launch a subagent at all.
- `adapter not installed` — no kit adapter at the installed path for this host: no definition, or one that does not cite this contract (§ *Adapter defaults*).
- `adapter not registered` — the kit definition is on disk but the launch fails on an unknown agent type: the harness's registry predates the write, as it does for a session that outlives the install. A kit definition's presence falsifies the previous reason, which is what keeps this one distinct.
- `unresolved model pin` — the adapter launched but its pinned model does not resolve on this host, or resolves at or below the session's own model; § *Adapter defaults* has the recovery for either.
- `reviewer failed` — a launched reviewer did not return, returned an error, or returned a malformed report (§ *The settle*, intake check 2).

An unrecorded degrade reads exactly like a delegated pass, which is why the line is owed on either path.

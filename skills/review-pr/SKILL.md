---
name: review-pr
description: Use when asked to review or give feedback on a PR or branch diff against its base.
argument-hint: '[-x (cross-vendor second review)] [-p (parallel lens probes + gap sweep)] [-d (draft PR description)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Review all changes in the current branch against its base branch for correctness, unintended impact, and adherence to project patterns.

## Flags

- `-x` — Cross-check: launch one independent cold review of the same diff on the cross-vendor engine and merge it before findings are finalized, per `./references/workflow/probe-cross-check.md` on the cold-review shape in `./references/workflow/probe-shape-cold-review.md`, under the shared contract in `./references/workflow/agent-fanout.md`, with the engine and its launch recipe in `./references/workflow/probe-engines-cross-vendor.md`. Off by default. The probe is read-only; its outcome is recorded on the output's `Cross-check:` line. <!-- cold -->
- `-p` — Lens probes: launch one native cold review per lens in parallel — each per-surface checklist the diff triggers, plus one per correctness angle derived from the change map — then one gap sweep over what the fleet returned, and merge them all before findings are finalized, per the lens-review shape in `./references/workflow/probe-shape-lens-review.md`. Off by default. The fleet launches after the reviewer returns and its intake checks pass — never before the `Identity` echo has checked out — its lens set derived from the compact change map the return carries — from the change map the session built on the inline fallback. The probes are read-only; their outcomes are recorded on the output's `Lens probes:` line. A composite driving this skill may suppress the cold settling of these candidates — where it does, its own text governs, and the mentions below are subject to it. <!-- cold -->
- `-d` — Draft a ready-to-paste PR description (body only) in addition to the review, per the "PR description" section. The session drafts it on either pass; the reviewer returns none and is never told the flag is set. Off by default.

## References

Before working, read `./references/engineering/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review. The session keeps it hot for the settle's severity calibration; on a delegated pass the reviewer reads its own installed copy, and the per-surface checklists beside it, in its sidechain.

## Setup

**Determine base branch** (unless the user specified one): if the current branch has an open GitHub PR, adopt its declared base — `gh pr view --json state,baseRefName` (requires `gh`; targets the current branch's PR), taking `baseRefName` only when `state` is `OPEN`. `gh pr view` returns the branch's PR whatever its state, so a merged or closed PR with no open successor would otherwise hand back a stale base — check `state` and treat anything but `OPEN` as no PR (the same guard `/publish-pr-review` applies). That declared base is the exact one `/publish-pr-review` re-checks against (it recomputes `git merge-base <baseRefName> HEAD`), so adopting it keeps the review and the publish step from resolving different bases and looping. Only with no open PR — `gh` missing, no GitHub remote, or no PR in `OPEN` state — fall back to local heuristics: check common ancestors with `main`, `master`, `develop`, or `release/*`, and verify the commit count is reasonable.

**Resolve the review object's identity:** record both the reviewed head commit (`git rev-parse HEAD`) and its merge-base with the base (`git merge-base <base> HEAD`). This stays in-session on every pass — it is the identity the review packet carries and the reviewer echoes back, and the anchor the `publish-pr-review` follow-up depends on: it anchors its posted review to the head and re-checks the merge-base so it never publishes against a retargeted or moved diff.

**Launch the cross-vendor probe** (only with `-x`): as soon as the base branch is determined, start one background probe per `./references/workflow/probe-cross-check.md` on the cold-review shape in `./references/workflow/probe-shape-cold-review.md`, on the engine and launch recipe in `./references/workflow/probe-engines-cross-vendor.md` — a cold second review of the `<base>...HEAD` diff at the repo root, demanding findings with severity and `file:line` evidence. Continue the setup while it runs; the probe is read-only, so it may overlap the delegated review pass. Collect and merge it in the Settle, per the contract, before finalizing Findings. <!-- cold -->

**Gather context:**

- Read commit messages for the branch
- Check for an open PR on GitHub for this branch with `gh pr view --json number,title,body,state,url,comments,reviews,baseRefName` (requires `gh` CLI). If the command fails because `gh` is missing or the repo has no GitHub remote, note that and skip the PR lookup. `baseRefName` is the PR's declared base — the one already adopted in **Determine base branch**; carrying it in the context confirms the review ran against the PR's own base.
- If a PR exists:
    - Read the PR title, description, and any review comments / discussion threads — these often contain the _why_ behind the change and prior reviewer concerns
    - Extract every URL from the PR body and comments (issue trackers, design docs, Slack threads, RFCs, related PRs, dashboards). Extraction is where the session's link work ends: the URLs travel to the reviewer, which fetches them — the session fetches them itself only on the inline fallback
- If no PR exists, proceed with just the branch commits and any context the user provided

## Review pass

**Launch.** Launch and hand over per `./references/workflow/reviewer-contract.md` § *The launch*, with a packet of the `pr` kind, the **Inline fallback** below standing where that section names one. The session puts in the packet:

- the review object named concretely — the `<base>...HEAD` diff, never pasted diff text — with the head and merge-base SHAs Setup resolved
- the absolute effective working root: the tree that diff lives on, which is the worktree when the run is in one rather than the main checkout
- the kind, `pr`
- the PR context Setup gathered — title, body, review comments and discussion threads — and every URL extracted from them, as URLs for the reviewer to fetch
- the absolute installed paths of the install home's `references/engineering/review.md` (`~/.claude/` on Claude, `~/.codex/` on Codex), the per-surface checklist directory beside it, the engineering overlay `references/engineering/rules.md` in that same directory, and the install home's `CORE_RULES.md`
- any context and constraints the user gave with the invocation — the why behind the change, a focus to take, a constraint to honour — verbatim, or `none`: the session holds them and the reviewer sees no session context, and with no PR they are the whole of the intent Setup gathered
- this skill's § *Review Focus*, verbatim — the review pack does not carry it
- the instruction that the reviewer builds the change map and the blast-radius search itself, and runs the project's verification scripts over the reviewed set

A packet with a missing or ambiguous item is completed by reading or asking, never launched short.

**Wait.** While the reviewer is in flight the session runs no command against the tree — no reads of the diff, no verification scripts, no scratch runs; the reviewer is executing on that same tree. Wait on the harness's completion signal per `./references/workflow/delegated-waiting.md` § *How to wait*, reporting where the launch stands at each check-in. The `-x` probe is read-only and may overlap the wait.

**Settle.** The return is evidence, not a verdict — this skill assigns the verdicts, per `./references/workflow/reviewer-contract.md` § *The settle*, read cold at this point. Its two intake checks run first, in order, before any settle step and before the `-p` fleet launches: the `Identity` echo against the head and merge-base SHAs Setup resolved — a mismatch means the reviewer resolved a different object: stop and report, settle nothing, launch nothing — then every return heading present, a malformed return taking the inline fallback below with reason `reviewer failed`. Then adopt, spot-check, and assign the final verdicts as that section orders — `Summary` and `Improvements` pass through uncited, as evidence for Output — and merge the `-x` probe.

With `-p`, launch the lens probes once both intake checks have passed: one probe per lens per the lens-review shape in `./references/workflow/probe-shape-lens-review.md` — the lens set derives from the compact change map the return carries (from the change map the session built on the inline fallback): the per-surface checklists its domains trigger, plus the correctness angles the change presents — and, once the fleet has landed, the single gap sweep that shape defines. Merge each probe's findings into this same settle per the merge contract in `./references/workflow/agent-fanout.md` — which routes a fleet's candidates to a cold settling pass rather than this session's own read, subject to the suppression the `-p` bullet notes. <!-- cold -->

A composite driving this skill stops this settle after the intake checks, per `./references/workflow/verify-pipeline.md` § *The review phase*. <!-- cold --> The `-d` draft is not one of those steps: it is Output's, drafted from the return's `Change map` whatever settles the findings, so a composite forwards it unchanged. Findings adopted here render in the shape `./references/engineering/review.md` § *Findings output shape* defines, which Output already cites.

**Inline fallback.** Where the reviewer cannot launch or a launched one failed — the reasons `./references/workflow/reviewer-contract.md` § *Degrade rule* closes — announce which it was and run the pass in-session, recording the reason on the output's `Review pass:` line. Only the runner changes: nothing about the review object, the base, or what the output owes moves with it.

Build the change map:

- Get the full diff against the base branch (its identity is already recorded in Setup)
- Exclude generated files (lockfiles, build artifacts, snapshots) unless manually edited
- Group changes by intent: new feature, bug fix, refactor, configuration, tests
- For each modified export or shared component — search all usages to understand blast radius
- If the diff exceeds ~1000 non-generated lines and isn't a single logically cohesive change, the first finding is "split this PR" — large diffs hide bugs and exceed reviewer working memory
- If the diff bundles refactoring with feature work or bug fixes, flag "separate the refactor" — mixed-purpose PRs are harder to review, harder to revert, and dilute commit history. Exception: refactors required _to enable_ the feature, which should be called out in the PR description.

Read the links Setup extracted:

- Fetch every extracted link concurrently — parallel fetch calls in one batch (WebFetch for public URLs, `gh issue view` / `gh pr view` for GitHub references), or one native probe batching the retrieval per `./references/workflow/agent-fanout.md` — read it when taking the probe route — and merge what comes back into the review context <!-- cold -->
- If a link can't be accessed (auth-walled, private workspace, 404, tool unavailable), record it in the output under **Inaccessible context** with the URL and reason. Do not fabricate what's behind it — flag the gap so the user can decide whether to paste the content in or proceed without it

Launch verification scripts per "Verification Scripts" in `./references/engineering/review.md` — always: as soon as the diff against the base is determined, launch the project's lint/typecheck/test scripts over the changed files and review while they run; their failures and warnings land as findings before output. `./references/workflow/agent-fanout.md` fixes the route a candidate raised there settles by, that section's reproduction bar and all. <!-- cold -->

Then apply **Review Focus** below and render the output.

## Review Focus

The reviewer applies this focus on a delegated pass; the session applies it on the inline fallback.

**Examine tests first.** Test diffs reveal intent and expected behavior. Read them before the implementation so you evaluate the code against what it's supposed to do, not what it appears to do.

Apply the full review process from `./references/engineering/review.md` — its "What to Look For", "What NOT to Flag", "Calibrate Severity", "Approval Bar", "Prioritize Review Effort", and "Don't Rationalize" sections all apply to PR diffs.

## Output

- **Summary** — What changed, intent, overall assessment (approve / request changes / needs discussion); on a delegated pass restated from the return's `Summary`, its assessment re-read against the settled verdicts
- **Findings** — in the shape `./references/engineering/review.md` § *Findings output shape* defines: one entry per issue with its severity, `file:line`, recommendation, and impact, Minors in that same shape and the list never capped. That shape is not the publish step's selection rule: `/publish-pr-review` offers the Critical/Major findings, the Minor ones, and **Improvements** as severity tiers and posts whichever you select.
- **Reviewed** — a provenance line recording the reviewed head commit and its merge-base (the `git rev-parse HEAD` and `git merge-base` from Setup) and the model that produced this review, e.g. `Reviewed at <head-sha> (merge-base <base-sha>) by <model>`. That `<model>` is the reviewer adapter's pinned model on a delegated pass and this session's own on the inline fallback — the same one the `Review pass:` line names. `/publish-pr-review` reads it to anchor the posted review to the head commit, re-check the diff hasn't moved, and attribute it — so attribution survives the model changing between review and publish.
- **Review pass** — mandatory, per `./references/workflow/reviewer-contract.md` § *Degrade rule*: `Review pass: delegated (<model>)` when the reviewer produced the pass, `Review pass: inline (<reason>)` when the session did, the reason one of that section's closed set and `<model>` read as its § *Adapter defaults* says.
- **Divergence** — the diverging reviewed paths the runner recorded per "Verification Scripts" in `./references/engineering/review.md` — the return's `Divergence` heading on a delegated pass, the session's own record on the inline fallback — each with the context reported at it; `None` when the tree carries the object
- **Cross-check** (only with `-x`) — the probe's `Cross-check:` outcome line per `./references/workflow/agent-fanout.md` <!-- cold -->
- **Lens probes** (only with `-p`) — the `Lens probes:` outcome line per the lens-review shape in `./references/workflow/probe-shape-lens-review.md`, naming each lens and the gap sweep, each with its outcome, and any candidate its settling left unsettled <!-- cold -->
- **Improvements** (optional) — Non-blocking suggestions; on a delegated pass the return's `Improvements`, passed through
- **Inaccessible context** (only if any) — Links from the PR that couldn't be fetched, with URL and reason (auth required, private, 404, tool unavailable). Note which findings might shift if that context were available.
- **PR description** (only with `-d`) — A ready-to-paste description (body only); drafted per the **PR description** section below.

**Next:** to post this review to the PR, run `/publish-pr-review` — it offers this review's Critical/Major findings, its Minor ones, and its **Improvements** as severity tiers and posts the one you select as inline comments, or a short approval if all three are empty.

## PR description

Only when `-d` is passed. **The session drafts it on either pass** — the reviewer returns no description and is never told the flag is set, because the rules below are this skill's and it never sees them. A ready-to-paste PR description — **body only, no title** — drafted from the return's `Change map` and `Summary` and the links Setup extracted on a delegated pass, and from the session's own change map and fetched links on the inline fallback. Where the map leaves an intent unclear, read the diff for it: the tree is the session's again once the reviewer has returned. Print it in a fenced block so the user can copy it verbatim.

Format:

```
Task: <primary ticket/issue link>
<other relevant links — one per line, each prefixed with its kind: Docs:, Design:, Related PR:, Dashboard:, …>

<description body>
```

- **Task line** — the primary ticket/issue link. Source in order: (1) a link the user gave when invoking; (2) an issue-tracker URL among the links extracted from the existing PR in Setup (the primary one if several); (3) a ticket key in the branch name or commit trailers. Never fabricate a URL — if none is found, emit `Task: <add ticket link>` as a fill-in placeholder.
- **Other links** — the remaining relevant URLs already gathered (design docs, RFCs, related PRs, dashboards, Slack threads). One per line, most important first, each prefixed with a short label naming its kind (`Docs:`, `Design:`, `Related PR:`, `Dashboard:`, …) — the label set is illustrative, not fixed. Omit entirely when there are none.
- **Body** — short and readable (a short paragraph, or a few bullets if the PR has several distinct changes); state _what_ changed and _why_ (the intent), not _how_. Cover the substantive intents (feature, fix, refactor) and call out any refactor done only to enable the feature; mention tests, config, or scaffolding only when notable. Audience-facing and verdict-free — do not copy the review Summary's approve / request-changes assessment.
- If the repo defines `.github/PULL_REQUEST_TEMPLATE.md`, follow its sections, but keep the Task/links header at the top — without duplicating a link the template already has its own field for.
- No "Generated with Claude Code" line or other AI/tool attribution footer — even if a harness or environment default asks for one. End at the body.

Example:

```
Task: https://acme.atlassian.net/browse/CRM-123
Docs: https://acme.notion.site/csv-export-spec

Add a CSV export button to the contacts table. Rows stream from the
server so large accounts don't load every contact into memory. The
toolbar became a shared component to host the new button.
```

**Next:** once any findings are addressed, run `/update-pr-description` to apply this to the PR — or paste it in yourself.

## Verification

Apply the Standard Verification Checklist in `./references/engineering/review.md`. The output carries the **Reviewed** provenance line (reviewed head SHA + merge-base SHA + reviewing model) and the mandatory `Review pass:` line. On a delegated pass: the packet named the same object and identity Setup resolved, both intake checks passed — the `Identity` echo matched that identity and every return heading was present — before any settle step or `-p` launch, the settle re-read every Critical and Major anchor before rendering it, the session ran nothing against the tree while the reviewer was in flight, and the line reads `delegated (<model>)`. On the inline fallback, the degrade was announced and recorded as `./references/workflow/reviewer-contract.md` § *Degrade rule* requires.
With `-x`: the probe was merged per `./references/workflow/agent-fanout.md` and the output carries its `Cross-check:` line. With `-p`: each probe's findings were settled per `./references/workflow/agent-fanout.md` § *Merge contract*, subject to the suppression the `-p` bullet notes, and the output carries its mandatory `Lens probes:` line naming every lens, the gap sweep, and any candidate a group's settling left Inconclusive. <!-- cold -->
With `-d`: the session drafted the description itself on either pass, to the Format above — the `Task:`/links header, and a body short and readable, stating what changed and why rather than how. It is body-only and verdict-free, sources its links only from those already gathered — a `Task: <add ticket link>` placeholder rather than a fabricated URL — and carries no AI-attribution footer.

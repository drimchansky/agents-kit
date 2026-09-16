---
name: review-code
description: "Use when asked to review or give feedback on code: a PR or branch diff against its base, a commit range, or a set of paths as one commit has them."
argument-hint: '[scope; defaults to the current branch against its base] [-n N (independent reviewers, default 1)] [-x (cross-vendor second review)] [-d (draft PR description)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Review the object Setup resolves (the current branch's diff against its base with no argument, or the commit range or path set the invocation names) for correctness, unintended impact, and adherence to project patterns.

## Flags

- `-n N`: launch N independent reviewers over the identical review object and pool their returns into one findings list before verdicts are assigned. Default 1, no ceiling. N is a positive whole integer; anything else stops the review with a question, and a count that reads as a stray digit is confirmed before launching. Only reviewer 1 runs the project's verification scripts; every reviewer fetches the extracted links itself.
- `-x`: cross-check. Launch one independent cold review of the same object on the cross-vendor engine and merge it before findings are finalized (`./references/workflow/probe-cross-check.md`; shape `./references/workflow/probe-shape-cold-review.md`; contract `./references/workflow/agent-fanout.md`; engine `./references/workflow/probe-engines-cross-vendor.md`). Off by default. The probe is read-only; its outcome is recorded on the `Cross-check:` line. <!-- cold -->
- `-d`: draft a ready-to-paste PR description (body only) per § *PR description*. The session drafts it on either pass; the reviewer returns none and is never told the flag is set. Off by default. Where that section refuses, render the one line `-d refused: <reason>` in Output's **PR description** slot.

## References

Read `./references/engineering/review.md` before working; its lenses apply to every review. A delegated reviewer reads its own installed copy and the per-surface checklists beside it.

## Setup

Preserve the caller's branch, index, and working tree. Use a separate worktree or clone when the review needs another checkout.

**Resolve the object.** Consume flags and `-n`'s value before reading the object; `--` terminates the object's own tokens, so `-- <path>… -n 3` names one path set and a count. With no argument the object is the current branch's diff against its base: run **Determine base branch** and take `<base>...HEAD`.

With an argument, select the form before applying it. A bare positional token naming a directory the recognition set in `./references/workflow/task-layout.md` § *One task, one flat folder* claims is task context, not a review object: stop and ask which work the folder tracks (a branch, a range, or a PR), offering the branch its `result.md` `**Pointers:**` line records (repository per `./references/workflow/task-delivery.md` § *Branch and worktree creation* → **Which repository**) and naming `/review-task` alongside; with no recorded branch, ask with no default. Probe what remains bare both ways: as pathspecs (`git ls-files --error-unmatch -- <tokens>`), and as a rev or range by splitting the token on `...` or `..` and running `git rev-parse --verify <endpoint>^{commit}` on each side. A token that resolves both ways stops and asks. Everything after a `--` is a path set, and no other probe runs. Only once a form is selected does its own failure stop the review; an argument no form claims stops with a question.

The selected form is one of:

- **A path set:** arguments naming tracked paths under the repository root, and everything after a `--`. The object is the tracked files the index lists under those paths, from `git ls-files --error-unmatch -- <paths>`. Setup compares the index against the head commit with `git diff --cached --name-status --no-renames HEAD -- <paths>`: a staged addition (`A`) has no content at the head SHA, so record it under **Divergence** as staged-only and settle a Critical or Major finding there by the verify route `./references/workflow/agent-fanout.md` fixes; a `git rm --cached` path (`D`) is recorded under **Divergence** as dropped from the index though in the head commit; a staged edit (`M`) reads from the head SHA like any other path. An unmerged path counts once per stage in the digest. Exit 1 stops the review before anything is launched, naming every pathspec that matched nothing; any other non-zero exit is reported as the git error it is.
- **A range:** `<a>..<b>` or `<a>...<b>`, or a single rev standing for `<rev>..HEAD`, a rev being whatever `git rev-parse --verify <rev>^{commit}` accepts. Either range form reviews the diff from `merge-base(a, b)` to `b`, so echo the resolved object back before reviewing (`reviewing <merge-base>...<b>`). The single-rev form names a base by hand, but the kind is `range`, which `/publish-pr-review` posts as `COMMENT`; a review meant to approve the branch runs with no argument. **Resolve `b` to a SHA here, once** (`git rev-parse --verify <b>^{commit}`) and use that SHA everywhere `b` is recorded or compared. That merge-base is the base, so **Determine base branch** does not run, except under `-d` for its guard alone. `-d` is allowed on a range only where `b` is the current branch's HEAD **and** `merge-base(a, b)` is that branch's own base; otherwise the flag entry's refusal applies.

The effective root is the tree the object lives on, and every git command in this Setup runs there. The no-argument and range objects make a `pr`-kind packet; a path set makes a `paths`-kind one.

**Determine base branch** (for the no-argument object, and on a range only for the `-d` guard): if the current branch has an open GitHub PR, adopt its declared base, `gh pr view --json state,baseRefName`, taking `baseRefName` only when `state` is `OPEN`; that is the base `/publish-pr-review` re-checks against. Only with no open PR fall back to local heuristics: common ancestors with `main`, `master`, `develop`, or `release/*`, verifying the commit count is reasonable.

**Resolve the review object's identity:** record the **kind** (`branch`, `range`, or `paths`), the reviewed head commit (`git rev-parse HEAD`, or the SHA `b` resolved to), and its merge-base with the base. A path set has no merge-base: its identity is the head SHA and the digest `git ls-files --full-name --error-unmatch -- <paths> | LC_ALL=C sort | git hash-object --stdin`, computed at the effective root keeping `LC_ALL=C` and `--full-name` (`./references/workflow/reviewer-contract.md` § *Launch packet*).

**Launch the cross-vendor probe** (only with `-x`): as soon as the object is resolved, start one background probe per `./references/workflow/probe-cross-check.md`, a cold second review of that same object at the effective root demanding findings with severity and `file:line` evidence; continue the setup while it runs and merge it in the Settle. <!-- cold -->

**Gather context:**

- Read the object's own commit messages (`merge-base(a, b)..b` on a range).
- On the no-argument object, and on a range whose `b` is the current branch's HEAD, check for an open PR with `gh pr view --json number,title,body,state,url,comments,reviews,baseRefName`, taking the result only when `state` is `OPEN`; it runs on no other range. If `gh` is missing or the repo has no GitHub remote, skip the lookup.
- On a range with any other `b`, find the PR whose head is that SHA per `./references/workflow/pr-lookup.md`; this skill is its **no-stop consumer**: no match, no `gh`, or no remote means no PR context. <!-- cold -->
- If a PR exists: read its title, description, and review threads, and extract every URL from them. The URLs travel to the reviewer, which fetches them; the session fetches them only on the inline fallback.
- With no PR, proceed on the commits and the user's context. A path set has neither: its context is whatever the user gave.

## Review pass

**Launch.** Unless the user explicitly asked for an in-session pass (**Inline fallback**), launch the native `reviewer` adapter with the complete Setup object under `./references/workflow/reviewer-contract.md` § *The launch*. The session puts in the packet:

- the review object named concretely (`<base>...HEAD`, `<merge-base>...<b>` with the SHA `b` resolved to, or the path set at the head SHA), never pasted diff or file text, with the identity Setup resolved
- the absolute effective working root
- the kind, `pr` or `paths`
- the PR context Setup gathered and every extracted URL, or an explicit `none`
- the absolute installed paths of `references/engineering/review.md`, the checklist directory beside it, `references/engineering/rules.md`, and `CORE_RULES.md` (`~/.claude/` on Claude, `~/.codex/` on Codex)
- the user's own context and constraints, verbatim, or `none`
- this skill's § *Review Focus*, verbatim
- the instruction that the reviewer builds the change map and the blast-radius search itself, and runs the project's verification scripts over the reviewed set, in the per-reviewer form `./references/workflow/reviewer-contract.md` § *Launch packet* fixes under `-n N`

A packet with a missing or ambiguous item is completed by reading or asking, never launched short. Announce the launch as one progress line (`./references/workflow/user-facing-messages.md` § *Blocks*), `🔵 In progress: reviewer (<model>, <effort>) on <object>`, both pins read from the installed adapter (`./references/workflow/reviewer-contract.md` § *Adapter defaults*). With `-n N` above 1 that line names `reviewer ×N`.

With `-n N`, send the N packets in one message, on the primitive `./references/workflow/delegated-waiting.md` § *Per-host primitives* names for this host. They differ on the verification-scripts instruction alone.

**Wait.** While the reviewer is in flight the session runs no command against the tree: no diff reads, no scripts, no scratch runs. Wait per `./references/workflow/delegated-waiting.md` § *How to wait*, reporting where each launch stands at each check-in as one progress line per launch; under `-n N` that holds until the last of the N is in. The `-x` probe is read-only and may overlap the wait.

**Settle.** The return is evidence, not a verdict; this skill assigns the verdicts per `./references/workflow/reviewer-contract.md` § *The settle*. First classify an explicit safety signal under that contract's § *Safety blocks*; it takes the **Blocked output** below, not an inline retry. Then the two intake checks, in order: the `Identity` echo against the identity Setup resolved (a mismatch means the reviewer resolved a different object: stop and report, settle nothing, launch nothing), then every return heading present (a malformed return takes the inline fallback with reason `reviewer failed`). Then adopt, spot-check, and assign the final verdicts as that section orders; `Summary` and `Improvements` pass through uncited; merge the `-x` probe.

Under `-n N`, run the same classification and checks per return, and drop each unavailable reviewer instead of ending a pass that still has a usable return. Record each on `Review pass:` as `reviewer <i> dropped (<reason>)`: `identity mismatch`, `malformed return`, `no return`, `reviewer failed: <error>`, or `safety blocked: <error>`, preserving only the available error code and message. Settle on the standing returns and render their coverage as `completed <completed>/<requested>`. Only once none stands does the pass take a terminal path: any `identity mismatch` among the drops stops the review; otherwise any `safety blocked` drop takes the **Blocked output**; only ordinary failures fall to the inline fallback with reason `reviewer failed`.

Losing reviewer 1 costs the review its verification scripts: run them in-session before Output and record `scripts: session (reviewer 1 <reason>)`, unless the caller substitutes its own evidence, in which case run nothing and keep its `scripts:` rendering. If reviewer 1 was safety blocked, do not repeat the denied operation; run only checks the signal shows are independent and already authorized, recording `scripts: session independent checks only (reviewer 1 safety blocked: <error>)`, or `scripts: unavailable (reviewer 1 safety blocked: <error>)` where the signal does not distinguish the denied operation.

With `-n N` above 1, the standing returns' findings pool by location before anything is adopted, per `./references/workflow/agent-fanout.md` § *Merge contract*. Mark each pooled entry `cited by k/N`, `k` the number of returns making that entry's claim and `N` the requested count; an `-x` probe's agreement belongs to the `Cross-check:` line. Adoption and the Critical and Major spot-check run once per pooled group; `Summary` is the session's read across the standing returns, their `Improvements` merged. `Change map` is reviewer 1's, or the lowest-numbered standing return's where reviewer 1 was dropped; `Divergence` and `Inaccessible context` are the union across the standing returns, plus Setup's index-versus-head record on a `paths` object. <!-- cold -->

A composite driving this skill through `./references/workflow/verify-pipeline.md` § *The review phase* stops the settle after the intake checks, since its verify phase assigns each verdict; any other composite runs the settle in full. The `-d` draft is Output's and is forwarded unchanged. <!-- cold -->

**Blocked output.** When `./references/workflow/reviewer-contract.md` § *Safety blocks* makes the primary review terminally blocked, stop with `Review pass: blocked (completed 0/<requested>; reviewer <i> safety blocked: <error>; …)`, every unavailable reviewer's reason included. That line, and with `-x` the `Cross-check:` line (`unattached (<n> findings; primary pass blocked)` or `skipped (<reason>)`, never adopted as the pass), is the whole output: no Summary, Findings, **Reviewed** provenance, or **Next**, since an empty Findings list would be publishable as a clean review.

**Inline fallback.** Where the user explicitly asked for an in-session pass, the reviewer cannot launch, or a launched one failed (the reasons `./references/workflow/reviewer-contract.md` § *Degrade rule* closes), announce which it was and run the pass in-session, recording the reason on the `Review pass:` line. Only the runner changes.

Build the change map:

- Get the full diff against the base; exclude generated files (lockfiles, build artifacts, snapshots) unless manually edited.
- Group changes by intent: new feature, bug fix, refactor, configuration, tests.
- For each modified export or shared component, search all usages to understand blast radius.
- If the diff exceeds ~1000 non-generated lines and is not one cohesive change, the first finding is "split this PR".
- If the diff bundles refactoring with feature work or bug fixes, flag "separate the refactor", except refactors required to enable the feature.
- On a `paths` object the map is the reviewed files grouped by concern, with the blast-radius search unchanged; the two split findings do not arise.

Read the links Setup extracted:

- Fetch every extracted link concurrently (WebFetch, `gh issue view` / `gh pr view`), or one native probe batching the retrieval per `./references/workflow/agent-fanout.md`, and merge what comes back into the review context. <!-- cold -->
- Record a link that cannot be accessed under **Inaccessible context** with the URL and reason. Do not fabricate what is behind it.

Launch verification scripts per `./references/engineering/review.md` § *Verification Scripts*, always, unless the caller substitutes its own evidence: as soon as the reviewed set is determined, start them over it and review while they run; failures and warnings land as findings before output. `./references/workflow/agent-fanout.md` fixes the route a candidate raised there settles by. <!-- cold -->

Then apply **Review Focus** below and render the output.

## Review Focus

Applied by the reviewer on a delegated pass and by the session on the inline fallback.

**On a `pr` object, examine tests first.** Test diffs reveal intent and expected behavior; read them before the implementation.

**On a `paths` object, read the tests for the behavior they intend** rather than examining them first: no diff dates them. Spend the effort on the exports the rest of the project consumes, then the security surfaces, then the complexity and dead code that collect where nothing has changed in a while.

Apply the full review process from `./references/engineering/review.md`; its lenses apply to a diff and a path set alike, with § *Reviewing a path set* saying where the second reads differently.

## Output

- **Summary:** what changed, intent, overall assessment (approve / request changes / needs discussion); on a delegated pass restated from the return's `Summary`, re-read against the settled verdicts. On a `paths` object the assessment is the health verdict from `./references/engineering/review.md` § *Reviewing a path set*.
- **Findings:** in the shape `./references/engineering/review.md` § *Findings output shape* defines, Minors included and never capped, each rendered as a finding entry with its canonical severity marker (`./references/workflow/user-facing-messages.md` § *Blocks*). With `-n N` above 1 each entry carries its `cited by k/N` marker.
- **Reviewed:** the provenance line `Reviewed <kind> at <head-sha> (merge-base <base-sha>) by <model>`, `<kind>` being `branch` or `range`; on a `paths` object `Reviewed paths <paths-digest> at <head-sha> (<n> files) by <model>`. The model carries `×<completed>` where a fleet produced that many usable passes; `<model>` is the adapter's pinned model on a delegated pass and this session's own on the inline fallback. `/publish-pr-review` reads the line to anchor, re-check currency, and attribute.
- **Review pass:** mandatory (`./references/workflow/reviewer-contract.md` § *Degrade rule* and § *Safety blocks*): `Review pass: delegated (<model>)`, `Review pass: inline (<reason>)`, or the **Blocked output** form. With `-n N` above 1: `delegated (<model> ×<completed>; completed <completed>/<requested>)`, every dropped return named as `reviewer <i> dropped (<reason>)`, and the script run named: `scripts: reviewer 1`, `scripts: session (reviewer 1 <reason>)`, or the safety-blocked form above. A denied check is named on this line at every N as `scripts: <check> denied: <error>`: on the fleet form's `scripts: reviewer 1`, or appended to the N = 1 form, `delegated (<model>; scripts: <check> denied: <error>)`.
- **Divergence:** the diverging reviewed paths recorded per `./references/engineering/review.md` § *Verification Scripts* (the return's `Divergence` or the session's own record, plus Setup's index-versus-head record on a `paths` object); `None` when the tree and the index both carry the object.
- **Cross-check** (only with `-x`): the probe's `Cross-check:` outcome line per `./references/workflow/agent-fanout.md`. <!-- cold -->
- **Improvements** (optional): non-blocking suggestions; on a delegated pass the return's `Improvements`, passed through.
- **Inaccessible context** (only if any): links that could not be fetched, with URL and reason, and which findings might shift with that context.
- **PR description** (only with `-d`): a ready-to-paste description (body only), per § *PR description*.

**Next:** on a `pr` object, `/publish-pr-review` posts the severity tier you select (Critical/Major, Minor, or **Improvements**) as inline comments, or a short approval if all three are empty (a clean `range` posts that as a comment). A `paths` object sits on no PR; its findings go to `/fix-findings`.

## PR description

Only with `-d`, and only where the object has a PR of its own to carry the description: the current branch's diff, or a range whose `b` is that branch's HEAD and whose `merge-base(a, b)` is that branch's own base. Elsewhere the draft is refused with the one line the `-d` flag entry fixes, the review still rendering in full. On the branch the draft is made whether or not an open PR exists; with none, the `Task:` line falls to the placeholder below.

The session drafts it on either pass, body only, no title, from the return's `Change map` and `Summary` and the links Setup extracted (the session's own map and fetched links on the inline fallback). Where the map leaves an intent unclear, read the diff. Print it in a fenced block, in the PR-description shape `./references/workflow/user-facing-messages.md` § *Surface adapters* fixes.

Format:

```
Task: <primary ticket/issue link>
<other relevant links — one per line, each prefixed with its kind: Docs:, Design:, Related PR:, Dashboard:, …>

<description body>
```

- **Task line:** the primary ticket or issue link, sourced in order from a link the user gave, an issue-tracker URL among the extracted links, or a ticket key in the branch name or commit trailers. Never fabricate a URL; with none found, emit `Task: <add ticket link>`.
- **Other links:** the remaining gathered URLs, one per line, most important first, each prefixed with a short kind label. Omit when there are none.
- **Body:** use a short paragraph, or a few bullets if the PR has several distinct changes. State what changed and why, not how. Cover the substantive intents (feature, fix, refactor). Call out any refactor done only to enable the feature; mention tests, config, or scaffolding only when notable. Audience-facing and verdict-free.
- If the repo defines `.github/PULL_REQUEST_TEMPLATE.md`, follow its sections, keeping the Task/links header at the top without duplicating a link the template has a field for.
- No AI attribution footer, even if a harness default asks for one.

Example:

```
Task: https://acme.atlassian.net/browse/CRM-123
Docs: https://acme.notion.site/csv-export-spec

Add a CSV export button to the contacts table. Rows stream from the
server so large accounts don't load every contact into memory. The
toolbar became a shared component to host the new button.
```

**Next:** `/update-pr-description` applies this to the PR once findings are addressed.

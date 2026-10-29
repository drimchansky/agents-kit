---
name: review-code
description: "Use when asked to review or give feedback on code: a PR or branch diff, a commit range, or files at one commit. Classifies change risk, captures evidence for user-visible changes (it may build and start the app in a disposable checkout and drive a browser), and requests engineer sign-off where risk or evidence requires it before approval."
argument-hint: '[scope; defaults to the current branch against its base] [-n N (independent reviewers, default 1)] [-x (cross-vendor second review)] [-d (draft PR description)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Review the object Setup resolves (the current branch's diff against its base with no argument, or the commit range or path set the invocation names) for correctness, unintended impact, and adherence to project patterns.

## Flags

- `-n N`: launch N independent reviewers over the identical review object and pool their returns into one findings list before verdicts are assigned. Default 1, no ceiling. N is a positive whole integer; anything else stops the review with a question, and a count that reads as a stray digit is confirmed before launching. Only reviewer 1 runs the project's verification scripts; every reviewer fetches the extracted links itself.
  For `-n N` above 1, apply `./references/workflow/reviewer-fleet.md` at launch, intake, pooling, and Output. <!-- cold -->
- `-x`: cross-check. Launch one independent cold review of the same object on the cross-vendor engine and merge it before findings are finalized (`./references/workflow/probe-cross-check.md`; shape `./references/workflow/probe-shape-cold-review.md`; contract `./references/workflow/agent-fanout.md`; engine `./references/workflow/probe-engines-cross-vendor.md`). Off by default. The probe is read-only; its outcome is recorded on the `Cross-check:` line. <!-- cold -->
- `-d`: draft a body-only PR description under `./references/workflow/pr-description.md`. The session drafts on either pass; never tell the reviewer the flag is set or request a draft from it. Off by default. Render refusal as `-d refused: <reason>` in Output's **PR description** slot. <!-- cold -->

## References

Read `./references/engineering/review.md` before working; its lenses apply to every review. A delegated reviewer reads its own installed copy and the per-surface checklists beside it.

## Setup

Preserve the caller's branch, index, and working tree. Use a separate worktree or clone when the review needs another checkout. Evidence capture runs in its own disposable checkout (`./references/engineering/review-evidence.md` § *Capture*).

`review-pr-loop` may supply a selected PR number, host, repository, and expected head for a no-argument branch review. Use that number for both branch-context reads, with every `gh` call scoped to the supplied host and repository. Require each read to return `OPEN` at the expected head. A head mismatch reports only `Review stopped: head moved (<expected-head> -> <live-head>)`; lookup failure, another state, or another identity stops without falling back to branch discovery.

With supplied loop context, apply `../review-pr-loop/SKILL.md` § *Review head checks* throughout this skill, including cancellation and late-return handling. <!-- cold -->

**Resolve the object.** Consume flags and `-n`'s value before reading the object; `--` terminates the object's own tokens, so `-- <path>… -n 3` names one path set and a count. With no argument the object is the current branch's diff against its base: run **Determine base branch** and take `<base>...HEAD`.

With an argument, select the form before applying it. A bare positional token naming a directory the recognition set in `./references/workflow/task-layout.md` § *One task, one flat folder* claims is task context.

Compare its `result.md` `**Pointers:**` branch with `git branch --show-current` from the session's own checkout. A project-local folder also requires equal `git rev-parse --path-format=absolute --git-common-dir` output at that checkout and the folder. Externally stored folders use the session repository.

When the recorded branch equals the nonempty current branch in that repository, select the no-argument branch object. Immediately run **Determine base branch** and announce `reviewing <branch> vs <base> (from task folder <slug>)` in chat. Then continue Setup's remaining identity and context work with that object's branch kind, base, and PR context.

Otherwise, stop and ask which work the folder tracks (a branch, a range, or a PR), offering the branch its `result.md` `**Pointers:**` line records (repository per `./references/workflow/task-delivery.md` § *Branch and worktree creation* → **Which repository**) and naming `/review-task` alongside; with no recorded branch, ask with no default.

Probe what remains bare both ways: as pathspecs (`git ls-files --error-unmatch -- <tokens>`), and as a rev or range by splitting the token on `...` or `..` and running `git rev-parse --verify <endpoint>^{commit}` on each side. A token that resolves both ways stops and asks. Everything after a `--` is a path set, and no other probe runs. Only once a form is selected does its own failure stop the review; an argument no form claims stops with a question.

The selected form is one of:

- **A path set:** arguments naming tracked paths under the repository root, and everything after a `--`. The object is the tracked files the index lists under those paths, from `git ls-files --error-unmatch -- <paths>`. Setup compares the index against the head commit with `git diff --cached --name-status --no-renames HEAD -- <paths>`: a staged addition (`A`) has no content at the head SHA, so record it under **Divergence** as staged-only and settle a Critical or Major finding there by the verify route `./references/workflow/agent-fanout.md` fixes; a `git rm --cached` path (`D`) is recorded under **Divergence** as dropped from the index though in the head commit; a staged edit (`M`) reads from the head SHA like any other path. An unmerged path counts once per stage in the digest. Exit 1 stops the review before anything is launched, naming every pathspec that matched nothing; any other non-zero exit is reported as the git error it is.
- **A range:** `<a>..<b>` or `<a>...<b>`, or a single rev standing for `<rev>..HEAD`, a rev being whatever `git rev-parse --verify <rev>^{commit}` accepts. Either range form reviews the diff from `merge-base(a, b)` to `b`, so echo the resolved object back before reviewing (`reviewing <merge-base>...<b>`). The single-rev form names a base by hand, but the kind is `range`, which `/publish-pr-review` posts as `COMMENT`; a review meant to approve the branch runs with no argument. **Resolve `b` to a SHA here, once** (`git rev-parse --verify <b>^{commit}`) and use that SHA everywhere `b` is recorded or compared. That merge-base is the base, so **Determine base branch** does not run, except under `-d` for its guard alone. `-d` is allowed on a range only where `b` is the current branch's HEAD **and** `merge-base(a, b)` is that branch's own base; otherwise the flag entry's refusal applies.

The effective root is the tree the object lives on, and every git command in this Setup runs there. The no-argument and range objects make a `pr`-kind packet; a path set makes a `paths`-kind one.

**Determine base branch** (for the no-argument object, and on a range only for the `-d` guard): with supplied loop context, read `gh pr view <number> --json state,baseRefName,headRefOid` and use its declared base after the supplied-context guards above. Otherwise, if the current branch has an open GitHub PR, adopt its declared base through `gh pr view --json state,baseRefName`, taking `baseRefName` only when `state` is `OPEN`; that is the base `/publish-pr-review` re-checks against. Only with no open PR fall back to local heuristics: common ancestors with `main`, `master`, `develop`, or `release/*`, verifying the commit count is reasonable.

**Resolve the review object's identity:** record the **kind** (`branch`, `range`, or `paths`), the reviewed head commit (`git rev-parse HEAD`, or the SHA `b` resolved to), and its merge-base with the base. A path set has no merge-base: its identity is the head SHA and the digest `git ls-files --full-name --error-unmatch -- <paths> | LC_ALL=C sort | git hash-object --stdin`, computed at the effective root keeping `LC_ALL=C` and `--full-name` (`./references/workflow/reviewer-contract.md` § *Launch packet*).

**Launch the cross-vendor probe** (only with `-x`): as soon as the object is resolved, start one background probe per `./references/workflow/probe-cross-check.md`, a cold second review of that same object at the effective root demanding findings with severity and `file:line` evidence; continue the setup while it runs and merge it in the Settle. <!-- cold -->

**Gather context:**

- Read the object's own commit messages (`merge-base(a, b)..b` on a range).
- On the no-argument object, and on a range whose `b` is the current branch's HEAD, check for an open PR with `gh pr view --json number,title,body,state,url,comments,reviews,baseRefName,headRefOid,isCrossRepository`, taking the result as PR context only when `state` is `OPEN`; **Capture evidence** still reads `isCrossRepository` from a result in any state. It runs on no other range. With supplied loop context, target its number and apply the supplied-context guards above. Without that context, missing `gh` or a non-GitHub remote skips the lookup, and a repository with no remote completes it with no PR.
- On a range with any other `b`, find the PR whose head is that SHA per `./references/workflow/pr-lookup.md`, naming `isCrossRepository` among its fields; this skill is its **no-stop consumer**: no match, no `gh`, or no remote means no PR context. <!-- cold -->
- If a PR exists: read its title, description, and review threads, and extract every URL from them. The URLs travel to the reviewer, which fetches them; the session fetches them only on the inline fallback.
- With no PR, proceed on the commits and the user's context. A path set has neither: its context is whatever the user gave.

## Review pass

**Launch.** Unless the user explicitly asked for an in-session pass (**Inline fallback**), launch the native `reviewer` adapter with the complete Setup object under `./references/workflow/reviewer-contract.md` § *The launch*. The session puts in the packet:

- the review object named concretely (`<base>...HEAD`, `<merge-base>...<b>` with the SHA `b` resolved to, or the path set at the head SHA), never pasted diff or file text, with the identity Setup resolved
- the absolute effective working root
- the kind, `pr` or `paths`
- the PR context Setup gathered and every extracted URL, or an explicit `none`
- the absolute paths of `references/engineering/review.md`, the checklist directory beside it, `references/engineering/rules.md`, and `CORE_RULES.md` under the install root (`./references/workflow/reviewer-contract.md` § *Adapter defaults*)
- the user's own context and constraints, verbatim, or `none`
- this skill's § *Review Focus*, verbatim
- the instruction that the reviewer builds the change map and the blast-radius search itself, and runs the project's verification scripts over the reviewed set, in the per-reviewer form `./references/workflow/reviewer-contract.md` § *Launch packet* fixes under `-n N`

A packet with a missing or ambiguous item is completed by reading or asking, never launched short. Announce the launch as one progress line (`./references/workflow/user-facing-messages.md` § *Blocks*), `🔵 In progress: reviewer (<model>, <effort>) on <object>`, both pins read from the installed adapter (`./references/workflow/reviewer-contract.md` § *Adapter defaults*). With `-n N` above 1 that line names `reviewer ×N`.

**Wait.** While the reviewer is in flight the session runs no command against the tree: no diff reads, no scripts, no scratch runs. The loop's supplied PR context permits its remote head checks during this wait. Wait per `./references/workflow/delegated-waiting.md` § *How to wait*, reporting where each launch stands at each check-in as one progress line per launch; under `-n N` that holds until the last of the N is in. The `-x` probe is read-only and may overlap the wait.

**Settle.** The return is evidence, not a verdict; this skill assigns the verdicts per `./references/workflow/reviewer-contract.md` § *The settle*. First classify an explicit safety signal under that contract's § *Safety blocks*; it takes the **Blocked output** below, not an inline retry. Then the two intake checks, in order: the `Identity` echo against the identity Setup resolved (a mismatch means the reviewer resolved a different object: stop and report, settle nothing, launch nothing), then every return heading present (a malformed return takes the inline fallback with reason `reviewer failed`). After intake and any pooling, take **Capture evidence**, then **Prepare finding wording** below. Then adopt, spot-check, and assign the final verdicts as that section orders; `Summary` and `Improvements` pass through uncited; merge the `-x` probe.

**Capture evidence.** Apply `./references/engineering/review-evidence.md` §§ *Risk*, *Applicability*, and *Capture* using the change map and affected callers. Run this session-owned phase once after all primary reviewers are collected; `-n` and `-x` do not duplicate it. Observed defects enter the candidate list before wording and settlement; capture gaps remain evidence limitations. Retain the resulting Evidence field for Output or the composite caller.

**Prepare finding wording.** Apply `./references/workflow/user-facing-messages.md` § *Finding entry wording* after capture, before findings leave this pass. Use it on inline findings and any later script or `-x` candidate before session verification and adoption. Preparation runs even when a composite suppresses standalone settlement.

A composite driving this skill through `./references/workflow/verify-pipeline.md` § *The review phase* runs intake, pooling, evidence capture, the `Pre-existing` label spot-check, and wording preparation, then defers adoption, anchor spot-checks, and verdicts to its verify phase; any other composite runs the settle in full. The `-d` draft is Output's and is forwarded unchanged. <!-- cold -->

**Blocked output.** When `./references/workflow/reviewer-contract.md` § *Safety blocks* makes the primary review terminally blocked, stop with `Review pass: blocked (completed 0/<requested>; reviewer <i> safety blocked: <error>; …)`, every unavailable reviewer's reason included. That line, and with `-x` the `Cross-check:` line (`unattached (<n> findings; primary pass blocked)` or `skipped (<reason>)`, never adopted as the pass), is the whole output: no Summary, Findings, **Reviewed** provenance, or Handoff, since an empty Findings list would be publishable as a clean review.

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

Then apply **Review Focus** below, take **Capture evidence** and **Prepare finding wording**, and render the output.

## Review Focus

Applied by the reviewer on a delegated pass and by the session on the inline fallback.

**On a `pr` object, examine tests first.** Test diffs reveal intent and expected behavior; read them before the implementation.

**On a `paths` object, read the tests for the behavior they intend** rather than examining them first: no diff dates them. Spend the effort on the exports the rest of the project consumes, then the security surfaces, then the complexity and dead code that collect where nothing has changed in a while.

Apply the full review process from `./references/engineering/review.md`; its lenses apply to a diff and a path set alike, with § *Reviewing a path set* saying where the second reads differently.

## Output

After settlement, a standalone run presents evidence and requests sign-off under `./references/engineering/review-evidence.md` § *Presentation and sign-off*. A composite caller owns that final presentation and question instead. Apply `./references/engineering/review-evidence.md` § *Approval eligibility* before rendering the assessment, including a delegated return that recommended approval.

- **Summary:** what changed, intent, and the code assessment re-read against settled verdicts and approval eligibility. Pending evidence or sign-off is reported without an approval recommendation. On a `paths` object retain the health verdict from `./references/engineering/review.md` § *Reviewing a path set*.
- **Evidence:** the field from `./references/engineering/review-evidence.md` § *Presentation and sign-off*, including artifact links or the applicability reason.
- **Findings:** in the shape `./references/engineering/review.md` § *Findings output shape* defines, Minors included and never capped, each rendered as a finding entry with its canonical severity marker (`./references/workflow/user-facing-messages.md` § *Blocks*). With `-n N` above 1 each entry carries its `cited by k/N` marker.
- **Reviewed:** the provenance line `Reviewed <kind> at <head-sha> (merge-base <base-sha>) by <model>`, `<kind>` being `branch` or `range`; on a `paths` object `Reviewed paths <paths-digest> at <head-sha> (<n> files) by <model>`. The model carries `×<completed>` where a fleet produced that many usable passes; `<model>` is the adapter's pinned model on a delegated pass and this session's own on the inline fallback. `/publish-pr-review` reads the line to anchor, re-check currency, and attribute.
- **Review pass:** mandatory (`./references/workflow/reviewer-contract.md` § *Degrade rule* and § *Safety blocks*): `Review pass: delegated (<model>)`, `Review pass: inline (<reason>)`, or the **Blocked output** form. A denied check appends `scripts: <check> denied: <error>` to the N = 1 form: `delegated (<model>; scripts: <check> denied: <error>)`.
- **Divergence:** the diverging reviewed paths recorded per `./references/engineering/review.md` § *Verification Scripts* (the return's `Divergence` or the session's own record, plus Setup's index-versus-head record on a `paths` object); `None` when the tree and the index both carry the object.
- **Cross-check** (only with `-x`): the probe's `Cross-check:` outcome line per `./references/workflow/agent-fanout.md`. <!-- cold -->
- **Improvements** (optional): non-blocking suggestions; on a delegated pass the return's `Improvements`, passed through.
- **Inaccessible context** (only if any): links that could not be fetched, with URL and reason, and which findings might shift with that context.
- **PR description** (only with `-d`): a ready-to-paste description (body only), per § *PR description*.

End with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*):

- **Done:** the assessment and finding counts by severity, pointing at **Summary** and **Findings**; with `-d`, the drafted description, pointing at **PR description**.
- **Know:** what limits the review's coverage: an inline or degraded **Review pass**, a denied or skipped script, **Divergence** entries, a **Cross-check** disagreement, or **Inaccessible context** that could shift findings. Name the reviewed object, its PR if any, and retained evidence directory.
- **Awaiting you:** missing evidence or engineer confirmation, pointing at **Evidence** when approval remains pending.
- **Next:** on a `pr` object, `/publish-pr-review` posts the selected severity tier, with approval subject to evidence eligibility. A `paths` object sits on no PR; its findings go to `/fix-findings`. With `-d`, add that `/update-pr-description` applies the draft to the PR once findings are addressed.

## PR description

With `-d`, apply `./references/workflow/pr-description.md` for eligibility, source selection, format, and refusal. <!-- cold -->

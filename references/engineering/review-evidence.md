# Review Evidence and Sign-off

## Risk

For a branch or range, classify risk from the change map as `low`, `standard`, or `high`, and record the reason.
`high` covers a change to any sensitive path below, or to the behavior that path owns.
`low` covers changes confined to documentation, comments, tests, copy, or styling, with no change to logic, data shape, or shared interfaces.
Every other change is `standard`.
When the evidence does not settle a tier, use the higher one.
A `paths` review has risk `not-applicable`.

Sensitive paths:

- CI, release, and deployment workflows, plus review-policy files such as `.github/workflows/` and `CODEOWNERS`.
- Authentication, authorization, sessions, and secrets handling.
- Payments and billing.
- Installers and auto-updaters.
- Database migrations.
- Paths the reviewed repository's `AGENTS.md` or `CLAUDE.md` declares sensitive at the merge-base or the head, and any change to those declarations.

## Applicability

For a branch or range, trace the changed behavior through its callers and classify applicability as `required`, `none`, or `unknown`.
`required` covers visual and nonvisual behavior an end user of a product surface can observe. Record the affected screens, states, or outputs.
Changes only developers observe, such as APIs, CLIs, libraries, and agent instructions, are `none` unless they reach an end-user surface.
Use `none` only with a source-grounded reason that no end user can observe the change.
Uncertain applicability stays `unknown`, including missing review context.
A `paths` review has applicability `not-applicable`: it assesses files at one commit without a change baseline.

## Capture

The coordinating session captures once after primary reviewers return, before candidate wording and settlement.
Use the same phase on inline review. Reviewers and verification probes retain their existing write limits.

For `required` changes at every risk, create a unique directory beneath `~/.local/state/agents-kit/review-evidence/` before attempting capture.
Drive each changed feature flow end to end through the host's browser integration, such as a browser-automation tool or MCP server.
Use a browser context with no stored cookies, logins, or profile data, such as a fresh automation profile.
Never drive the context that uploads evidence or holds your signed-in sessions.
When the integration can drive only your own profile, capture stays `incomplete` with the gap `no isolated browser context`.
Save a real screenshot at each step, and record what that step showed. Save observable output for nonvisual changes.
Do not substitute generated images or written descriptions for screenshots.
Cover each identified changed behavior; before-and-after pairs and unchanged states are optional.

Prove the capture runtime represents the reviewed object, including inputs that affect the demonstrated behavior.
A checkout head alone cannot establish the identity of a running server or previously built artifact.
Run startup/build commands only in a disposable detached checkout of the reviewed head, added under the host's scratch area with `git worktree add --detach`.
Remove it with `git worktree remove --force` whenever capture ends, including on a stop or failure, after saving any evidence; retained evidence never lives inside it.
On a fork PR (`isCrossRepository` true, whatever the PR's state), run no command from the PR; capture of a `required` change stays `incomplete` with the gap `fork PR: local execution not authorized`.
Run commands only once a lookup has established the head's status through one of these outcomes:

- An OPEN PR at the reviewed head reading `isCrossRepository` false.
- On a branch, its OPEN PR reading `isCrossRepository` false whose head is an ancestor of the reviewed `HEAD`.
- A completed lookup finding no open PR, when the reviewed head is the checkout's `HEAD`. It completes when `gh pr view` reports no pull request for the branch. The commit query in `../workflow/pr-lookup.md`, run without its open-state filter, must also return no PR whose head repository differs from its base. `No commit found for SHA` counts as no PR. A repository with no remote completes the lookup without either call.

Every other outcome runs no command, and capture of a `required` change stays `incomplete` with the gap `fork status unknown: local execution not authorized`. That includes a skipped or failed lookup and a non-GitHub remote.

Allow documented local startup/build commands and bounded interactions needed for capture, using synthetic data without editing reviewed source.
Target only local or synthetic backends. Use no real credentials, accounts, sessions, or private data.
Start every capture process with a cleared environment (`env -i`): a `PATH` holding only the toolchain the documented commands need, and a temporary `HOME` under the host's scratch area.
Pass no credential variables or agent sockets, such as `SSH_AUTH_SOCK`, `GH_TOKEN`, `GITHUB_TOKEN`, `NPM_TOKEN`, or cloud-CLI settings.
A command that fails without them leaves capture `incomplete` with that gap.
The cleared environment withholds only environment credentials: capture processes keep your account's file and network access.
Take no destructive or persistent action outside disposable local state.
Stop processes started for capture whenever capture ends, including on a stop or failure. Keep security-candidate reproduction within `./security.md` § *Review Validation Boundaries*.
Missing tools, unavailable environments, unproved source identity, or denied execution leave capture `incomplete` with the exact gap.
A denial grants no retry through another agent, tool, or target.

Save an `evidence.md` index containing:

- Repository identity, review kind, head SHA, and merge-base SHA.
- Capture environment, including the names of the variables it passed and cleared, never their values, the browser context it drove, its temporary `HOME`, source/build identity, and the observations establishing that identity.
- Each changed flow, each step's observed result and artifact path, and each artifact's SHA-256 hash; identify uncovered states explicitly.
- Capture result, `complete` or `incomplete`, and each gap or failed attempt.

Hash the finished index and retain that hash with the artifact hashes as the presented evidence fingerprint.
Keep each presented evidence set immutable; refreshed evidence uses a new directory and fingerprint.
Preserve complete and incomplete sets through scratch and worktree cleanup. Commit none.
Upload artifacts only through `../../skills/publish-pr-review/SKILL.md` under its evidence selection.

## Presentation and sign-off

Report evidence separately from code findings, including when there are no findings:

`Evidence: risk <low|standard|high|not-applicable> (<reason>); <applicability>; capture <complete|incomplete|not-required>; sign-off <pending|confirmed|not-required>; approval <eligible|pending|not-applicable>; <directory/index link or reason>`

The `approval` slot reports evidence eligibility only; the findings and verification bar applies separately.
Risk `high` takes sign-off `pending` for every applicability until the engineer confirms.
For `none` and `not-applicable`, use `not-required` for capture and retain the applicability reason.
`not-applicable` also uses `not-required` for sign-off.
Below risk `high`, `none` also uses `not-required` for sign-off and takes approval `eligible`.
At risk `low`, `complete` required evidence takes sign-off `not-required` and approval `eligible`.
Any other `required` evidence takes sign-off `pending` and approval `pending` until the engineer confirms.
A path-set report uses approval `not-applicable` and keeps its health assessment.
For `unknown`, use `incomplete`, `pending`, and approval `pending`. A missing Evidence field is unknown, never `none`.
Request sign-off only for `required` evidence or `none` at risk `high`, and only while sign-off is `pending`.
`unknown` reports its gaps without asking, since no confirmation makes it eligible.
For a required review, present the index, artifact links, object identity, and evidence fingerprint before requesting confirmation.
For `none` at risk `high`, present the object identity, the risk reason, and the code assessment instead.
The outermost workflow owns the final evidence presentation and sign-off request. Inner review phases capture and forward evidence without asking.

Ask whether the engineer signs off on the demonstrated changes for that object and fingerprint in this session.
For `none` at risk `high`, ask whether the engineer signs off on the reviewed object in this session instead.
Accept only the engineer's explicit answer to that presentation; invocation, standing publishing consent, silence, CI, GitHub approval, and saved metadata supply no sign-off.
An approval-capable publication choice may combine sign-off and posting permission when its question explicitly names both actions and that evidence or object.
Reuse matching confirmation already given in this session without asking again.
Record confirmation separately from the immutable capture index; a record or another session's reply grants no current consent.

Before accepting a reply and immediately before publication, recheck repository, review kind, head, and merge-base.
For `required` evidence, also recheck the index hash and every artifact hash against the presented fingerprint at both points.
A reply that passes these rechecks updates the retained Evidence field: sign-off `confirmed`, and approval per § *Approval eligibility*.
Later steps and publication read that updated field.
For `none`, no capture directory, index, or artifact hashes are required.
Changed identity invalidates prior applicability and confirmation and requires a fresh review.
Required evidence that is replaced, missing, or changed invalidates confirmation and requires fresh evidence and sign-off.
Incomplete `required` evidence keeps approval pending until the engineer signs off on it, at every risk including `low`.
Present each gap, and ask for sign-off on the demonstrated changes together with those named gaps.

## Author delivery

An attached evidence set posts an `Evidence for the author:` list after the review body's block and unanchored list.
Each entry names one changed flow and links the uploaded screenshot for each step. Name every capture gap.
A finding comment carries the screenshot that shows its problem, when one does.

## Approval eligibility

An approval requires the existing findings and verification bar plus applicability `none` below risk `high`, `complete` required evidence at risk `low`, or matching session confirmation.
Confirmation covers required evidence, or the reviewed object for `none` at risk `high`.
Confirmation of incomplete evidence names each gap.
Applicability `unknown` remains approval `pending`.
Any route needing confirmation without a valid one also remains approval `pending`.
Path-set health assessments remain unchanged and supply no PR approval.
Apply this requirement to approval verdicts and approval-equivalent wording, including range and own-PR COMMENT bodies.
While approval is pending, report the code assessment without an approval recommendation and name the outstanding evidence or sign-off.
Findings remain reportable and publishable under their existing authorization; a finding publication supplies no approval or sign-off.

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

**Hook-free checkout.** Apply this rule to every Git command checking out or updating a PR's code in a checkout.
Also apply it to every `git fetch` run in a checkout that holds a PR's code.
In the checkout where the command runs, read configured hooks with `git config --get-regexp '^hook\..*\.event$'`.
Extract each hook name between `hook.` and `.event` from the returned keys, regardless of its event.
Pass `-c core.hooksPath=/dev/null -c core.fsmonitor=false` and `-c hook.<name>.enabled=false` for every listed name to that Git command.
No output with exit status 1 means no configured hooks; pass only `-c core.hooksPath=/dev/null -c core.fsmonitor=false`.
In the same checkout, list configured filter drivers with `git config --get-regexp '^filter\..*\.(clean|smudge|process)$'`.
Extract each distinct driver name `<d>` between `filter.` and the final `.clean`, `.smudge`, or `.process` of the returned keys.
For every listed driver, also pass `-c filter.<d>.smudge= -c filter.<d>.process= -c filter.<d>.required=false` to that Git command.
No output with exit status 1 means no configured drivers; pass no filter flags.
For a `git worktree add`, run the add with `--no-checkout`, passing the hook flags listed in the caller's checkout.
Then list hooks and filter drivers again with the same patterns, reading the new worktree's configuration through `git -C <path> config --get-regexp`.
Populate the worktree with `git -C <path> reset --hard --no-recurse-submodules`, passing `-c core.sparseCheckout=false` and the flags that second listing produced.
A caller taking this rule without its filter flags still disables hooks this way and keeps filter drivers enabled.
That caller's populate step still passes `-c core.sparseCheckout=false`.

**PR checkout.** Apply this rule to every Git command and file-tool read or search in a checkout that holds a PR's code under review.
Those checkouts are the PR-form review worktree (`../../skills/review-code/SKILL.md` § *Setup*) and `review-pr-loop`'s checkout (`../../skills/review-pr-loop/SKILL.md` § *Setup*).
The rule binds the session, delegated reviewers, the `-x` probe, and verify probes.
It also covers a `git worktree remove` of either checkout run without `--force`.
In the checkout where the command runs, list configured hooks and read the listing as the hook-free checkout rule above does.
Pass `-c core.fsmonitor=false -c core.hooksPath=/dev/null` and `-c hook.<name>.enabled=false` for every listed name to each such command.
Every `git diff`, `git log`, `git show`, and `git blame` run there also passes `--no-ext-diff --no-textconv`.
Its read gate lets a file tool read a path only when `git ls-tree <head-sha> -- <path>` lists it with mode `100644` or `100755`.
Read the file at the path that listing prints.
Read any other file with `git show <head-sha>:<path>`.
Resolve a symlink (mode `120000`) on the path relative to the link's directory, whether it is the path itself or an ancestor directory.
An ancestor link leaves the path unlisted, so list each ancestor directory to find it.
Check the resolved path the same way.
Its search gate lets a Grep, Glob, or `rg` call take a path only when `git ls-tree <head-sha> -- <path>` lists it with mode `040000`, `100644`, or `100755`.
The checkout root passes the search gate without a listing.
Search at the path that listing prints.
Never follow a link out of the reviewed tree.
In the PR-form review worktree, Git commands read only commits and stored objects.
Examples are `git show <head-sha>:<path>`, `git diff <merge-base> <head-sha>`, `git log`, `git blame <head-sha> -- <path>`, `git rev-parse`, and `git merge-base`.
No Git command there reads or refreshes the working tree or index, such as `git status`, a `git diff` naming fewer than two revisions, or `git blame` without a revision.
Read and search files there with file tools wherever the read and search gates allow.
Committed symlinks there check out as plain files holding the link target.
Each still lists with mode `120000` in `git ls-tree <head-sha> -- <path>`, so the read gate resolves it relative to the link's directory.
Treat their text as the target path, not file content, in reads and searches alike.
A review in that worktree records `Divergence` as `None`.

The PR checkout lines in `../workflow/probe-shape-cold-review.md` and `../workflow/probe-shape-verify.md` carry a sanctioned copy per `references/maintenance/repository.md` § *Consumer lists*.

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
Run startup/build commands only in a disposable detached checkout of the reviewed head, added under the host's scratch area with `git worktree add --no-checkout --detach`.
Add it only once the lookup below authorizes commands.
Apply this section's hook-free checkout rule to that add and its populate step without its filter flags, keeping filter drivers enabled.
Remove it with `git worktree remove --force` whenever capture ends, including on a stop or failure, after saving any evidence; retained evidence never lives inside it.
On the PR form, run the disposable checkout's add and its removal from the caller's checkout.
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
When Reviewed names `in <host>/<owner>/<repo>#<n>` (the PR form), this recheck covers repository, review kind, PR state, and head.
Read the state and head with `gh pr view <n> --json state,headRefOid`, taking `<n>` from that line.
Scope that read with the run's `GH_HOST=<host>` and `GH_REPO=<host>/<owner>/<repo>`; require `OPEN` and the reviewed head.
Run this PR-form recheck from the caller's checkout; it needs no review worktree.
On the PR form, publication adds the merge-base recheck against the live PR base.
See `../../skills/publish-pr-review/SKILL.md` § *Preconditions — stop if unmet* for the live head and merge-base checks.
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

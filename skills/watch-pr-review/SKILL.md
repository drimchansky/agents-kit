---
name: watch-pr-review
description: Use when asked to watch a pull request as its reviewer — one engineer-invoked pass that resolves or creates a persistent git worktree for the pull request's head branch, runs a verified review there (`review-pr-triage-verify`), and prints the verdicts. Creates and removes worktrees and installs their dependencies; edits no code, never stages, never commits, never posts to the pull request, never touches a task folder — posting is `/publish-pr-review`'s.
argument-hint: '[PR number or URL — required; run from inside a checkout of the PR''s repository]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One engineer-invoked pass over one pull request you are reviewing: resolve the pull request, materialize its code in a git worktree, dispatch a verified review anchored in that worktree, and stop with the verdicts in front of you. The pass holds no state and leaves none — no cursor, no task folder, no file recording that a pass ran — so it reviews whatever the pull request currently carries, every time it runs. The worktree it leaves behind is the pull request's *code*, not a record of the pass: nothing about an earlier pass is read back out of it, and a first pass and a hundredth behave identically against the same head. Repetition, where it is wanted, is the harness's `/loop` over this same command, and the session it runs in is the only thing that carries anything between passes.

This is a composite: phase 2 executes the sibling skill file it names, end to end. Three overrides apply pipeline-wide:

- **Core Rules blocks** — the composite's own block above covers the pipeline; a dispatched skill's `AGENTS.md` and engineering-rules reads are already satisfied and don't repeat. The override stops there: every other step of the dispatched skill runs unchanged.
- **Chat display** — the composite's Output owns what reaches you. A dispatched skill's Output prints at its seam, in the shape that skill specs.
- **Next pointers** — the dispatched skill's follow-up suggestions are dropped; the composite's Output owns **Next**.

Past these three, a phase departs from its skill only where its own section below says so — never by improvisation.

**CRITICAL**: this pass's on-disk writes are worktree lifecycle only — the `git fetch origin <headRefName>` that moves the remote-tracking ref, `git worktree add` (creating local `<headRefName>` with `--track -b` where none exists), the `--ff-only` refresh that advances that branch wherever it is checked out — the engineer's main checkout included, when the branch match resolves there — a lockfile-keyed dependency install inside a worktree it resolved, and `git worktree remove` (never `--force`). It edits no source file, writes no task-folder file, stages nothing, commits nothing, creates no commit, and touches no ref beyond the pull request's own head branch and its remote-tracking ref — no other branch is created, moved, or deleted. Nothing is posted back to the pull request: replying to a thread, resolving it, and posting the review itself stay with you, through `/publish-pr-review`'s counted tier picker.

## When to Use

**Use when:**

- You are reviewing someone else's pull request and want its code materialized and verifiably reviewed in one command — a review whose findings a probe actually settled, not a reading of the diff alone
- The author pushed since your last look and the branch should be re-reviewed against what is on it now
- The verdicts should sit in the session, where `/publish-pr-review` can post the tier you choose

**Skip when:**

- The diff alone is enough → `/review-pr` in your own checkout reads committed history and needs no worktree at all; this pass exists for the reviews that have to run the code's own checks
- You authored the pull request → `/watch-pr-author` verifies what the reviewers wrote and applies the fixes it confirms; this one produces findings rather than acting on them
- The pull request's repository has no checkout on this machine → clone it first. The pass materializes code *beside* a checkout; it refuses rather than going to find one
- The pull request comes from a fork → out of scope, and Setup refuses before a worktree is touched

## Setup

Resolve both targets — the pull request and the repository it belongs to — before anything else, and refuse here rather than later.

**The pull request.** An explicit argument is **required**: a number, resolved against the repository the invocation directory sits in, or a URL. No argument → **refuse**: say the pull request has to be named, and stop. There is no branch inference here and the omission is deliberate — the branch you happen to be sitting on says nothing about which pull request you are reviewing, since a reviewer's checkout normally sits on `main` while the code under review lives on someone else's branch.

**The repository.** The invocation directory must sit inside a checkout of the pull request's repository — the main checkout or any linked worktree of it. Confirm it by comparing the `owner/repo` carried in the fetch's `url` against the one parsed out of `git remote get-url origin` — parsed, because `git@github.com:acme/kit.git` and `https://github.com/acme/kit.git` name one repository and a literal comparison would refuse the SSH form. A mismatch, or no checkout at all (`git rev-parse --git-dir` fails), → **refuse** with the reason. The pass materializes code beside a checkout; it does not go find one, and a wrong checkout would put the worktree beside the wrong repository.

The **main checkout root** is the first entry of `git worktree list --porcelain`, which lists it ahead of every linked worktree. Every path below derives from that root rather than from the invocation directory, so a pass invoked from inside a linked worktree behaves identically to one invoked from the main checkout.

**One fetch for everything.** `gh pr view <target> --json state,number,url,headRefName,headRefOid,updatedAt,isCrossRepository` — one call, whose fields the repository comparison above, the quiet check below, and phase 1 all read. Taking them together is what makes them describe the same instant: the head SHA the worktree is refreshed to, the state the prune decision turns on, and both quiet-check fields are one observation of the pull request, not three that can disagree.

**Fork pull requests are out of scope.** `isCrossRepository: true` → **refuse**, naming the limitation. Phase 1's resolution needs the head branch to exist on `origin` — it fetches and tracks `origin/<headRefName>` — and a fork's head lives on another remote entirely; supporting it means a second remote and a different tracking shape, which this pass does not have.

**`gh` is required.** The fetch above is the pass's only source for every field it turns on. Unavailable — missing, unauthenticated, or no GitHub remote — say so with the reason and stop; there is no by-hand substitute.

## The session-held quiet check

Where `state` is `OPEN` and this session has **already run a pass of this skill over the same pull request**, compare the `headRefOid` and `updatedAt` Setup's fetch just returned against what this session's previous such pass observed.

- **Both unchanged** → report `no change since this session's last pass`, resolve no worktree, dispatch nothing, and end the pass there.
- **Either changed, this session has no previous pass of this skill over this pull request, or `state` is not `OPEN`** → go to phase 1.

Five properties fix what this check is:

- **It touches no disk.** The comparison lives in session memory only — nothing is written anywhere to hold it, and nothing is read from anywhere to restore it. It dies with the session and with `/clear`, which is the whole of its lifetime. The worktree on disk is not this state and is never read as it: it says what code the pull request had, never whether a pass has looked at it.
- **A first pass always proceeds.** The first pass in any session has nothing to compare against and reviews what it finds, so this check can never be what stops a review from happening — it only declines to repeat a review this same session already did. A `/watch-pr-author` pass over the same pull request is not one of those: the two skills hold their observations separately, so an author-side pass never masks a review here, nor the reverse.
- **Only a completed pass records.** What the next pass compares against is the observation of a pass that reached its Output; one that ended before it — Refresh stopping on a non-fast-forward, an install failure, phase 2's pipeline refusing on a dirty worktree — holds nothing, so the re-run its report invites once the cause is cleared compares against the last *completed* pass rather than the one that stopped, and proceeds. A completed pass that found nothing to report still records: it read the pull request as it stands, and a repeat against the same head would read the same.
- **It binds `OPEN` pull requests only.** A `CLOSED` or `MERGED` pull request skips the check and reaches phase 1 every time. There the pass is prune-or-nothing — no review is dispatched whatever it finds — so the check has no review to decline and nothing worth saving: that pass is already the one `gh` call Setup spent plus a worktree list. What the scoping buys is the retry. A prune Git refused on a dirty worktree is meant to be re-run once the worktree is clean, and a closed pull request's `headRefOid` and `updatedAt` sit still by definition — so a check binding here would report `no change` to every retry and leave the refusal standing for the rest of the session.
- **`updatedAt` over-triggers rather than missing.** It moves for *any* activity on the pull request, so a label edit costs one redundant pass; what it cannot do is stay still while the author pushes or a reviewer comments. The cheap failure is chosen over the invisible one.

**Under `/loop`**, this check is what makes a quiet tick cost exactly one `gh` call — Setup's fetch, already spent — instead of a worktree resolution and a full review pipeline. A pass that stopped short of its Output records nothing, so the tick after one attempts the pass again rather than masking the stop as a quiet tick. **A close is never masked by it**: a closed or merged pull request sits outside the check's scope entirely, so every such tick falls through to phase 1, where the prune is — the first one to see the new state, and each retry after a refusal.

## Phase 1 — Resolve the worktree

Work these in order. The first of the three **resolution** bullets that applies decides how the worktree resolves; **Refresh** and **Install** are not among them and run after, in that order, on whatever worktree that resolution left.

- **Closed → prune.** `state` is `CLOSED` or `MERGED`: find the worktree by the branch match below. The match resolving to the **main checkout** is nothing to prune — `git worktree remove` refuses a main working tree whatever its state — so report that, naming the branch still checked out there, and skip the removal. Found and clean → `git worktree remove <path>` — **never `--force`** — and report it pruned, naming the local `<headRefName>` left behind: `git worktree remove` deletes the directory, never the branch, so `git branch -d` (never `-D`) is yours once you are done with it. Git refuses because the worktree is dirty or carries untracked files → report the refusal and **leave the worktree standing**: a dirty worktree holds someone's work, and `--force` would discard it to save a directory. None found → report there was nothing to prune. Either way the phase ends here and **no review is dispatched**: a closed pull request is not a review target.

- **Branch match.** `git worktree list --porcelain` from the main checkout root; match a `branch refs/heads/<headRefName>` line exactly. Matched → **reuse that worktree at whatever path and name it has**. A pass **never computes a directory from a branch name**: the worktrees this slots into are made by hand and named by hand, on no scheme a path could be derived from, so the branch is the only identity that resolves reliably — and matching on it is exactly what lets a pass adopt a worktree the engineer created themselves. The main checkout is the list's first entry and matches like any other; where it is the match, reuse is also the only option, since Git will not check one branch out in two places. A worktree sitting **detached** at the pull request's head carries no `branch` line and will not match, so the pass creates a second worktree beside it — a known narrowing, accepted because loosening the match to a SHA would adopt any worktree that happened to share a commit.

- **No match → create.** `git fetch origin <headRefName>` first, then, from the main checkout root: where a local branch `<headRefName>` already exists, `git worktree add <dir> <headRefName>`; otherwise `git worktree add --track -b <headRefName> <dir> origin/<headRefName>`.

  `<dir>` is `<main-checkout-parent>/<repo>.worktrees/<repo>-<slug>/` — a sibling directory beside the main checkout, outside the project itself, where `<repo>` is the main checkout's basename and `<slug>` is the branch tail with type prefixes (`feat/`, `fix/`, `chore/`, …) and ticket-ID tokens stripped. The slug is **cosmetic only** — it makes the directory readable and nothing reads it back, since resolution matches on the branch and never on a path.

- **Refresh.** A resolved worktree may sit behind the pull request's head — one that already existed, and one just created off a pre-existing local `<headRefName>`, which `git fetch origin <headRefName>` advances the remote-tracking ref of and not the branch. Compare its `HEAD` (`git -C <worktree> rev-parse HEAD`) against Setup's `headRefOid`. Equal → nothing to do. Otherwise → `git -C <worktree> pull --ff-only origin <headRefName>`, then compare `HEAD` against `headRefOid` again. Still not equal → report that and **stop rather than resetting** — the pull refused as a non-fast-forward (a force-pushed head, or diverged local commits), or answered `Already up to date` over a worktree sitting **ahead** on local commits, which `--ff-only` does not touch — the worktree may hold work of yours, and how to reconcile it is your call, not this pass's. The re-comparison, not the pull's exit, is what licenses the review: phase 2 must describe the pull request's head, and only that equality says it will.

- **Install.** Dependencies, by lockfile, in the resolved worktree: `pnpm-lock.yaml` → `pnpm install`, `yarn.lock` → `yarn install`, `package-lock.json` → `npm install`; no `package.json` → skip, and a `package.json` with none of those lockfiles → skip too, saying so — an unkeyed install has nothing to pin and would write a lockfile the branch does not carry, dirtying the worktree phase 2 requires clean. It runs on the `HEAD` Refresh left, and in exactly two cases: the worktree was **just created** — nothing is installed in it yet, whichever `git worktree add` form made it — or Refresh **fast-forwarded it across a lockfile change**, which is `git -C <worktree> diff --name-only <head-before-pull> <head-after-pull> -- pnpm-lock.yaml yarn.lock package-lock.json` coming back non-empty. A reused worktree already at the head, or fast-forwarded with no lockfile among the changed paths, is **not** reinstalled: what it carries is what the engineer left there. It sits **after Refresh** because an install is for the `HEAD` the review runs on, and a worktree created off a pre-existing local `<headRefName>` reaches that `HEAD` only in Refresh. **An install failure stops the pass** — report it and dispatch nothing. Phase 2's pipeline runs the repository's own verification scripts, and a review whose scripts cannot run — or run against stale dependencies — is not the verified review this skill promises; reviewing anyway would produce script failures that describe the install rather than the pull request.

**The worktree persists after the pass** — that is the point of resolving one: the next pass, and the next review of the next push, reuse it rather than paying for a clone again — and for an install only where the fast-forward moved a lockfile. The close-time prune above is the only removal this skill ever performs.

## Phase 2 — Review

Execute `../review-pr-triage-verify/SKILL.md` end to end, **anchored at the worktree**. Every command of that pipeline runs with the resolved worktree as its repository root — its Setup's base resolution and working-tree check, the diff it reviews, the blast-radius greps, the verification scripts it runs, and the probes it fans out, whose prompts carry the worktree root as the repository they read. The invocation checkout is not that root and is never read as it; a review anchored there would describe whatever branch you happen to be sitting on.

**Its clean-tree precondition holds by construction where the worktree was created.** That pipeline's Setup refuses when any reviewed path carries an uncommitted change, and a worktree this pass just created sits on the head branch with nothing modified. Where phase 1 instead matched a worktree that already existed — the main checkout among them — the precondition is a real check on someone else's tree, and that pipeline stops on a dirty one exactly as it specs.

Its Output prints at the phase-2 seam per the overrides, less its **Next**. Its findings and verdicts stay in the session, which is precisely where `/publish-pr-review` reads them from.

## Output

Lists, never tables.

- **Pass** — the pull request the pass ran against, and how the repository resolved: the checkout the invocation sat in and the main checkout root every path derived from. Or the refusal it stopped on (no argument, wrong repository, fork, no `gh`), or `no change since this session's last pass` where the quiet check ended it, or the prune report where the pull request was closed.
- **Worktree** — `reused at <path>` (and whether it was already at the head or fast-forwarded to it; on a fast-forward, whether it moved a lockfile and so reinstalled, with that install's result), `created at <path>` with the dependency install's result, `pruned <path>`, `left dirty at <path>` with Git's refusal quoted, or `stale at <path>` where the refresh did not land on the head — Git's refusal quoted on a non-fast-forward, or the ahead state named where the pull answered `Already up to date`. Where the pass stopped before resolving one, say so and why.
- **Review** — `../review-pr-triage-verify/SKILL.md`'s Output as that skill specs it, its Summary, Batches, Findings, Minor findings, Improvements, and Reviewed line intact, printed at the phase-2 seam less the `**Next:**` the overrides drop; or `not dispatched — <reason>`.

**Next:** the verdicts are in this session and nothing has reached the pull request. `/publish-pr-review` offers them as counted severity tiers and posts the one you select — run it **from the worktree**, whose branch is what resolves this pull request for that skill's own precondition; nothing goes up until you select there. The worktree is kept at `<path>` for the next pass, so a re-review after the author pushes costs a fast-forward rather than a clone. `/watch-pr-review <pr>` again any time.

## Verification

Confirm the protocol invariants before finishing:

- [ ] The pull request came from an explicit argument, and the invocation directory was confirmed to sit in a checkout of its repository — otherwise the pass refused, and a fork pull request refused before any worktree was touched
- [ ] The quiet check ran only on an `OPEN` pull request, comparing `headRefOid` and `updatedAt` from Setup's own fetch against what this session's previous **completed** pass **of this skill** over the same pull request observed, held in session memory alone with nothing read from or written to disk; a pass that stopped before its Output recorded nothing, a session with no previous such pass proceeded on what it found, and a closed or merged pull request reached phase 1 unchecked
- [ ] A prune happened only on a `CLOSED` or `MERGED` pull request, ran `git worktree remove` without `--force`, never attempted it against the main checkout, and left a dirty worktree standing and reported rather than removing it — with no review dispatched either way
- [ ] Reuse was decided by the exact `branch refs/heads/<headRefName>` match and nothing else; no directory was computed from a branch name, and no second worktree was created for a branch already matched
- [ ] A created worktree sits at `<main-checkout-parent>/<repo>.worktrees/<repo>-<slug>/`, and every resolved worktree behind the head — reused or freshly created off a local branch — was brought forward with `pull --ff-only` and confirmed at `headRefOid` after it, a worktree the pull left elsewhere — non-fast-forward or ahead — reported rather than reset away
- [ ] The lockfile-keyed install ran after Refresh — on a created worktree, and on a fast-forward that moved a lockfile — and an install failure stopped the pass instead of dispatching a review whose scripts cannot run
- [ ] Phase 2 ran `../review-pr-triage-verify/SKILL.md` anchored at the worktree — its base detection, diff, greps, verification scripts, and probes all rooted there, never at the invocation checkout
- [ ] Nothing was staged, committed, or posted to the pull request; no source file was edited and no task-folder file was read or written — the worktree lifecycle is the whole of what this pass changed on disk (the pull request's own head branch excepted: its `--track -b` creation, the fetch's remote-tracking move, and the `--ff-only` advance are that lifecycle's ref writes — no other ref moved, none deleted)
- [ ] **Next** named `/publish-pr-review` as the one path by which anything reaches the pull request

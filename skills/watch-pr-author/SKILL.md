---
name: watch-pr-author
description: Use when asked to watch a pull request on behalf of its author — one engineer-invoked pass that runs a verified triage of what reviewers wrote (`triage-findings-verify`), applies the fixes it confirms (`fix-findings`), and stops at a commit-ready tree. Reads the pull request and edits working-tree code; never stages, never commits, never posts to the pull request, never touches a task folder.
argument-hint: '[PR number/URL — defaults to the current branch''s open PR; run from inside a checkout of the PR''s repository]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One engineer-invoked pass over one pull request: resolve the pull request, dispatch a verified triage of what its reviewers wrote, apply the fixes that triage confirms, and stop. The pass holds no state and leaves none — nothing on disk carries a floor from one pass to the next, so a pass acts on the pull request's whole open findings set every time it runs. Repetition, where it is wanted, is the harness's `/loop` over this same command, and the session it runs in is the only thing that carries anything between passes.

This is a composite: both phases execute the sibling skill files they name, end to end. Three overrides apply pipeline-wide:

- **Core Rules blocks** — the composite's own block above covers the pipeline; a dispatched skill's `AGENTS.md` and engineering-rules reads are already satisfied and don't repeat. The override stops there: every other step of each dispatched skill runs unchanged.
- **Chat display** — the composite's Output owns what reaches you. A dispatched skill's Output prints at its seam, in the shape that skill specs.
- **Next pointers** — the dispatched skills' follow-up suggestions are dropped; the composite's Output owns **Next**.

Past these three, a phase departs from its skill only where its own section below says so — never by improvisation.

**The pass stops at a commit-ready tree.** Phase 2 leaves its fixes in the working tree, unstaged and uncommitted, and the pass ends there — staging and committing are yours, and `/commit` is a terminal filing step this pass never reaches for. What stopping there costs downstream is named in the Output's **Next** rather than left for the next run to discover.

**The fix phase delegates, and adds no binding.** Phase 2 executes `../fix-findings/SKILL.md`, whose § *Execution strategy: every auto-path fix delegates* sends every Confirmed auto-path fix to a write-mode executor under that skill's own registered binding in `./references/workflow/executor-contract.md` § *Bindings* — read there, by that skill, only where a fix actually delegates <!-- cold -->. Publishing it here is what makes the delegation the protocol this skill declares, which is what that file's § *Write-mode routing* grants standing authorization against. **No new binding is added**: a skill that executes `fix-findings/SKILL.md` inherits its binding whole — unit, packet, edit surface, fallback, merge order — and `watch-pr-author` is not itself a registered write-mode consumer.

**CRITICAL**: the only thing this pass changes on disk is the working-tree code phase 2's `fix-findings` edits, which is that skill's own surface and nothing wider. No task-folder file anywhere is read or written, nothing is staged, nothing is committed, no Git state is mutated, and nothing is posted back to the pull request — a watcher reads and fixes; it does not answer, so replying to a thread, resolving it, and pushing all stay with you.

## When to Use

**Use when:**

- Reviewers have commented on a pull request you authored, and the points they raised should be verified and the confirmed ones landed as edits in one command
- The confirmed points should land as edits you can read in a `git diff`, rather than as answers on the pull request or as steps in a plan
- A reading is wanted now, over whatever the pull request currently carries — no floor, no history of prior passes, nothing to be stale

**Skip when:**

- You want the findings without the fixes → `/triage-findings-verify <pr-url>` batches and verifies them and stops there; that is this pass's phase 1 alone
- You want the pull request reviewed fresh rather than the reviewers' comments acted on → `/review-pr-triage-verify` reviews the diff and produces findings of its own; this pass produces none, acting only on what reviewers already wrote
- The confirmed points should be scheduled rather than fixed now → `/review-pr-triage-verify-reconcile` appends them to a plan; this pass edits code and appends no step
- Nothing names a pull request and the current branch carries no open one → Setup refuses; its one fetch, spent to learn that, is all the pass cost
- The directory you are invoking from is not a checkout of the pull request's repository — an explicit URL naming another one, or no checkout at all → Setup refuses, before anything is dispatched; the fixes land in *this* tree, so this tree has to be the pull request's

## Setup

Resolve both targets — the pull request and the repository it belongs to — before anything else, and refuse here rather than later.

**The pull request.** Resolve in this order; the first that answers wins:

1. an explicit argument — a number or a URL — which the fetch below takes as its target;
2. the current branch's open PR — the fetch below made with **no target**, which `gh` resolves to the branch's own PR — adopted **only when `state` is `OPEN`**. `gh pr view` returns the branch's PR whatever its state, so a merged or closed PR with no open successor would otherwise be adopted silently; treat anything but `OPEN` as no PR (the same guard `/review-pr` and `/publish-pr-review` apply);
3. neither answers → **refuse**: say the pull request has to be named, and stop.

**Inferring the branch's PR is deliberate here**, and the prohibition an earlier shape of this skill carried is lifted rather than forgotten: that prohibition existed to protect a write into a task folder, which this skill no longer makes. The write surface is now working-tree code alone, sitting in front of you in `git diff` before anything is staged, so a wrong branch costs a reading and a `git checkout .` rather than a wrong file recorded somewhere durable.

**The repository.** The invocation directory must sit inside a checkout of the pull request's repository — the main checkout or any linked worktree of it. Confirm it by comparing the `owner/repo` carried in the observation fetch's `url` against the one parsed out of `git remote get-url origin` — parsed, because `git@github.com:acme/kit.git` and `https://github.com/acme/kit.git` name one repository and a literal comparison would refuse the SSH form. A mismatch, or no checkout at all (`git rev-parse --git-dir` fails), → **refuse** with the reason. What is being guarded is rule 1: `gh pr view <url>` answers from any directory, so an explicit URL can name a repository this one has nothing to do with, while a bare number and the branch inference above are same-repo by construction. A wrong *branch* in the right repository stays the cheap accepted case argued for above; a wrong *repository* is not, because this pass **edits** the tree it runs in against that pull request's findings.

**One fetch for everything.** `gh pr view <target> --json state,number,url,headRefOid,updatedAt` — one call on either path: where rule 1 answered the explicit argument supplies `<target>`, and where rule 2 did there is no target at all, which `gh` resolves to the current branch's PR. It runs on **every** pass, the first included, which has nothing to compare `headRefOid` and `updatedAt` against but is what the next pass compares against once this pass reaches its Output. The `OPEN` gate below reads this call's `state`, and the repository comparison above and the quiet check further below both read this fetch; neither makes one of its own. Taking the fields together is what makes them one observation of the pull request rather than two that can disagree, and holding the branch path to that same single call is what makes a quiet `/loop` tick cost the one `gh` call the check below claims for it.

**Open pull requests only.** Whatever named it, `state` anything but `OPEN` → **refuse**, naming the state: this pass edits the working tree against the pull request's findings, and a merged or closed pull request is not a fix target — rule 2 already declines to adopt one, and an explicit argument does not make it one.

**`gh` is required.** Both the resolution above and the quiet check below run through it, and phase 1's own source resolution needs it too. Unavailable — missing, unauthenticated, or no GitHub remote — say so with the reason and stop; there is no by-hand substitute.

## The session-held quiet check

Where this session has **already run a pass of this skill over the same pull request**, compare the `headRefOid` and `updatedAt` Setup's fetch just returned against what this session's previous such pass observed.

- **Both unchanged** → report `no change since this session's last pass`, dispatch nothing, and end the pass there.
- **Either changed, or this session has no previous pass of this skill over this pull request** → go to phase 1.

Four properties fix what this check is:

- **It touches no disk.** The comparison lives in session memory only — nothing is written anywhere to hold it, and nothing is read from anywhere to restore it. It dies with the session and with `/clear`, which is the whole of its lifetime.
- **A first pass always dispatches.** The first pass in any session has nothing to compare against and dispatches on what it finds, so this check can never be what stops a reading from happening — it only declines to repeat a reading this same session already did. A `/watch-pr-review` pass over the same pull request is not one of those: the two skills hold their observations separately, so a reviewer-side pass never masks a reading here, nor the reverse.
- **Only a completed pass records.** What the next pass compares against is the observation of a pass that reached its Output; one that ended before it — a Setup refusal after the fetch, a `gh` failure inside phase 1's own source resolution — holds nothing, so the re-run its report invites compares against the last *completed* pass rather than the one that stopped, and dispatches. A completed pass that fixed nothing still records: it read the pull request as it stands, and a repeat against the same head would read the same.
- **`updatedAt` over-triggers rather than missing.** It moves for *any* activity on the pull request, so a label edit costs one redundant read; what it cannot do is stay still while a reviewer comments. The cheap failure is chosen over the invisible one.

**Under `/loop`**, this check is what makes a quiet tick cost one `gh` call instead of a full pipeline — except after a pass that stopped short of its Output, which records nothing, so the next tick attempts the pass again rather than masking the stop as a quiet tick.

## Phase 1 — Triage and verify

Execute `../triage-findings-verify/SKILL.md` end to end, with **the resolved pull request as its one argument** — the number or URL Setup resolved. Its § *Source* passes that argument straight to its phase 1, where an explicit number or URL puts triage in PR mode over the pull request's review threads, review summary bodies, and conversation comments.

**The argument is explicit because Setup's resolution has to survive the dispatch.** Given none, that skill's source resolution takes this session's review findings and then falls back to the open PR for the current branch — a second, independent resolution arriving one phase later, which an explicit argument in Setup may well have overridden. Naming the pull request is what keeps the pipeline on the one Setup resolved.

**The phase reads the pull request's whole open findings set.** Triage classifies every comment open / verify / addressed against current code, so a comment from any point in the pull request's history whose finding is still unaddressed is verified alongside the newest ones. The quiet check decides only *whether* a pass dispatches; it never narrows what the dispatched pipeline reads — and a finding triage lands outside **open** keeps its bucket into the display rather than being fixed.

**No Confirmed finding** — nothing open to verify, or every open finding came back Withdrawn, Inconclusive, or Unverified — makes phase 2 vacuous: skip it, and report the triage with nothing fixed.

## Phase 2 — Fix

Execute `../fix-findings/SKILL.md` end to end over **an explicit named subset: phase 1's Confirmed findings**, named by their `file:line`s — or by a short quote where a finding carries no anchor — which its § *Source* rule 1 takes as "those entries of the latest session findings".

**Naming the subset is mandatory; a bare call is wrong.** With no argument, that skill's rule 2 takes a verify composite's Confirmed **and Unverified** findings, and its § *The Gate: Auto vs Ask* routes every finding without a Confirmed verdict to the one batched ask. A bare call would therefore hand the fix phase more than the Confirmed set and stop the pass on a user-approval round it has no way to answer. The subset is what holds the fixes to verdicts a probe actually established.

**Unverified findings are reported, never fixed.** They land in that skill's `Untouched` bucket as findings the subset excluded, and the Output carries them into **Left behind**. Withdrawn and Inconclusive ones are never edited by that skill at all.

Everything else in that skill is its own and runs unchanged — the auto-vs-ask gate, the anchor check, the health boundary, and the Git discipline that stages and commits nothing. One consequence worth knowing before dispatching: the fixes land in the working tree the pass runs in, which Setup has confirmed is the pull request's repository but which can still sit on a branch or commit other than its head, so nothing here guarantees the two match; where they do not, that skill's anchor check buckets the findings `anchor moved` rather than editing code they do not describe.

## Output

Lists, never tables.

- **Pass** — the pull request the pass ran against and how it resolved (explicit argument, or the current branch's open PR), and the checkout the invocation sat in; or the refusal it stopped on (no pull request named, wrong repository, no `gh`), or `no change since this session's last pass` where the quiet check ended it.
- **Triage and verify** — `../triage-findings-verify/SKILL.md`'s Output as that skill specs it, printed at the phase-1 seam less the `**Next:**` the overrides drop, and naming the invocation this pass made; or `not dispatched — <reason>`.
- **Fixes** — `../fix-findings/SKILL.md`'s Output as that skill specs it, its buckets and their evidence intact, printed at the phase-2 seam less its `**Next:**`; or `not dispatched — <reason>` where phase 1 confirmed nothing or never ran.
- **Left behind** — what the pass did not finish, enough of each item to find it again: the Unverified findings the subset excluded, and `fix-findings`' `Untouched`, `Decided`, and `Fix failed` entries; or `nothing`.

**Next:** the fixes are in the working tree, unstaged and uncommitted, and the pass stops there. Stage them, `/review-commit` certifies them, `/commit` files them. **Until they are committed, `/review-pr-triage-verify` will refuse this pull request**: its Setup rejects a run where any reviewed path carries an uncommitted change, so the next verified review is blocked on that commit — a consequence for that pipeline and for `/review-commit`, not a claim about this skill, whose own next pass carries no such precondition and runs against a dirty tree unchanged. Replying to the threads, resolving them, and pushing stay with you. `/watch-pr-author` again any time for another reading.

## Verification

Confirm the protocol invariants before finishing:

- [ ] The pull request resolved in Setup on one fetch for everything — an explicit argument supplying its target, or no target and the current branch's PR — and the run refused there when neither answered, and refused any resolved pull request whose `state` was not `OPEN`, the explicit path included
- [ ] The invocation directory was confirmed to sit in a checkout of the pull request's repository, by comparing the parsed `owner/repo` of the observation fetch's `url` against `git remote get-url origin`'s — otherwise the pass refused, before anything was dispatched
- [ ] The quiet check compared `headRefOid` and `updatedAt` from Setup's one fetch — taken on every pass, the first included — against what this session's previous **completed** pass **of this skill** over the same pull request observed, held in session memory alone with nothing read from or written to disk; a pass that stopped before its Output recorded nothing, and a session with no previous such pass over this pull request dispatched on what it found
- [ ] Phase 1 ran `../triage-findings-verify/SKILL.md` with the resolved pull request as its explicit argument, never with none
- [ ] Phase 2 ran `../fix-findings/SKILL.md` over the named Confirmed subset only — no bare call, no Unverified finding fixed or sent to its ask batch by this pass, and no Withdrawn or Inconclusive one edited
- [ ] Nothing staged, nothing committed, no Git state mutated, and nothing posted back to the pull request; the pass stopped at a commit-ready tree
- [ ] No task-folder file was read or written — the working-tree code phase 2 edited is the whole of what this pass changed on disk
- [ ] Everything the pass did not fix went to **Left behind** — the Unverified findings the subset excluded and the fix phase's unfixed buckets among them
- [ ] **Next** named the `review-pr-triage-verify` consequence and printed `/review-commit`

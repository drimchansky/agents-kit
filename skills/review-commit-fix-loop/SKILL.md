---
name: review-commit-fix-loop
description: Use when asked to review the uncommitted change and fix what the review finds — stages the whole uncommitted change, then iterates the verified review pipeline (review-commit-triage-verify) with a fix phase (fix-findings) until a pass leaves no open Confirmed finding of any severity, a fix phase applies nothing, or 3 review passes have run. Edits working-tree code and stages it; never commits.
argument-hint: '[-x (cross-vendor second review, first pass only)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

The iterated composite for the pre-commit cycle: stage the whole uncommitted change, review it, fix what the review confirms, then stage and review again — until a pass leaves nothing open, a fix phase applies nothing, or three review passes have run. Each pass stages with `git add -A`, then executes `../review-commit-triage-verify/SKILL.md` **whole**; each fix phase executes `../fix-findings/SKILL.md` whole. Read each and run its full protocol — this file orchestrates them and re-implements neither.

**CRITICAL**: this composite writes **working-tree code and the index, and nothing else**. It commits nothing, creates no branch, and pushes nothing. The staging is deliberate: invoking this loop *is* the explicit permission `./references/engineering/rules.md` § *Code & Git discipline* requires, exactly as invoking `/commit` is the permission for the commit itself. Because the change is staged first, the review object is the ordinary staged diff every `review-commit` run reads — there is no second object to resolve.

Staging before every pass is what makes iteration possible at all. `fix-findings` never writes the index, so a loop that staged once would hand pass 2 the same index pass 1 read and report clean over exactly the code it just wrote. Re-staging first thing puts the previous pass's fixes into the next pass's review object by construction — **including a file a fix created and never staged**, which `git add -A` picks up as a wholly new path.

The cost is real and taken on purpose: a review pass **rewrites the user's index**. A deliberate partial staging does not survive it — `git add -A` stages the tree's version — and neither does a `git rm --cached`. Two paths the staged object does not carry:

- **`skip-worktree` / `assume-unchanged`.** An edit to a path carrying either mark is invisible to the review: `git add -A` will not stage it and exits 0 without a word, so the diff never shows it. This is not a cost of staging — the working-tree object this loop used before had the same blind spot, since the marks are a promise to Git that the file has not changed and every review object takes that promise at face value. `git update-index --no-skip-worktree <path>` (or `--no-assume-unchanged <path>`) clears the mark and brings the edit into the review.
- **A `git rm --cached` path whose content still matches HEAD.** `git add -A` re-adds the identical blob, so the index matches HEAD and the diff shows nothing. No content change is lost, because there is none to lose; what is lost is the fact that the user had unstaged that path — and staging does not merely hide that fact, it undoes it. The same path *with* a working-tree edit reviews normally, as a modification, so the omission is confined to the byte-identical case.

## Flags

- `-x` — forwarded to the **first** pass's review phase only. The uncorrelated cold review earns its cross-vendor cost on the original change; later passes certify fixes over mostly-identical content, and re-running it there spends a context budget that is already this pipeline's binding constraint. Its `Cross-check:` line is reported from pass 1. A default with that rationale, not an invariant — a user asking for `-x` on every pass gets it.

There is no flag for the review object: every pass reviews the index it just staged. `review-commit` has no `-p` — lens probes are `review-pr`'s — so `-x` is the only forwardable review flag.

## The Loop

Each pass, in order:

0. **Stage** — `git add -A`, before anything else in the pass. One rule covers pass 1 and every post-fix pass identically, and it is the loop's only index write. **Check its exit status**: `git add -A` can fail on a held `index.lock`, an unreadable path, or a failing hook, and it can fail having already updated part of the index — a non-zero exit is an error to report and stop on, never an empty or partial review object to certify. It runs *outside* the pass the inner composite guards: that composite captures its within-pass identity digest at review start, so a stage preceding it is never drift the check can see. The ordering is load-bearing beyond that — the composite's Setup requires the working tree to agree with the index on every staged path, and staging immediately before the review is what makes that true.
1. **Review** — execute `../review-commit-triage-verify/SKILL.md` end to end: its Setup, all three phases, and its own within-pass identity re-check. Hold its output per the **Chat display** override below. An empty review object here means step 0 found nothing to stage — a clean tree, but for the `skip-worktree` / `assume-unchanged` class above, whose edits `git add -A` skips in silence: say so and stop, rather than forwarding the inner skill's stop, which tells a user to run the `git add -A` this pass just ran.
2. **Success exit** — count this pass's **open Confirmed** findings, of **any severity**. Zero → exit the loop and render the Output. Minors are counted like anything else: a pass that leaves a Confirmed minor open has work left, and the cap is what bounds the cost of saying so. A finding the engineer decided on in an earlier pass's ask **never returns to a fix phase** — nothing iterates on a judgement the engineer already made. Carry a ledger of those decisions across passes, matching by `file:line`, or the anchorless scope, together with the defect named, since a fix shifts line numbers; a later pass reviews the whole tree and re-finds them, so nothing else closes them. `fix-findings` reports them in its **Decided** bucket as *skipped*, *deferred*, or *rejected*, and **all three are withheld from what step 4 hands it**, landing in that skill's **Untouched** bucket as findings this run excluded. They part only on the count here: **rejected** is closed and subtracted before counting, while *skipped* and *deferred* stay **counted open**, so a run carrying one exits at step 3 or step 5 and names it under **Survivors** rather than reporting success over a defect still in the tree. The same ledger is what makes the Output's one-entry-per-finding rule executable.
3. **Cap check** — if this was the **3rd** review pass, exit and render the Output with the survivors named. **The fix phase never runs after the final permitted pass**: a fix no pass reviews ships unreviewed, which is the whole property the loop exists to provide.
4. **Fix** — execute `../fix-findings/SKILL.md` on this pass's findings. Its no-argument source rule resolves to exactly this pass — the session's most recent verified review — and its gate is **unchanged**: a Confirmed finding whose options agree on one evident change with minimal blast radius applies automatically; everything else joins the one batched ask. Record each ask-routed finding per **Ask routing** below as the phase runs.
5. **No-progress exit** — if that fix phase applied **nothing** — every ask decided without a fix, every attempted fix failed and was reverted, or both — exit now and render the Output. Re-reviewing an unchanged tree reproduces the identical pass, so spending a review pass on it buys nothing.
6. Otherwise, next pass — back to 0.

**At each of the three exits above the index still holds exactly what the last pass reviewed.** No member of the pipeline writes the index but step 0: `fix-findings` never does (`../fix-findings/SKILL.md`), and every probe the review phase fans out is read-only by contract (`./references/workflow/agent-fanout.md` § *Probe contract*) — so step 0 is the run's only index write, and the last one always precedes the last review pass. That argument holds at all three — including the no-progress exit, where a fix phase *does* run after the final review pass and merely applies nothing. It is why the Output hands to `/commit`.

**A hard fail mid-pipeline is not one of those exits and hands off nothing.** Its own trigger may be that the index moved (the inner composite stops when the recomputed staged digest no longer matches its Reviewed line), and phase 1 has already printed that line — so the held sections the **Chat display** override prints are a record of the dead pass, not a handoff. `/commit` would refuse them on the digest comparison, which is the backstop rather than the intent: don't offer them as a commit.

## Ask routing

Every finding the fix phase routes to the ask is recorded with two facts, taken from `verify-issue`'s fix options as the verify phase emitted them:

- its **blast radius** — the option's own stated radius, verbatim, not a re-derivation;
- whether the options **agreed** on one evident change, or offered a genuine choice.

An ask-routed finding carrying **no** fix options — Unverified, out of probe scope, or a probe that failed — records `no options — unverified` for both, so the counts distinguish *options disagreed* from *no options existed*. This record is the point of instrumenting the loop: it is the evidence for whether a middle autonomy tier would route a real share of findings away from the ask, and it is read off real runs rather than argued in advance.

## Overrides

Three pipeline-wide overrides, the seams every composite owns:

- **Core Rules blocks** — this composite's block covers the pipeline; inner skills' AGENTS.md reads don't repeat. This includes the inner composite's own copy of these overrides — they nest.
- **Chat display** — one progress line per pass as it completes: `pass N: <x> confirmed · <y> fixed · <z> asked · <w> decided` — `decided` counting every ask that produced no fix, all three of `fix-findings`' kinds. **The four fields do not close, and no arithmetic relates them.** `confirmed` is step 2's count verbatim — this pass's open Confirmed findings — while `fixed` and `decided` count that pass's `fix-findings` buckets and `asked` counts the findings its gate routed to the batched ask — which span both of those buckets — all three over everything the fix phase received, Confirmed **and** Unverified findings alike. Findings the phase left in **Fix failed**, and earlier-pass *skipped* / *deferred* ones that stay counted open at step 2 without returning to a fix phase, are named in the Output rather than in this line. On a pass that exits at step 2 or step 3 no fix phase ran, so those three fields read `—` rather than `0` — the line is printed live, before the Output names the exit, and `0 fixed · 0 asked · 0 decided` would render a cap exit identically to a no-progress one. Everything else — findings, verdicts, batches, fix detail — is held for the final Output. If a pass fails hard mid-pipeline, print its held sections before stopping — no pass's review is lost to a dead loop — and say that the index is staged, on the same terms **Next** states it: `git reset` unstages it without touching content, so no work the user wrote is at risk, though it restores the index to HEAD rather than to the state it had before the run.
- **Next pointers** — inner skills' follow-up suggestions are dropped; this composite's Output owns **Next**.

Past these, each phase runs its skill file as written — no improvisation, and no override of the fix gate.

## Output

Lists, never tables. Rendered once, when the loop exits.

- **Passes** — the progress lines, one per pass, and which exit ended the run: success, no-progress, or cap.
- **Findings** — every finding from every pass **exactly once**, under one final disposition: **Fixed** (which pass, what changed, `file:line`), **Decided** (the engineer *rejected* it in the ask — closed, not outstanding), **Fix failed** (reverted, why), **Withdrawn** (the probe's evidence), **Survivors** (Confirmed findings still open at the exit, plus Inconclusive and Unverified ones, each with severity and location — and, where the engineer *skipped* or *deferred* one, that decision beside it, since it stays open but never returns to a fix phase). A finding fixed in one pass and re-confirmed in a later one is **one** entry telling that story, not two.
- **Ask routing** — one line per ask-routed finding: its blast radius and whether its options agreed, per **Ask routing** above.
- **Verified** — each pass's **Verified** line, exactly as `review-commit-triage-verify` specs it. It is that skill's mandatory line and the verify shape's outcome line under `./references/workflow/agent-fanout.md` § *Merge contract*, so it is forwarded rather than dropped: without it a run whose probes all failed and verified inline reads identically to one with cold eyes on every batch.
- **Cross-check** (only with `-x`) — pass 1's line, as the review phase specs it.
- **Reviewed** — the **last** pass's provenance line verbatim, in the `Reviewed <digest> (<n> files) by <model> <effort>` form the inner pipeline emits. Earlier passes' digests are superseded. The digest is `git diff --cached | git hash-object --stdin` over the index step 0 staged, which is precisely what `/commit` compares against.
- **Commit message** — the last pass's drafted message, describing the set the **Reviewed** digest covers.

**Next:** once the surviving findings are addressed — Withdrawn ones don't block — run `/commit`, with no re-review in between: the last pass reviewed the index it staged, so its **Reviewed** digest *is* the staged-set digest that skill compares against. A success exit leaves nothing to address and hands over as it stands; a cap or no-progress exit does not, and its **Survivors** are the reason it ended — committing over them is what the exit exists to prevent. Address them with `/fix-findings` for another targeted round, or by hand; either way the fix lands unstaged and unreviewed, so run the loop again rather than committing over it.

Whichever exit ended the run, say that the index now holds everything `git add -A` staged — including any unrelated work in progress the passes reviewed alongside the change. `git reset` unstages it without touching content, though it restores the index to HEAD rather than to the state it had before the run (see the cost noted above).

## Don't Rationalize

- "Pass 2 only needs to look at the files I fixed" — Whole-set certification is the loop's entire value; nothing in the review phase scopes a pass to the delta, and narrowing it by hand certifies nothing about the set.
- "One more pass past the cap will surely come back clean" — The cap is the contract. Oscillating fixes are a signal a human should look, not a reason to iterate harder.
- "The final pass's findings are trivial, I'll fix them on the way out" — A fix no pass reviews ships unreviewed. Report them as survivors.
- "Nothing was applied, but the next pass might find something new" — It won't: the tree is unchanged, so the pass is the one that just ran. The no-progress exit is the answer, not a shortcut past one.
- "The ask is blocking the loop, I'll pick for the user" — The gate routed those findings *because* they need the user. A stalled loop is the designed behavior, not a failure.
- "The fix phase may as well stage what it fixed — the loop stages anyway" — It may not. `fix-findings` never writes the index, and step 0 is the loop's write, not the phase's. That seam is what makes the exit invariant provable, and it is what keeps `fix-findings` identical inside this loop and outside it.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Every pass ran the inner composite from its skill file, and every fix ran through `fix-findings` — neither improvised from memory, and the fix gate unmodified
- [ ] Step 0's `git add -A` ran **immediately before** every pass's review phase — that ordering, not merely the staging, is what the inner Setup depends on
- [ ] The success and cap checks ran **before** each fix phase; no fix phase ran after the third review pass
- [ ] The no-progress exit fired whenever a fix phase applied nothing, rather than spending another review pass on an unchanged tree
- [ ] At most 3 review passes; survivors reported rather than fixed past the cap
- [ ] Final Output carries every finding from every pass exactly once with one disposition, an **Ask routing** line per ask-routed finding (`no options — unverified` where none existed), each pass's **Verified** line, the last pass's `Reviewed` line, and its commit message
- [ ] Nothing committed, no branch, no push — no `git add` but step 0's, once per pass (transient coordinator-managed batch worktrees excepted, as `../fix-findings/SKILL.md` excepts them — created scratch, removed after merge)

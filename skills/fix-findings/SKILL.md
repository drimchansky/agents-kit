---
name: fix-findings
description: Use when asked to fix, apply, or address a set of findings — from a review in this session, a PR's review comments, or a pasted or saved list. Applies the fixes (a Confirmed finding automatically when the targeted fix is clear and low-blast-radius; anything unverified only through one batched ask showing the change as a diff) and reports the rest untouched. Edits code only; never stages, never commits, never writes back to the findings' source.
argument-hint: '[source: PR number/URL, file path, pasted findings, or a named subset — defaults to the latest session findings]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

The write-mode follow-up to every code-review skill and source that produces findings: take a findings set from anywhere, apply the fixes, and report the rest untouched. From a verify composite, each **Confirmed** finding arrives with `verify-issue`'s root cause and fix options (ordered targeted → thorough, each with blast radius) — this skill consumes that judgment; it doesn't re-litigate it. Everything else — a plain review's findings, a PR's review comments, a saved or pasted list — carries less, often just a location and a complaint, and the gate routes it accordingly.

**CRITICAL**: Nothing is fixed on this skill's own judgment alone. A fix needs one of exactly two authorities — a **Confirmed** verdict, or the user's approval in the ask batch. **Withdrawn and Inconclusive findings are never edited**: a probe looked and either found no issue or couldn't establish a root cause, and that evidence outranks any later impulse to fix anyway. Findings nobody verified — a plain review's, an external list's, or one a verify phase marked **Unverified** — carry no such evidence either way, so they take the ask and never the auto path.

The write surface is **working-tree code and nothing else**: never stages, never commits, never otherwise mutates Git state — staging the fixes is the user's call, per the Git-discipline rule. Reading findings from a PR adds nothing to that surface: they are fixed locally, never answered with a reply, a resolved thread, or a push. `triage-findings` owns the read side of a PR's findings and never writes back to it either; nothing here changes that.

## Source

**Any findings set works.** Resolve it in this order, mirroring `../triage-findings/SKILL.md`'s Sources:

1. **Explicit argument wins.** A PR number or URL → PR mode. An existing file path → parse that file. Pasted text, or a pointer like "the review above" → those findings. A named subset ("the two majors", specific `file:line`s) → those entries of the latest session findings.
2. **No argument:** the most recent findings in this session, with everything fixable selected —
   - a **verify composite** (`review-commit-triage-verify`, `review-pr-triage-verify`, `triage-findings-verify`) → its Confirmed and Unverified findings;
   - a **plain review** (`review-commit`, `review-pr`, `audit`) or a **`triage-findings` batch** → all of it, none of which carries a verdict.
3. **Nothing to work from** → say so, name the forms above, and stop. Unlike `triage-findings`, this skill does **not** fall back to the current branch's open PR: that skill reads, this one edits, and fetching a remote findings list to start editing against is not something to infer from an empty argument.

**Code findings only.** Whatever the route in — a `triage-findings` batch, a file, a paste — a documentation findings set is out of scope: this skill's health verify is the engineering recipe, which proves nothing about prose. A `/review-docs` set belongs back with a doc review.

**Never produce the findings yourself** — no reviewing the diff, no scanning for problems to fix. That the judgment came from somewhere else is this skill's whole safety property, and a set you authored in the same breath as the fix is not a findings set. A verified review stays the best input, because verdicts are what let a fix apply without a question; the other sources are accepted because refusing them forced a full verify pipeline over changes whose fix was already evident, and the ask batch is what keeps that safe.

**PR mode** fetches per `../triage-findings/SKILL.md`'s Fetch section — its three comment sources and the paginated GraphQL thread query, unchanged. A thread already resolved there is **addressed**: report it Untouched, never re-fix it.

Take each finding as its source left it — severity if it has one, `file:line` if it has one, and whatever else it carries: root cause and fix options from a verify composite, a recommendation from a review, free prose from a PR comment. Don't re-rank a severity and don't assign a verdict the source didn't give. Findings triage landed outside **open** (addressed / verify buckets) are already handled — report them under Untouched with their bucket.

**Check the anchor before fixing an external finding.** A finding from a PR, a file, or a paste can predate the current code. If its `file:line` no longer holds what it describes, or its quoted snippet no longer matches, it lands in Untouched as `anchor moved` — the issue may already be fixed, and editing there invents a problem to solve. If it is too vague to yield one specific change, it lands in Untouched as `not actionable` rather than going to the ask: approving a fix is the user's job, designing one from an unclear complaint is not.

## The Gate: Auto vs Ask

Work in severity order (critical → major → minor), or in source order where the findings carry no severity. Two rules come before the gate itself:

**A finding without a Confirmed verdict always routes to the ask batch.** That is everything except a verify composite's Confirmed entries — a plain review's findings, Unverified ones, and every external set. No probe established a root cause, so there is no verified judgment for an auto-apply to stand on; the user's approval is what supplies it.

**Show the change, not the claim.** Each ask entry carries the finding, the fix as a concrete diff of what you would write, and your recommendation. A prose description invites approval of the *claim* — and the claim is the unverified part. A diff is approved as an edit, which is the decision actually being made.

For a **Confirmed** finding, decide from its fix options:

- **Apply the targeted option without asking** when it is unambiguous — the options agree on one evident change, no genuine design choice among them — and its blast radius is minimal: confined to the files the review covered, no public API or behavior contract change beyond what the finding names, no new dependency. Default to auto here because at that size the fix is cheaper to apply than to discuss, and the review already did the judging.
- **Route to the ask batch** otherwise — genuinely different options with trade-offs, a thorough option worth weighing against the targeted one, intent the code can't settle, blast radius reaching beyond the reviewed files. A wrong guess there costs more than the question.

**One batched ask per run.** Collect every ask-routed finding and present them together in a single interaction — each with the finding, its diff or options, and your recommendation — not one interruption per finding. Apply the decisions, then continue. A set where most findings route to the ask makes for a long single interaction; that is the correct shape, and splitting it into a per-finding drip is not an improvement.

## Applying Fixes

Run each fix through the loop in `./references/workflow/execution-loop.md` — read it before the first fix. This skill's bindings:

- **Source** — one finding with its chosen fix: a Confirmed finding's fix option, or the fix the user approved in the ask. The verify criterion is **the problem the finding names no longer reproduces**, re-checked against the finding's own evidence — a Confirmed finding's root cause and reproduction path, or, for an unverified one, the specific thing the finding called wrong.
- **Record** — the chat report below; this skill writes no task-folder file and no status.
- **Blocked** — a fix that can't pass its gates this session is **reverted in full** (restore the pre-fix state), reported as `fix failed (reverted): <reason>`, and the run continues with the next finding. This is a deliberate departure from strict Stop-the-Line — findings are independent units, and one stubborn fix shouldn't strand the rest — but the tree-health half of the rule holds absolutely: never continue with a failing fix left in the tree.
- **Acceptance** — every selected finding lands in exactly one report bucket, each bucket entry re-read against the live tree before reporting.
- **Integration gates** — none within the run beyond per-fix health verify: the certifying re-review of the whole set belongs to the re-run **Next** points at.

Both verify gates apply per fix: step verify (the criterion above) and health verify (typecheck, linter, tests on the changed area — `./references/engineering/verification.md`). A fix is reported Fixed only with both green.

## Output

Lists, never tables. Omit empty buckets.

- **Fixed** — every applied fix, per finding: the original text with severity, what changed (`file:line`), and how the problem's absence was verified. Mark an entry that had no Confirmed verdict as fixed on the user's approval, so the report never lends a verified finding's authority to one that had none.
- **Decided** — ask-routed findings that produced no fix: the user's decision and why nothing was applied — skipped, deferred, or the finding rejected. An ask-routed fix that was applied belongs in **Fixed**, not here.
- **Fix failed** — reverted fixes with the reason and what would unblock them.
- **Untouched** — Withdrawn and Inconclusive findings with their verdict as the reason, findings triage landed outside **open** with their bucket, external findings dropped as `anchor moved` or `not actionable`, and any finding the user's subset excluded.

**Next:** the fixes are unreviewed and unstaged — certify them with a review of the changed code. For a staged-diff flow that means staging the fixes first, then `/review-commit` (or `/review-commit-triage-verify`), then `/commit`. Findings that came from a PR or a saved list are answered in the working tree only: replying to the source, resolving its threads, and pushing all stay with you.

## Don't Rationalize

- "The probe confirmed it, so the fix must be right" — The probe confirmed the *problem*. The fix's verify is the root cause no longer reproducing, checked fresh.
- "This Inconclusive one looks easy, I'll fix it while I'm here" — A probe investigated and couldn't establish the root cause; that verdict is the contract, and "looks easy" is not new evidence. Ask for another verify pass instead.
- "The user will obviously pick the targeted option, I'll skip the ask" — The gate routed it because judgment was needed. Obvious-to-you is the thing being checked.
- "I wrote this finding myself an hour ago and I'm sure of it — the ask is a formality" — Confidence in your own unverified finding is the least reliable input available, and it is precisely what the ask exists to check. Sureness is not a verdict.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Findings sourced per **Source** — a session run, a PR, a file, or a paste; none produced by this run, none re-verdicted
- [ ] No Withdrawn or Inconclusive finding edited; every fix lacking a Confirmed verdict approved by the user against a shown diff
- [ ] Every ask-routed finding decided in one batched interaction
- [ ] External findings anchor-checked before fixing; nothing written back to a PR or findings file
- [ ] Every applied fix passed both verify gates; every failed fix reverted in full and reported
- [ ] Every selected finding in exactly one output bucket
- [ ] Nothing staged, nothing committed, no Git state mutated

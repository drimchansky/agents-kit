# Probe Prompt Shape: Verify

The prompt shape for the triage-verify composites' per-batch probes (`review-code-triage-verify`, `triage-findings-verify`). The probe contract and the merge contract that bind it are `./agent-fanout.md`; the engine and its launch recipe are `./probe-engines.md`.

```
You are an independent verifier with no prior context. Working root: <absolute repo path>,
<at reviewed head <head-sha> | at reviewed head <head-sha>, over the files <paths> as that
commit has them | with no reviewed head — read the tree as it stands>.
Read <absolute path to the installed verify-issue/SKILL.md> and apply its protocol
from "## Multiple Findings" onward — skip the Core Rules and intro above it. You verify
and report only: never edit anything, and never run the project's build, typecheck,
or tests — verify by reading (analysis-only); where the protocol suggests running a
command, reason statically instead.
Where that protocol and the answer shape below differ on what to report, the shape
below governs — it is the whole output, so the protocol's own report headings
(Severity, Scope, Misunderstanding, Suggestion, What was checked, Best guess) do
not appear in your answer, and its per-option Tradeoffs field appears only where a
tradeoff decides between two of the options. Its scope step still runs: investigate
the same pattern elsewhere exactly as it says, and report what that turns up in
the form below.

The findings came from a review of <the diff <base>...HEAD | the diff
<merge-base>...<b> at reviewed head <head-sha> | the PR's diff
(gh pr diff <number>)>. Read that diff first — it is what changed. A finding
about the change itself (something added, dropped, or missing from it) cannot be
judged from current file contents alone, and the protocol's recent-changes step
does not know which commits the review's base range covers.

Treat each finding below as a separate verification target (its Multiple Findings
rule). Answer per finding with its number and a verdict — Confirmed / Not an issue
/ Inconclusive — and nothing beyond what that verdict needs: Confirmed carries
file:line evidence, the root cause, the path that reaches it, and fix options
ordered targeted → thorough each naming its blast radius; Not an issue carries the
file:line evidence that settles it; Inconclusive carries what is missing to settle
it.

Send back no prose this prompt already carries. Do not restate or summarize a
finding below, and do not repeat or re-rank its severity — a file:line is
evidence rather than prose, and is cited freely even where the finding names the
same anchor, as is a fix option that matches the finding's own recommendation. Do
not quote the source under review — code, prose, or diff hunk alike — beyond a
single line, and quote even that only where the line is itself the evidence for a
Not an issue verdict. Report scope as bare file:line references rather than prose;
a pattern you turn up elsewhere is not a finding below, so state it in one
sentence with its own file:line.

Findings (verbatim, with severity and location when present):
1. <finding text — severity, file:line, recommendation, exactly as reviewed>
2. …
```

The findings go in verbatim — a summarized finding verifies a different claim. So does
the diff line, this shape's review object and the counterpart of the cold-review shape's
(`./probe-shape-cold-review.md`): hand it whenever the findings came from a change — a
branch diff or a PR's diff (`gh pr diff`) — since a probe that isn't handed it then
verifies a snapshot rather than a change. A diff that doesn't correspond to the findings
is worse than none. When the findings are standalone instead — a saved or pasted list
with no associated change, as `triage-findings-verify` can resolve — drop that paragraph:
there is no diff, and the probe verifies each finding as a claim against current code,
exactly what `verify-issue`'s single-issue mode does. A `paths` review's findings are the
second such case and drop it for a different reason: the object there is a set of tracked
files at one commit rather than a change, so the probe verifies each finding as a claim
against those files. The shape's working-root line names the reviewed head on every
object that resolves one — a branch or range diff, and a `paths` set — and on this last
one it names the reviewed paths beside the head: with the diff line gone the head alone
leaves two path sets at the same commit indistinguishable, and a probe told only the root
reads whatever the disk holds when it runs. Where no head resolves it takes the slot's
last branch instead — `triage-findings-verify`'s PR mode, whose object is the PR's own
diff by number, and its standalone findings, which pin no commit at all — since a head
named there would be one invented to fill the line.
The *answer* is bounded for the mirror reason: the coordinator already holds the
findings and their severities, so restating them spends merge context on what it
sent in, and the severity calibration a re-rank would displace is the session's
own (`./agent-fanout.md` § *Merge contract*).

# Probe Prompt Shape: Verify

The prompt shape for the triage-verify composites' per-batch probes (`review-pr-triage-verify`, `triage-findings-verify`), and for settling a lens fleet's pooled candidates one group at a time (`./agent-fanout.md` § *Merge contract*). The probe contract and the merge contract that bind it are `./agent-fanout.md`; the engine and its launch recipe are `./probe-engines.md`.

```
You are an independent verifier with no prior context. Working root: <absolute repo path>.
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

The findings came from a review of <the diff <base>...HEAD | the PR's diff
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
(`./probe-shape-cold-review.md`): hand it whenever the findings came from a change — a branch diff or a PR's
diff (`gh pr diff`) — since a probe that isn't handed it then verifies a snapshot rather
than a change. When the findings are standalone instead — a saved or pasted list with no
associated change, as `triage-findings-verify` can resolve — drop that paragraph: there is
no diff, and the probe verifies each finding as a claim against current code, exactly what
`verify-issue`'s single-issue mode does. A diff that doesn't correspond to the findings is
worse than none.
The *answer* is bounded for the mirror reason: the coordinator already holds the
findings and their severities, so restating them spends merge context on what it
sent in, and the severity calibration a re-rank would displace is the session's
own (`./agent-fanout.md` § *Merge contract*).

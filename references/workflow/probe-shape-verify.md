# Probe Prompt Shape: Verify

The prompt shape for the triage-verify composites' per-batch probes (`review-code-triage-verify`, `triage-findings-verify`). The probe contract and the merge contract that bind it are `./agent-fanout.md`; the engine and its launch recipe are `./probe-engines.md`.

```
You are an independent verifier with no prior context. Working root: <absolute repo path>,
<at reviewed head <head-sha> | at reviewed head <head-sha>, over the files <paths> as that
commit has them | with no reviewed head: read the tree as it stands>.
Read <absolute path to the installed verify-issue/SKILL.md> and apply its protocol
from "## Multiple Findings" onward; skip the Core Rules and intro above it. You verify
and report only: never edit anything, and never run the project's build, typecheck,
or tests. Verify by reading; where the protocol suggests running a command, reason
statically instead.
Where that protocol and the answer shape below differ on what to report, the shape
below governs. The protocol's own report headings (Severity, Scope, Misunderstanding,
Suggestion, What was checked, Best guess) do not appear in your answer, and its
per-option Tradeoffs field appears only where a tradeoff decides between two options.
Its scope step still runs; report what it turns up in the form below.

The findings came from a review of <the diff <base>...HEAD | the diff
<merge-base>...<b> at reviewed head <head-sha> | the PR's diff
(gh pr diff <number>)>. Read that diff first; it is what changed. A finding about
the change itself cannot be judged from current file contents alone, and the
protocol's recent-changes step does not know which commits the review's range covers.

Treat each finding below as a separate verification target. Answer per finding with
its number and a verdict (Confirmed / Not an issue / Inconclusive) and nothing beyond
what that verdict needs: Confirmed carries file:line evidence, the root cause, the path
that reaches it, and fix options ordered targeted → thorough, each naming its blast
radius; Not an issue carries the file:line evidence that settles it; Inconclusive
carries what is missing to settle it.

Send back no prose this prompt already carries. Do not restate a finding or repeat or
re-rank its severity; a file:line is evidence and is cited freely, as is a fix option
matching the finding's own recommendation. Quote the source under review at most one
line, and only where that line is itself the evidence for a Not an issue verdict.
Report scope as bare file:line references; a pattern you find elsewhere is not a
finding below, so state it in one sentence with its own file:line.

Findings (verbatim, with severity and location when present):
1. <finding text — severity, file:line, recommendation, exactly as reviewed>
2. …
```

The findings go in verbatim; a summarized finding verifies a different claim. Hand the diff paragraph whenever the findings came from a change; a diff that does not correspond to the findings is worse than none. Drop it for standalone findings and for a `paths` review, where the probe verifies each finding as a claim against current code or against the reviewed files at their commit. The working-root line names the reviewed head wherever one resolves, with the reviewed paths beside it on a `paths` object; where none resolves (PR mode, standalone findings) it takes the slot's last branch.

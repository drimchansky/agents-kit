# Agent Fan-Out: Maintainer Notes

> **Non-normative.** These are maintainer notes, **not loaded at run time**. The runtime contract — `./agent-fanout.md` — is the sole source of truth for behavior. Where behavior and these notes disagree, the contract wins. Notes cite rules; they never restate them.

Each entry names the contract section it annotates and records the reasoning behind that section's rule, so a future edit can tell a deliberate trade-off from an accident.

## Why a probe's isolation is the point

`./agent-fanout.md` § *What a probe is*. That isolation is a feature, not a limitation; it's what makes a probe worth consulting where the session's own read might be biased (grounding a plan it helped write, reviewing a diff whose intent it has already internalized).

## Why candidates pool by location before any of them is settled

`./agent-fanout.md` § *Merge contract*, the pooling bullet. In the measured head-to-head of 2026-08-08 a fleet reported one branch of a two-branch defect and left the sibling unreported: each probe stopped where its own concern led it, and nothing downstream looked at the spot as a whole. Grouping by location is what brings the corroborating and contradicting reads on one spot together before any verdict is taken, and the session's own walk of the surrounding branches is what reaches the half no probe was pointed at.

## Why a fleet's candidates settle cold, and why a reproduction outranks a verifier

`./agent-fanout.md` § *Merge contract*, the novel-findings bullet. The same 2026-08-08 head-to-head failed in both directions. Settling the fleet's candidates on one adoption pass under-verified them — that pass was correlated with the review the fleet had been launched to decorrelate, so it re-read the diff with the assumptions the fleet existed to break. Its `/code-review` counterpart failed the other way: 51 verifiers refuted a finding that in fact reproduced, which is what makes verifier count a poor tiebreaker and puts the reproduction ahead of any number of reads that disagree with it.

# Batched Finding Fixes

How `fix-findings` pays the verification tiers across a batch rather than per finding, split out of
`./verification.md` § *Two verification tiers*. Read it at a `fix-findings` health boundary, and above
all when that boundary is red.

## Batched finding fixes

`fix-findings` applies the unit-outcome tier immediately but pays its boundary's recipe once
for the retained collection at its declared health boundary; it never starts with a health run or
runs the recipe once per finding. A red boundary reruns only its failed command or commands, never a
second full boundary merely to compare, and a rebuilt candidate earns one fresh boundary. What that
comparison establishes, what it implicates, and what it restores is that skill's own procedure —
`skills/fix-findings/SKILL.md` § *Integrated health boundary* owns it.

Both isolations obey the green-control rule in `../workflow/execution-recovery.md` § *Evidence
lifecycle*. A failed health command qualifies once it is green at the baseline, which is
why the comparison above runs first. A finding's own outcome tier never qualifies against the
bare baseline — the baseline predates that finding's fix, so the tier is red there by
construction — so isolate it from the baseline plus that finding's own change set, never from the
baseline alone. The tier is also what the replay tests: it is the whole tier that failed, and
narrowing the predicate back to the criterion hides a failure in the per-unit checks.

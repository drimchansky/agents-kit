# Execution Loop: Maintainer Notes

> **Non-normative.** These are maintainer notes, **not loaded at run time**. The runtime contract — `./execution-loop.md` — is the sole source of truth for behavior. Where behavior and these notes disagree, the contract wins. Notes cite rules; they never restate them.

Each entry names the contract section it annotates and records the reasoning behind that section's rule, so a future edit can tell a deliberate trade-off from an accident.

## Why ground truth comes before the work

`./execution-loop.md` § *Ground truth before work*, the opening paragraph. This is where the actual work product gets made, so working from stale or invented facts is the biggest failure mode.

## What a passing boundary actually proves

`./execution-loop.md` § *Two verification tiers*, the closing paragraph on invalidated evidence. A successful boundary proves only the exact shared-tree state it ran against; a later change means the run is health-pending until the recipe passes again.

## What each tier covers

`./execution-loop.md` § *Health boundaries*, the opening paragraph. Unit outcomes prove slices; integrated health proves the accumulated shared tree.

## Why reuse across runs needs a work-product identity

`./execution-loop.md` § *Health boundaries*, the cross-run reuse paragraph. A descriptive health result without that identity proves only that an earlier run passed.

## Why a divergence gets surfaced instead of absorbed

`./execution-loop.md` § *Don't Rationalize*, the "what I'm building turns out to be wrong" entry. Silent deviation makes the record useless and takes the call away from the user.

## Why confidence about an API is not evidence

`./execution-loop.md` § *Don't Rationalize*, the "I'm confident about this API" entry. Training data ages out; framework APIs deprecate.

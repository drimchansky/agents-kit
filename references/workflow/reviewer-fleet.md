# Multiple reviewer passes

Load only when `review-code -n N` requests more than one reviewer. These rules replace single-return handling; the host's Setup, Review Focus, safety-block output, capture, and settlement otherwise apply.

## Launch

With `-n N`, send the N packets in one message, on the primitive `./delegated-waiting.md` § *Per-host primitives* names for this host. They differ on the verification-scripts instruction alone.

## Intake and verification

Under `-n N`, run the same classification and checks per return, and drop each unavailable reviewer instead of ending a pass that still has a usable return. Record each on `Review pass:` as `reviewer <i> dropped (<reason>)`: `identity mismatch`, `malformed return`, `no return`, `reviewer failed: <error>`, or `safety blocked: <error>`, preserving only the available error code and message. Settle on the standing returns and render their coverage as `completed <completed>/<requested>`. Only once none stands does the pass take a terminal path: any `identity mismatch` among the drops stops the review; otherwise any `safety blocked` drop takes the **Blocked output**; only ordinary failures fall to the inline fallback with reason `reviewer failed`.

Losing reviewer 1 costs the review its verification scripts: run them in-session before Output and record `scripts: session (reviewer 1 <reason>)`, unless the caller substitutes its own evidence, in which case run nothing and keep its `scripts:` rendering. If reviewer 1 was safety blocked, do not repeat the denied operation; run only checks the signal shows are independent and already authorized, recording `scripts: session independent checks only (reviewer 1 safety blocked: <error>)`, or `scripts: unavailable (reviewer 1 safety blocked: <error>)` where the signal does not distinguish the denied operation.

## Pooling

With `-n N` above 1, the standing returns' findings pool by location before anything is adopted, per `./agent-fanout.md` § *Merge contract*. Mark each pooled entry `cited by k/N`, `k` the number of returns making that entry's claim and `N` the requested count; an `-x` probe's agreement belongs to the `Cross-check:` line. Adoption and the Critical and Major spot-check run once per pooled group; `Summary` is the session's read across the standing returns, their `Improvements` merged. `Change map` is reviewer 1's, or the lowest-numbered standing return's where reviewer 1 was dropped; `Divergence` and `Inaccessible context` are the union across the standing returns, plus Setup's index-versus-head record on a `paths` object.

## Review pass output

With `-n N` above 1: `delegated (<model> ×<completed>; completed <completed>/<requested>)`, every dropped return named as `reviewer <i> dropped (<reason>)`, and the script run named: `scripts: reviewer 1`, `scripts: session (reviewer 1 <reason>)`, or the safety-blocked form above. A denied check is named on this line at every N as `scripts: <check> denied: <error>`, on the fleet form's `scripts: reviewer 1`.

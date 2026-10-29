# Write-Mode Posture: Delegation Is the Standing Posture

The one posture for the write-mode consumers registered in `./executor-routing.md` § *The registry and its authorization*. No consumer states a posture, a packet-cost prior, or a cadence of its own.

**Every unit delegates** under `./executor-contract.md`'s packet and gates, regardless of size or position. Launch one unit unless `./executor-contract.md` § *Segment launches* and the consumer's binding authorize a segment. A `fix-findings` unit includes Auto and approved Ask fixes (`fix-findings` § *Execution strategy: every fix delegates*). Only the exceptions below permit inline work.

Before launch, complete every `./executor-contract.md` § *Launch packet* item. Packet cost permits no inline exception. Close gaps by reading, searching, or asking; only execution-dependent gaps qualify for exception 1.

## The exceptions

Three, and only these. Each applies to one unit, not the run; the next unit delegates again unless its own facts reach one of the three. Only exception 2 can hold for a whole run, and only while its condition does.

1. **The unit cannot be specified before it runs.** Its shape is discovered by doing it: the next action depends on the last one's output, or mid-unit user interaction is expected. A unit that is merely small, large, or unfamiliar is specifiable and delegates.
2. **Delegation is unavailable in the environment.** The selected engine's adapter, CLI, model, or launch support is unavailable, or a live sandbox, permission setting, or standing session instruction forbids it. Report what blocked it; never weaken or bypass a live security or permission boundary to delegate. Apply selection and fallback under `./executor-routing.md`. A session instruction permitting agents only when the user asks blocks a model-invoked run and a confirmed proposal that left delegation unnamed, not a run invoked by command or by a proposal that named it (`./skill-conventions.md` § *The invocation gate*).
3. **The executor failed.** Unavailable, hung, host-failed, surface-escaping, or conflicting at merge. The consumer's **Fallback** in `./executor-contract.md` § *Bindings* takes the unit from there.

Every inline unit is **announced in chat as it happens and recorded in the consumer's report**, naming which exception applied. The record's shape is each consumer's own.

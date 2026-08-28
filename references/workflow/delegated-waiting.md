# Delegated Waiting

How an agent waits for asynchronous work it launched and has not yet collected — delegated agents the primary case, and backgrounded shell commands wherever the host below names a surface for them. **This file is the single home for the wait mechanism**: the primitive a wait runs on, what does not count as one, and the cadence an outstanding launch is reported at. Every contract that mandates a wait cites this file rather than restating it.

What stays with those contracts: whether a stalled probe may be dropped is `./agent-fanout.md` § *Probe contract (every engine)*'s call, and a hung or unavailable **batch** executor's routing to the serial fallback is `./parallel-batch.md` § *Coordinator-side parallel batch*'s. This file says how to wait, never what a wait's outcome means.

## How to wait

**Wait on the harness's own completion signal.** Every launch surface below reports its own completion, so waiting is receiving that report rather than repeatedly asking for it. The wait therefore costs nothing: carry on with whatever does not depend on the launched result, and let the signal be the collection point. When nothing independent is left, stop there and let the signal resume the work — that pause *is* the wait, and it is the only form of it that is free.

**Report where each launch stands.** At every check-in while something is outstanding, give one line per launch — launched, still running, collected. A wait nobody can see reads exactly like a wait that has stalled, and the user cannot call off what was never reported.

**A launch whose host names no surface below runs in the foreground instead**, at the point its own contract would have launched it, and is reported on collection like any other. The missing surface withdraws the background option, never the reporting duty — and never licenses a foreground `sleep` in place of the signal, which § *What is not a wait* rules out.

## What is not a wait

**A blocking foreground `sleep`.** It buys no signal that was not already coming, and the Claude Code harness refuses one outright — so an agent reaching for it holds no wait at all, only a failed tool call. Where a condition genuinely has to be watched rather than notified, put the watch itself in the background so the turn stays free.

**A condition the awaited work will never satisfy.** An `until` loop on a sentinel path nothing writes, a grep for a marker the process never prints, a filter matching only the success line of a job that can also crash — each runs to its timeout while reading exactly like work still in progress. Before arming a conditional wait, name what writes the condition and what the watch emits if the work dies instead of finishing; with no answer to either, that condition is not one to wait on.

## Per-host primitives

- **Claude Code** — a subagent launched through the `Agent` tool runs in the background and its completion arrives as a notification; a command launched through `Bash` with `run_in_background` does the same when it exits. For a condition rather than a completion the harness offers two forms: a `run_in_background` command that exits once the condition holds — an `until` loop wrapping the real check — for a single notification, and `Monitor` where each occurrence, not just the end, is worth one.
- **Codex** — a subagent spawned on the multi-agent surface notifies on completion the same way, and `wait_agent` additionally blocks for a bounded window when the result is needed on the critical path rather than eventually. It takes a `timeout_ms` and returns empty when that expires, so a timed-out call is re-entered or left to the notification; an empty return is not a finished agent. This entry covers the agent surface only; Codex's backgrounded-shell surface is not established here.

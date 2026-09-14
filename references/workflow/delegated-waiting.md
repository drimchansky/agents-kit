# Delegated Waiting

How an agent waits for asynchronous work it launched and has not yet collected: delegated agents, and backgrounded shell commands where the host names a surface for them. What a wait's outcome means stays with the launching contract.

## How to wait

**Wait on the harness's own completion signal.** Every launch surface below reports its own completion. Carry on with whatever does not depend on the launched result and let the signal be the collection point. When nothing independent is left, stop and let the signal resume the work; that pause is the wait.

**Report where each launch stands.** At every check-in while something is outstanding, give one line per launch: launched, still running, collected. An unreported wait cannot be called off.

**A launch whose host names no surface below runs in the foreground**, at the point its contract would have launched it, and is reported on collection like any other. The missing surface withdraws the background option, not the reporting duty, and never licenses a foreground `sleep`.

## What is not a wait

**A blocking foreground `sleep`.** It buys no signal, and the Claude Code harness refuses it outright. Where a condition has to be watched rather than notified, put the watch itself in the background.

**A condition the awaited work will never satisfy.** An `until` loop on a path nothing writes, a grep for a marker never printed, a filter matching only the success line of a job that can also crash. Before arming a conditional wait, name what writes the condition and what the watch emits if the work dies; with no answer to either, do not wait on it.

## Per-host primitives

- **Claude Code**: a subagent launched through the `Agent` tool runs in the background and its completion arrives as a notification; a `Bash` command with `run_in_background` does the same on exit. For a condition, use a `run_in_background` command that exits once the condition holds, or `Monitor` where each occurrence is worth a notification.
- **Codex**: a subagent on the multi-agent surface notifies on completion the same way; `wait_agent` additionally blocks for a bounded window when the result is on the critical path. It takes `timeout_ms` and returns empty on expiry; an empty return is not a finished agent, so re-enter the call or leave it to the notification. Codex's backgrounded-shell surface is not established here.

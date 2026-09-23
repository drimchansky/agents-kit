# Delegated Waiting

How an agent collects asynchronous work it launched: delegated agents and shell commands. What an outcome means stays with the launching contract.

## How to wait

**Use the launch surface's completion mechanism.** Carry on with independent work while a launch runs. When none remains, receive its notification or collect its command session through the host primitive below.

**Report where each launch stands.** At every check-in while something is outstanding, give one line per launch: launched, still running, collected. An unreported wait cannot be called off.

**A launch whose host names no surface below runs in the foreground**, at the point its contract would have launched it, and is reported on collection like any other. The missing surface withdraws the background option, not the reporting duty, and never licenses a foreground `sleep`.

## What is not a wait

**A blocking foreground `sleep`.** It buys no signal, and the Claude Code harness refuses it outright. Where a condition has to be watched rather than notified, put the watch itself in the background.

**A condition the awaited work will never satisfy.** An `until` loop on a path nothing writes, a grep for a marker never printed, a filter matching only the success line of a job that can also crash. Before arming a conditional wait, name what writes the condition and what the watch emits if the work dies; with no answer to either, do not wait on it.

## Per-host primitives

- **Claude Code**: a subagent launched through the `Agent` tool runs in the background and notifies on completion. For a condition, use `Monitor` where each occurrence is worth a notification.
- **Codex**: a subagent on the multi-agent surface notifies on completion; `wait_agent` additionally blocks for a bounded window when the result is on the critical path. It takes `timeout_ms` and returns empty on expiry; an empty return is not a finished agent, so re-enter the call or leave it to the notification.

## Shell commands

Run each command in the working root its launching contract names. Collect its output and exit status before interpreting its outcome.

- **Claude Code**: launch with `Bash` and `run_in_background`. Its completion notification supplies the exit status and names the output file. Read that file before interpreting the outcome. For a condition, run a background command that exits when the condition holds.
- **Codex**: launch with `exec_command({cmd:<command>, workdir:<root>, yield_time_ms:1000})`. An immediate `exit_code` completes the command. When it returns `session_id`, call `write_stdin({session_id, chars:"", yield_time_ms:300000})` on that same session until an `exit_code` arrives. Preserve output from each response. Empty output while `session_id` persists means it is still running; do not relaunch or end the turn expecting a notification.

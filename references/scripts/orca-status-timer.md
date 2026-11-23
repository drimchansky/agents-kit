# `scripts/orca-status-timer.ts`

Schedules the status wakes in `../../skills/start-orca/SKILL.md` § *Report status*. Deciding whether a wake is current and posting the status remain with the coordinator.

```
node <kit-root>/scripts/orca-status-timer.ts arm --run <run-id> --at <iso-utc-instant> --orca <executable>
node <kit-root>/scripts/orca-status-timer.ts status --run <run-id>
node <kit-root>/scripts/orca-status-timer.ts cancel --run <run-id>
```

`--run` takes the Orca Run id: letters, digits, `_`, or `-`, starting with a letter or digit, at most 128 characters. `--at` takes an ISO UTC instant such as `2026-01-01T12:15:00Z`, with optional milliseconds. `--orca` takes the Orca executable the coordinator selected, as a path or a command name on `PATH`.

**Arm.** `arm` makes the new timer the Run's one current timer. It first cancels an earlier current timer that is `pending`, `sending`, or `lost`, as `cancel` does. It then starts one detached process, which runs the helper's internal `fire` command, and prints `{timer,superseded}`. Callers never run `fire`. `timer` is the new timer's view under § *Status*. `superseded` is null, or `{token,state,process}` for the earlier timer it cancelled. A deadline at or before the current time exits 2 without creating state.

**The wake.** At the deadline, the process re-checks that its token is still the Run's current token and claims it for sending. A cancelled or superseded timer fails one of those checks and exits without sending. Otherwise it runs the Orca executable once, with no shell and a 60-second limit. That run sends one Orca orchestration mail to the Run's coordinator mailbox, with the subject `agents-kit start-orca status wake`.

The body is three lines:

```
agents-kit start-orca status-wake v1
run: <run-id>
token: <token>
```

The process records the send result and exits: 0 when the send exited 0, and 1 otherwise. It never retries a send. A failed send stays visible only through `status`.

**Status.** stdout is `{run,timer}`. `timer` is null when the Run has no timer. Otherwise it is `{run,token,at,armedAt,pid,orca,state,result}`. `state` is one of:

- `pending`: the process is waiting for its deadline.
- `sending`: the process claimed the token and the send has not finished.
- `sent`: the send exited 0.
- `failed`: the send failed to start, exited non-zero, was killed, or exceeded its limit.
- `cancelled`: `cancel` or a later `arm` claimed the token first. No wake follows from it.
- `lost`: the process ended without recording a result, for example after a reboot or kill. Treat its token as stale.

`result` is null until the send finishes. Then it is `{outcome,at,status,signal,error,stdout,stderr}`, with the outcome `sent` or `failed` and the last 4096 characters of each output stream. Status never creates state.

**Cancel.** `cancel` claims the current token so its process can no longer send. It prints `{run,timer,process}`, with `timer` viewed after the claim. When the Run has no timer, `timer` and `process` are null. `process` is one of:

- `stopped`: the recorded process was signalled and is gone.
- `signalled`: the recorded process was signalled and was still present after two seconds. It can no longer send.
- `not-running`: no process with the recorded id and this timer's command line exists. Nothing was signalled.
- `untouched`: the token was already claimed. A `sending` or `sent` state means a wake may still arrive with this token.

Cancel signals a process only when its command line names this Run and token. It never signals another process.

**State.** Timers live under `~/.local/state/agents-kit/orca-status-timer/<run-id>/`, with directories `0700` and files `0600`. `current.json` names the current token. Each token keeps its timer record, claim, and send result beside it. `arm` removes earlier tokens' files once their processes are gone. The state belongs to the coordinator's session; nothing restarts a timer after its process ends.

**Exit status.** `arm`, `status`, and `cancel` exit 0 after printing their JSON. Exit 2 means bad usage, a past deadline, unreadable or malformed timer state, or a failure to write state or start the process. A refusal writes one reason to stderr and nothing to stdout. The timer process exits 1 after recording a failed send.

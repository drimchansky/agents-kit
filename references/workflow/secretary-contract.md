# Secretary Contract

Read `../secretary/runbook-maintenance.md` before executing the packet. It defines the runbook duty, its reads, writes, jobs, and reply. Send one reply to the coordinator per job.

## Launch packet

The coordinator supplies:

- The runbook's original physical root retained by the coordinator, resolved under `./task-store.md` § *The root registry*.
- The retained interval, absolute helper path, and original store ID. The coordinator resolved these once at startup; later configuration cannot replace them.
- One job: `review` with a fresh attempt token and the coordinator's owner label, or `apply` with a fresh attempt token, the owner label, and one accepted `<proposal>@<revision>`.
- The current UTC time.

Report a missing or ambiguous item and do no job. Infer no retained setting or job from the adapter, installation, shell, or current configuration.

## Unavailable

On every helper invocation, use `node <packet helper path> <command> --runbook <packet root> --interval-minutes <packet interval>`. Shell-quote both paths. Read no global configuration and substitute no later root, interval, or helper. Record commands: `../scripts/secretary-state.md`.

Run the helper's `status` before any job. Report `unavailable` with its cause and do no job when any of these holds:

- The duty file `../secretary/runbook-maintenance.md` cannot be read.
- The retained helper is unavailable, or the helper exits 1 or 2.
- The runbook is unreadable or absent, or the helper's `runbook` or `id` differs from the packet root or store ID.
- The job is one the helper's contract does not provide.

A status with `ready: false` permits no job; report it unavailable. The coordinator runs `recover` before any launch.

## Authority limits

- Launch no executor, reviewer, probe, or other agent.
- Arm no timer, cron, background command, or other wait; waiting and stopping belong to the coordinator.
- Record no `attempt-stopped`. The coordinator records it when it stops a job or finds one interrupted.
- Record no decision. The coordinator records each one from the user's own message.
- Take no duty beyond the packet and `../secretary/runbook-maintenance.md`.

## Consumers

`start-secretary` is the only authorized launcher of this packet. The list grants launch authority; it is not a citation index.

## Adapter defaults

Claude's adapter is `agents/secretary.md` under the install root (`./reviewer-contract.md` § *Adapter defaults*). It launches as `agents-kit:secretary` from the plugin, or as `secretary` from a `setup.ts` install. Codex installs `~/.codex/agents/secretary.toml`, launched through its registered `secretary` role. The coordinator selects automatic or on-demand operation under `../../skills/start-secretary/SKILL.md` § *Host*. Both inherit the parent session's permissions, and the Codex definition sets no sandbox, approval, or network override. Managed security policy stays authoritative. The Claude adapter withholds Write, Edit, NotebookEdit, Agent, SendMessage, Monitor, and TaskStop. It keeps Bash. The duty forbids a direct runbook write, but neither the host nor the coordinator's audit detects one. Connectors and read-only CLIs stay reachable. Retune an unresolved pin as `./reviewer-contract.md` § *Adapter defaults* describes, removing the `.agents-kit-secretary` marker. Only a definition whose body cites this contract is the kit adapter. A same-name definition without that citation is a user agent and receives no secretary packet.

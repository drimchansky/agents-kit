# Cross-Vendor Executors

Prepare external launches under [executor routing](./executor-routing.md) and the selected consumer's [binding](./executor-contract.md#bindings).
Select only a route admitted by that routing contract.

## Prepare and collect

Resolve `<kit-root>` through [the helper-root rules](./task-store.md#resolving-kit-root); a `setup.ts`-installed home cannot supply the helper.
Use [the launcher contract](../scripts/executor-run.md) to write a launch request and a packet satisfying [Launch packet](./executor-contract.md#launch-packet).
Write both files inside the executor's [assigned scratch directory](./agent-scratch.md#assignment), and set `outputDir` to `<assigned directory>/output`.
Create `<assigned directory>/work` and name it in the packet as the executor's scratch directory, in place of the assigned directory.
Keep the request, packet, and `outputDir` outside `work`.
Keep the effective root and placement chosen by the coordinator; apply [parallel placement](./parallel-batch.md) where required.
Pass the coordinator's [install root](./reviewer-contract.md#adapter-defaults) as `contractRoot`, even when the helper comes from another source checkout or plugin.

Resolve model and effort from the selected engine's installed executor adapter or an applicable authorized override. For `codex` that adapter is `~/.codex/agents/executor.toml`; for `claude` it is `agents/executor.md` under the Claude install root.
When neither the adapter nor an override supplies them, ask the user for the model and effort before launch.
Put the source of that choice in `model.provenance`; the launcher carries no model pins.
Select permission settings within the user's grant and live restrictions, then record their source in `policy.provenance`.
Native adapters retain their existing permission inheritance.

Invoke the helper as [the launcher contract](../scripts/executor-run.md) shows, using the host's [existing collection primitives](./delegated-waiting.md).
Watch `run.stdout`, `run.stderr`, and `events.jsonl` in `outputDir` as the command's progress logs under the [silence watch](./delegated-waiting.md#how-to-wait).
The helper command needs network access and write access to the vendor CLI's home directory. Under a sandboxed host shell, request the host's approval for that command before launch, and report a denial instead of working around it.
Read the receipt and its available report through [executor intake](./executor-contract.md#write-mode-routing).
When no receipt arrived, stop any surviving process group the output directory's `child.json` names, after confirming it still runs the recorded command.
After a failed or interrupted process, confirm that no process the executor started still runs, then apply [interrupted execution](./executor-contract.md#write-mode-routing) before consumer recovery.
Copy needed diagnostics into the coordinator's record, then remove the assigned directory under [scratch cleanup](./agent-scratch.md#cleanup).

## Codex

The Claude Code coordinator launches Codex CLI through [the launcher contract](../scripts/executor-run.md).
Select `codex` only for an effective root inside a Git repository.

Start from `workspace-write`, approval `never`, and command networking disabled. Enable networking only within an applicable grant.
Broader access requires an applicable user grant before launch; denial does not authorize a broader retry.
These are [Codex sandbox controls](https://learn.chatgpt.com/docs/agent-approvals-security), not a general network ban on hosted tools or existing connectors.

## Claude

The Codex coordinator launches `claude -p` with an invocation-local executor role through [the launcher contract](../scripts/executor-run.md).

Use `acceptEdits` with permission prompts `none` for conservative write-capable execution.
Supply only applicable scoped shell allowances for required checks; the helper adds read access to the contract root's `references/` and `CORE_RULES.md`. Existing permission rules and hooks continue to apply.
Add scoped `Read(//<assigned directory>/work/**)` and `Edit(//<assigned directory>/work/**)` allowances for the executor's scratch directory from [Prepare and collect](#prepare-and-collect).
Add the same pair for its resolved path when that path differs.
Beyond the check allowances, add the scoped `Bash(node <kit-root>/scripts/silence-watch.ts *)` allowance, using the absolute `<kit-root>` from [Prepare and collect](#prepare-and-collect).
Claude Code applies `Bash` rules to [`Monitor` commands](https://code.claude.com/docs/en/tools-reference#monitor-tool), so this allowance lets the executor arm its [silence watch](./delegated-waiting.md#shell-commands).
Supply the silence-watch command from `./executor-contract.md` § *Launch packet*: `node <kit-root>/scripts/silence-watch.ts` with that same absolute kit root.
Claude's file tools otherwise reach only `root` and the contract paths. Supply other packet context verbatim, or add a scoped `Read(//<absolute-path>/**)` allowance.
Each added `Read` or `Edit` allowance path holds no `*`, `?`, `[`, `]`, `!`, `\`, `(`, or `)`.
Unresolved permission requests are denied after those controls run, as defined by [unattended permissions](https://code.claude.com/docs/en/headless#turn-off-permission-prompts-in-unattended-runs).
Claude edit approval does not provide Codex workspace confinement. Its network field records inherited controls rather than promising equivalent isolation.
Broader modes require a coordinator-selected applicable grant; the helper does not repair a denial by changing policy.

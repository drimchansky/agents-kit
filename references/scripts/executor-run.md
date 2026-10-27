# `scripts/executor-run.ts`

Launch an external executor and collect its process evidence. Coordinator preparation: [cross-vendor execution](../workflow/executor-engines-cross-vendor.md).

```text
node <kit-root>/scripts/executor-run.ts <launch-request.json>
```

## Request

Supply one JSON object. All filesystem fields below are absolute paths.

```json
{
  "engine": "codex",
  "root": "/absolute/effective-root",
  "packet": "/absolute/scratch/packet.txt",
  "outputDir": "/absolute/scratch/fresh-output",
  "contractRoot": "/absolute/coordinator-kit-home",
  "model": {
    "name": "resolved-model-name",
    "effort": "high",
    "provenance": "applicable executor adapter or authorized override"
  },
  "policy": {
    "sandbox": "workspace-write",
    "approval": "never",
    "networkAccess": false,
    "provenance": "applicable authorization and live restrictions"
  }
}
```

`root` exists and remains the child's working directory. Codex also receives it through `-C`. `packet` names a readable regular file delivered through stdin.
`outputDir` must not exist, and must lie outside `root` after resolving links. Its parent exists; the helper creates the directory without replacing previous artifacts.
`contractRoot/references/workflow/executor-contract.md` supplies the contract. A different installed copy is not substituted.

Model settings are explicit strings with nonempty provenance. `inherit`, `default`, and unresolved placeholders are refused.
The CLI determines whether the requested model and effort are available; a rejection preserves its diagnostics without retry.
Claude runs with an empty `fallbackModel` chain through `--settings`, so user, project, and local chains cannot switch models.
A switch reported as a `system` event with subtype `model_fallback` or `model_refusal_fallback` sets status `1`. It lists under `engineStatus.modelFallbacks`.
A switch the stream does not report this way, such as a legacy model remap, goes undetected; the receipt's `model` stays the requested one.
Unknown request, model, or policy fields are refused rather than recorded without application.

Codex accepts `sandbox` values `read-only`, `workspace-write`, or `danger-full-access`, with `approval` fixed to `never`.
The helper applies approval through `codex exec -c 'approval_policy="never"'` so exec configuration overrides a conflicting saved default.
`networkAccess` controls workspace-write command networking. Read-only requires `false`; full access requires `true`.
Codex runs only inside a Git repository; a `root` outside one is refused before launch.
Existing CLI configuration, authentication, repository instructions, and managed restrictions remain active.
Codex may save a trusted-project entry for `root` in the user's Codex configuration. The helper neither prevents nor removes it.

For `engine: "claude"`, keep the common fields and replace `policy` with:

```json
{
  "permissionMode": "acceptEdits",
  "permissionPrompts": "none",
  "allowedTools": ["Bash(node --test tests/*.test.ts)"],
  "network": "inherit",
  "provenance": "applicable authorization and live restrictions"
}
```

Claude's explicit mode is `acceptEdits`, `manual`, `dontAsk`, `plan`, `auto`, or `bypassPermissions`.
Its effort is `low`, `medium`, `high`, `xhigh`, or `max`. Permission prompts remain `none` in every mode.
`allowedTools` holds one tool rule per entry, and shell rules must be scoped.
A rule is a tool name with an optional parenthesized specifier, or a whole-server MCP wildcard such as `mcp__github__*`.
Names start with a letter and contain only letters, digits, `_`, and `-`, as in `mcp__figma-dev-mode__get_code`.
Entries holding more than one rule, specifiers containing `)` or a comma, and blanket Bash, PowerShell, and Monitor rules are refused.
A refusal names the rejected entry.
The check refuses only literal blanket rules. An interpreter rule such as `Bash(sh *)` or a path rule such as `Edit(//**)` is just as broad, so keep every allowance scoped to a required check.
The helper appends read-only `Read(//<path>/references/**)` and `Read(//<path>/CORE_RULES.md)` rules for `contractRoot` and its resolved path, so the executor can read its contract and the core rules outside `root`.
A Claude `contractRoot` containing `*`, `?`, `[`, `]`, `!`, `\`, `(`, or `)` is refused.
`network: "inherit"` records existing Claude and host network controls; it adds no network restriction.

The helper reads `agents/executor.md` beside its own source/plugin root and builds a [session-local agent](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope) named `agents-kit-executor-<12 hex digits>`, new on each run.
It retargets that role's install-root paragraph to `contractRoot`, then supplies the requested model, effort, and permission mode.
`contractRoot` needs the shared references, not the other host's native agent format.
A missing or incompatible source role refuses launch and names the source path.
The per-run name keeps a managed, project, or user agent named `executor` from replacing the role. User agent definitions remain untouched.

Codex stdin contains the generated bootstrap followed by the packet bytes. Claude stdin contains only the packet bytes.
The Codex bootstrap names the supplied executor contract, preserves live restrictions, and requests the evidence report as the final reply.
Claude receives the retargeted executor role through `--agents` and selects it by its per-run name with `--agent` under `-p`. Its final-reply rule comes from the contract.
Normal configuration discovery stays enabled, including repository instructions and saved authentication.
The helper removes `CLAUDE_CODE_EFFORT_LEVEL` from Claude's environment and sets it to the requested effort through `--settings`.
User, project, and local `env` values then cannot change the effort; a managed `env` value still can.
A lower `maxEffortLevel` from any settings scope still caps the applied effort. The receipt records the requested effort and cannot see that cap.

## Receipt and artifacts

Stdout contains one JSON receipt. It records `engine`, `root`, `contractRoot`, `roleSource`, `model`, `policy`, `child`, `probes`, `cancellation`, `report`, `artifacts`, `diagnostics`, and `helperExitCode`.
After an execution attempt, `engineStatus` records observed terminal events separately from OS status.
It also lists Claude's denied tool names under `permissionDenials` and Codex error-item messages under `errorItems`.
Invalid invocation arguments return only `helperExitCode` and `diagnostics`.

`child` contains `pid`, `started`, raw `exitCode`, terminating `signal`, launch or transport `error`, and `strays` (§ *Cancellation*).
`probes` records each CLI-help invocation with its outcome and saved output locations.
`cancellation` contains `requested`, the received `signal`, and any signaling `errors`.
`report` is the extracted final reply's absolute path, or `null` when unavailable. Its content is unchanged.
When `artifacts` lists `stdout`, the helper created that `report.txt` before launch and wrote it through the open file. That file is empty when `report` is `null`, unless `diagnostics` records `cannot save final reply`.
If `outputDir` is no longer the directory the helper created, `report` is `null` and the receipt omits artifact and probe output paths.
That run returns `2` unless cancellation was requested.
`roleSource` names Claude's source adapter, or is `null` for Codex.

`artifacts` names the copied request, exact stdin, argument array and cwd, raw stdout, raw stderr, [parsed event JSONL](https://learn.chatgpt.com/docs/non-interactive-mode), and the child record.
It lists only files the helper created, so a refused launch names fewer artifacts.
Help output remains beside these artifacts. Raw stdout retains malformed or truncated event bytes.
Codex's final reply is the text of its last completed `agent_message` event.
A Codex stream without a `turn.completed` or `turn.failed` event returns `2`; its last message stays saved as `report`.
Claude also retains the invocation-local definition as `artifacts.role`; its final reply comes from the [stream's `result` event](https://code.claude.com/docs/en/headless).
Engine errors remain in the event log; an error-shaped diagnostic item alone does not establish a failed turn.
Transport diagnostics appear in `diagnostics`, independently of the executor's report.
A CLI that exits before reading the whole packet records `packet not fully delivered` there; its exit code still decides the status, and a zero exit after an undelivered packet returns `2`.

The helper checks required flags before sending the packet. Unsupported flags name the missing capability and the saved help output.
It uses argument arrays without a shell and preserves complete output without a subprocess buffer limit.
It performs no unit acceptance, verification, tree repair, or alternate-engine retry.

## Exit status

- `0`: the child finished normally and a final reply is available for intake.
- `1`: a known child failure, failed engine turn, reported model switch, or requested cancellation occurred.
- `2`: invalid input, unsupported launch mechanics, launch failure, absent final reply, a stream without a terminal turn event, a replaced output directory, or unreadable transport prevented normal collection.

A cancellation retains status `1` even when interruption truncated the stream. The raw child outcome and available diagnostics remain recorded.
A zero helper status does not assign an executor outcome or accept any work.

## Cancellation

On local POSIX hosts, `SIGINT`, `SIGTERM`, `SIGHUP`, and `SIGQUIT` forward to the launched process group.
Whatever signal arrived, Codex receives `SIGINT` and Claude receives `SIGTERM`, so each CLI's own shutdown stops its running tool commands.
After three seconds, surviving group members receive `SIGKILL`. The helper collects the child before returning its receipt.
Only the CLI's own group is signalled. A descendant that started its own session and outlived the CLI's cleanup keeps running.
When such a descendant still holds the output pipes three seconds after the CLI exits and any group cleanup below ends, the helper stops reading them and records a transport error.
After the CLI exits on its own, members still running in its process group receive `SIGTERM`, then `SIGKILL` after three seconds.
`child.strays`, and each probe's `strays`, records whether any were found. It does not change the exit status.
The `artifacts.child` file records the child's `pid`, also its process-group id, as soon as it starts.
A `SIGKILL` to the helper cannot be forwarded: the group keeps running and no receipt is printed.
Only owned groups receive signals; unrelated processes remain untouched. Windows is refused before launch because this cancellation mechanism is unsupported there.
Logs, an available reply, and tree changes survive cancellation. The helper removes no working files or scratch evidence.

# Test suite contracts

This file holds suite commands and dependencies. Root `AGENTS.md` § *Change routing* maps each changed surface to its suites.

Suites use zero dependencies and Node type stripping, like their sources.

```
node --test tests/<name>.test.ts
node --test "tests/*.test.ts"
```

Quote the glob for the runner to expand it. A bare directory would be resolved as a module path.

**The `pr-comments` suite never reaches the real CLI or the network.** Cases use fixture pages, arguments rejected before fetching, or a fake `gh` first on PATH. Cases requiring live CLI or network access do not belong here.

**The `executor-run` suite uses isolated fake vendor CLIs.** Its PATH contains only fixture executables with an absolute Node interpreter. Missing-command cases use that same isolated PATH. Literal transport, process receipts, large logs, failure after edits, and owned cancellation need local temporary files and POSIX subprocesses; no credentials or live model calls are used. The fake CLI writes each polled sentinel under a temporary name and renames it into place. Otherwise a concurrent poll can read a created but still empty file.

**The `review-evidence` suite checks shared approval contracts across review and publication callers.** It protects risk tiers, capture ordering, evidence forwarding, current-session confirmation, approval routes, and `Pre-existing` finding labels in the source instructions. It neither launches a model nor proves screenshot contents or human judgment.

**The `setup-install` suite pins a rule about `references/` that reaches past its own assertions.** `setup.ts` copies references with `dereference`, materializing links. Health-check's `--installs` pass reports one-sided links as drift. A references symlink would therefore produce permanent installation drift; keep the tree symlink-free.

**The live Codex doctor probe is opt-in.** Its environment diagnostics contact external services and can abort sandboxed suite runs. Run `AGENTS_KIT_LIVE_CODEX_DOCTOR=1 node --test tests/setup-install.test.ts` when live diagnostics are intended. Default runs retain installation and TOML checks and report the doctor probe as skipped.

**The installed Codex TOML probe guards permission inheritance.** It rejects sandbox, approval, permission-profile, and network-proxy overrides in parsed agent definitions. The probe requires Python with `tomllib`; without it, the suite reports the check as skipped.

**The `secretary-state` suite never touches the real home.** Every case passes a temporary home to the CLI or to `openStore`. No run reads the user's configuration or writes their secretary records. Large histories are built in-process through the exported `append`; CLI runs check stdout bounds and exit codes. Due-state cases pass `now` to `append` and `status`. CLI cases that read the real clock place their instants relative to it, and the local-time cron case pins `TZ` for each run. Apply cases write only their temporary runbook and compare it and a sibling file before and after. Interruption cases pass `applyProposal` hooks that throw just before or just after the replacement. Recovery cases pass `recover` a small batch to page short histories; one CLI case builds more than two fixed batches. It also pins the apply-result output and exit-status prose in `references/scripts/secretary-state.md`.

Identity cases switch configuration between temporary runbooks with colliding proposal IDs and verify guarded commands leave both stores untouched.

Permission cases observe record protection and apply permissions during writes and after publication. They restore the process umask and filesystem observers.

**The `start-secretary` suite pins prose across owners.** It reads the skill, every reference section the skill cites, the secretary contract's reply headings and finding classes, and the skill's registrations in `skill-conventions.md` and `domain-packs.md`. It also pins `README.md` § *Secretary* prose and both adapters, `agents/secretary.md` and `agents/secretary.toml`. An edit to any of them can fail it. Capability and lifecycle cases cover automatic wakes and on-demand Codex follow-ups without launching real agents or schedules. Its helper case runs the skill's helper commands and its `attempt-stopped` and `decision` payloads under a temporary home, as the `secretary-state` suite does.

**The `invocation-gate` suite pins prose.** Its `MARKER_LINE` is read from the code span `references/workflow/skill-conventions.md` § *The invocation gate* renders after "this exact line:", so an owner edit fails the suite until every gated skill follows; the roster block there holds one `` - `<skill>` `` entry per line up to the first blank line. The live tree holds no closed door, so the door-detector fixture case is the only proof that the absence check can fail.

**The `commit-scan` suite builds real checkouts.** Branch existence and watermark ancestry require Git repositories, not text fixtures. Each temporary checkout sets local `user.email`, `user.name`, and `commit.gpgsign`, then stages with `git add -f`. This isolates tests from global identity, signing, and ignore settings. Keep the project-local task folder untracked and unstaged so it stays outside the ranges under test.

**The `health-check` suite's fixture ages are load-bearing.** Four folders exceed the default 30 days. `done-unarchived` is excluded from stale by terminal status; `unknown-status` by vocabulary; `parked-todo` by backlog placement. `no-status-plan` has no exemption: the live-status guard checks only non-null status. Its unparseable header therefore yields the second stale finding, labeled `no-status`. Regressing any exclusion changes the count.

## Opt-in live executor smoke

Run this procedure only when live model calls are requested. Use disposable fixture repositories and existing authenticated CLIs. Preserve installed payloads, authentication files, and user configuration. Fingerprint protected configuration, auth files, and installed definitions before calls; retain hashes without copying credential contents.

1. Name one absolute `<candidate-kit>` checkout. Record `git -C "<candidate-kit>" rev-parse HEAD`, its tracked delta, and any untracked candidate inputs. Record host and child CLI versions.
2. Explicitly load the candidate `skills/implement/SKILL.md` in each fresh host session. Bind the test's source, helper, and contract roots to `<candidate-kit>`. For external launches, invoke that checkout's helper directly with request `contractRoot` pointing there, following [cross-vendor preparation](../references/workflow/executor-engines-cross-vendor.md) and the [launcher contract](../references/scripts/executor-run.md). A registered `kitRoot` pointing elsewhere does not identify this candidate; do not rewrite machine configuration to select it.
3. Derive native test adapters from the candidate [Claude definition](../agents/executor.md) or [Codex definition](../agents/executor.toml). Preserve role instructions, model, effort, and permission inheritance; expand only install-root references to the candidate's absolute root. Supply Claude's named `executor` through invocation-local `--agents`; place Codex's definition at the fixture's `.codex/agents/executor.toml`. If Codex selects another role file, restart with invocation-only `-c 'agents.executor.config_file="/absolute/fixture/.codex/agents/executor.toml"'` ([role setting](https://learn.chatgpt.com/docs/config-file/config-reference), [one-off overrides](https://learn.chatgpt.com/docs/config-file/config-advanced#one-off-overrides-from-the-cli)). Retain the source-to-test definition diff.
4. In each host, exercise a fresh run with omitted `-e`. Verify the native route, selected candidate definition, and actual candidate-contract read in the trace. An installed definition or missing contract-read evidence leaves the check pending.
5. From Claude Code, invoke candidate `implement -e codex` on a bounded file change. Repeat from Codex with `implement -e claude`. Verify the requested diff at the supplied fixture root. Trace Codex's executor bootstrap and contract read; for Claude, trace the per-run `agents-kit-executor-*` role, candidate `roleSource`, and contract read.
6. Include two ordered units in the Codex-host exercise. Assign Unit 1 a coordinator-owned required check under [executor intake](../references/workflow/executor-contract.md#write-mode-routing). Its report retains that check as pending, and its packet excludes Unit 2. Run the original check before acceptance and the successor launch. Failure or unavailable access keeps the unit and its dependent work unadvanced.
7. Use a separate fixture with an intentionally unavailable required capability. Confirm an explicit blocker and held coordinator disposition, preserving the selected engine and permission policy. Record unavailable host, login, model, policy, or verification access as pending.
8. For each attempt, retain invocation, root, model/effort/policy provenance, receipt, raw diagnostics, available final report, and coordinator disposition. Compare requested model, effort, and policy with exposed runtime trace settings. A mismatch fails the check; a receipt alone does not prove application. Include selected-role and contract-read trace locations, plus proof ownership for every required check. Finish the repository checks under [Change routing](../AGENTS.md#change-routing), including inspection of the unchanged [native permission-inheritance fixture](./setup-install.test.ts).
9. After all CLI calls exit, identify trust entries created by this run for disposable roots. Remove only proven task-owned entries, preserving unrelated user changes. Recheck protected fingerprints and account for remaining differences. Whole-configuration rollback and home-wide cleanup are outside this procedure.

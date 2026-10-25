# Test suite contracts

This file holds suite commands and dependencies. Root `AGENTS.md` § *Change routing* maps each changed surface to its suites.

Suites use zero dependencies and Node type stripping, like their sources.

```
node --test tests/<name>.test.ts
node --test "tests/*.test.ts"
```

Quote the glob for the runner to expand it. A bare directory would be resolved as a module path.

**The `pr-comments` suite never reaches the real CLI or the network.** Cases use fixture pages, arguments rejected before fetching, or a fake `gh` first on PATH. Cases requiring live CLI or network access do not belong here.

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

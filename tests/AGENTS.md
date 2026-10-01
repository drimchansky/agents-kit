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

**The `commit-scan` suite builds real checkouts.** Branch existence and watermark ancestry require Git repositories, not text fixtures. Each temporary checkout sets local `user.email`, `user.name`, and `commit.gpgsign`, then stages with `git add -f`. This isolates tests from global identity, signing, and ignore settings. Keep the project-local task folder untracked and unstaged so it stays outside the ranges under test.

**The `health-check` suite's fixture ages are load-bearing.** Four folders exceed the default 30 days. `done-unarchived` is excluded from stale by terminal status; `unknown-status` by vocabulary; `parked-todo` by backlog placement. `no-status-plan` has no exemption: the live-status guard checks only non-null status. Its unparseable header therefore yields the second stale finding, labeled `no-status`. Regressing any exclusion changes the count.

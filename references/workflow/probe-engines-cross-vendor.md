# Probe Engines: Cross-Vendor

The cross-vendor engines the opt-in `-x` cross-check runs on — each one's launch recipe, what it enforces, and what it costs — split out of `./probe-engines.md`, which keeps the native engine for probe fan-out other than this cross-check. The probe contract that binds every engine is `./agent-fanout.md`; the `-x` contract that selects between these two is `./probe-cross-check.md`. Read this file only when an `-x` run is launching its probe.

Waiting and status reporting are `./delegated-waiting.md` § *How to wait* on either engine; when `skipped` is legitimate is the degrade rule in `./agent-fanout.md` § *Probe contract (every engine)*.

- **`codex`** — OpenAI Codex CLI, headless. The cross-vendor engine when the host is Claude Code. Requires `codex` on PATH and an active login — `command -v codex` checks presence; a failed login surfaces at run time and degrades to `skipped`.

  ```bash
  codex exec --ephemeral --sandbox read-only --skip-git-repo-check \
    -C <working-root> -o <scratch>/probe.md - < <scratch>/probe-prompt.md
  ```

  The prompt goes in on stdin, never as a command-line argument: the invoking agent writes the filled skeleton (findings verbatim) to `<scratch>/probe-prompt.md` with its file tool, and the trailing `-` makes `codex exec` read it from stdin — so a `$`, backtick, or apostrophe in a finding is data, not shell syntax to expand or execute (`<scratch>` is an absolute path). `--sandbox read-only` is the engine-side enforcement of the read-only promise; `-o` captures just the final message for merging; `--ephemeral` leaves no session files. Parallel probes are plain shell jobs (`&` + `wait`), one prompt file and one `-o` file each. Launch early and run in the background where the host supports it; collect at the merge point.

- **`claude`** — Claude Code, headless. The cross-vendor engine when the host is Codex — the mirror of the above:

  ```bash
  cd <working-root> && claude -p --permission-mode plan \
    --no-session-persistence < <scratch>/probe-prompt.md > <scratch>/probe.md
  ```

  The leading `cd` pins the working root (`claude` has no `-C` equivalent); `--no-session-persistence` is the mirror of `--ephemeral` — no session files left behind. Prompt passing mirrors codex — the same `<scratch>/probe-prompt.md` fed on stdin (both `<scratch>` paths are absolute, since the `cd` changes directory), so untrusted finding text never reaches the shell as syntax.

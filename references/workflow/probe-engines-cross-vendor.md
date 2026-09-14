# Probe Engines: Cross-Vendor

The engines the opt-in `-x` cross-check runs on. The contract binding every engine is `./agent-fanout.md`; `./probe-cross-check.md` selects between these two. Wait per `./delegated-waiting.md` § *How to wait*; when `skipped` is legitimate is the degrade rule in `./agent-fanout.md` § *Probe contract (every engine)*.

- **`codex`**: OpenAI Codex CLI, headless. The cross-vendor engine when the host is Claude Code. Requires `codex` on PATH (`command -v codex`) and an active login; a failed login degrades to `skipped` at run time.

  ```bash
  codex exec --ephemeral --sandbox read-only --skip-git-repo-check \
    -C <working-root> -o <scratch>/probe.md - < <scratch>/probe-prompt.md
  ```

  Write the filled prompt (findings verbatim) to `<scratch>/probe-prompt.md` with the file tool and feed it on stdin through the trailing `-`, never as a command-line argument, so a `$`, backtick, or apostrophe in a finding stays data. `<scratch>` is absolute. `--sandbox read-only` enforces the read-only promise; `-o` captures the final message; `--ephemeral` leaves no session files. Parallel probes are shell jobs (`&` + `wait`), one prompt file and one `-o` file each. Launch early in the background where the host supports it; collect at the merge point.

- **`claude`**: Claude Code, headless. The cross-vendor engine when the host is Codex.

  ```bash
  cd <working-root> && claude -p --permission-mode plan \
    --no-session-persistence < <scratch>/probe-prompt.md > <scratch>/probe.md
  ```

  The `cd` pins the working root (`claude` has no `-C`); `--no-session-persistence` mirrors `--ephemeral`. Prompt passing mirrors codex, both `<scratch>` paths absolute because the `cd` changes directory.

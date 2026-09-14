# Probe Engines

The **native** probe engine, the default for all probe fan-out. The contract binding every engine is `./agent-fanout.md`; the `-x` cross-check's engines are `./probe-engines-cross-vendor.md`.

- **`native`**: the host harness's own subagents (Claude Code's agent tool; Codex's multi-agent). Default for everything except the opt-in `-x` cross-check. **No engine-side read-only enforcement**: a native subagent inherits the session's tools, so the promise is prompt-borne. Always state it, and launch on the most restricted agent type whose reading discipline fits the probe's shape. On Claude Code, `Explore` and `Plan` drop `Edit`/`Write`/`NotebookEdit` but keep Bash; `Explore` reads excerpts rather than whole files, which suits a search probe and starves a verify-shape one. A native probe is trusted, not confined.

# Codex / manual install

For Codex, or for users who prefer a non-plugin install of Claude Code, run the setup script:

```bash
git clone git@github.com:drimchansky/agents-kit.git ~/agents-kit
~/agents-kit/setup.sh
```

The repo can be cloned anywhere — `setup.sh` resolves its own location automatically. The script copies `skills/` and `references/` into **both** `~/.claude/` and `~/.codex/` unconditionally (even if you only use one agent) and dereferences the per-skill `AGENTS.md` symlinks into real files at the install destination.

**Windows note:** the kit's per-engineering-skill `AGENTS.md` files are Git symlinks (standalone utility skills don't carry one). They check out correctly on macOS, Linux, and WSL. On native Windows, Git requires `core.symlinks=true` (default-on with modern Git for Windows + developer mode); without it, the symlinks materialize as text files containing the literal path `../../CORE_RULES.md` and the kit's rules won't load. Verify with `ls -la skills/explore/AGENTS.md` showing a real symlink before running `setup.sh`. WSL avoids the issue entirely.

## Updating

```bash
cd ~/agents-kit && git pull
~/agents-kit/setup.sh   # only needed for non-plugin installs
```

Plugin installs pick up changes the next time the plugin cache refreshes.

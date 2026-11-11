# Agent Scratch Directories

Where delegated reviewers, probes, and executors keep scratch files. § *Agent rules* and § *Worktrees* address launched agents; other sections address the coordinator, the session that launches them.

## Assignment

The host's scratch area is the shared scratch root. Before each reviewer, probe, or executor launch, create one directory under it:

```bash
mktemp -d "<host scratch area>/<role>-XXXXXX"
```

Substitute the absolute path of the host's scratch area, and set `<role>` to `reviewer`, `probe`, or `executor`. Put the printed absolute path in that agent's launch packet or prompt as its scratch directory. Never give one directory to two agents in a session.

If `mktemp -d` fails, still launch the agent. In place of the path, give `none (<reason>)` as its scratch directory, using the `mktemp` error as the reason. Cross-vendor probes are the exception. Do not launch one with `none (<reason>)`; its recipe keeps its prompt and output files in its scratch directory (`./probe-engines-cross-vendor.md`).

Creating an assigned directory and removing it under § *Cleanup* count as launch bookkeeping. Both fall outside every skill's write limits and confirmation gates.

## Agent rules

- Write and remove scratch files only inside the assigned directory.
- When the scratch directory is `none (<reason>)`, create no scratch files.
- Delete by exact path, never by glob at the shared scratch root.
- Create links with `ln -sn`, so an existing link at the destination fails instead of being followed into its target.

## Worktrees

A reviewer or probe creates no file, directory, or symlink inside any worktree through its own commands. This covers saved diffs, extracted trees, links, and reproduction scripts. Output that the packet's verification scripts write at the effective root is the only exception (`../engineering/review.md` § *Verification Scripts*).

An executor edits its effective root under `./executor-contract.md` § *Execution boundaries* and keeps its scratch files in the assigned directory.

## Cleanup

After intake of an agent's return, copy anything still needed out of its assigned directory. Then remove that directory by its exact path.

A launch can also end with no return: a failed, dropped, or cancelled run, an executor run with no receipt, or a dead probe. Remove its directory only once the agent is confirmed stopped and needed diagnostics are copied out.

## Session-owned scratch

The inline review pass and other work the session runs itself use the shared scratch root directly, with no assigned directory.

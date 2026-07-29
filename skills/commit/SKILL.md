---
name: commit
description: Use when asked to create the commit after review-commit — or a composite forwarding its draft — has prepared the message; the user provides no message.
disable-model-invocation: true
effort: low
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.

This skill does not load the engineering pack, alone among the engineering-contributed skills. The one line of `./references/engineering/rules.md` that bears on it — Git state is mutated only when explicitly asked — is carried by the paragraph below; the rest of the overlay (verify-before-presenting, dependencies, stack defaults, per-surface checklists) governs code work, and this skill writes no code. See `./references/workflow/domain-packs.md`.

Create the commit that `/review-commit` prepared. This is the one skill that deliberately mutates Git state — invoking it *is* the explicit permission `references/engineering/rules.md` requires. It stages nothing, pushes nothing, and creates no branches: it commits exactly what is already staged, using the message review-commit drafted.

On Claude Code it runs at `low` effort, because the matched-digest path is pure mechanics; one bullet below is not — accounting for a staged set that moved since the review — and it says so where it sits. `effort` is a Claude Code frontmatter field, so on the Codex install it is inert and the skill runs at the session's effort. The skill declares no `allowed-tools`, so every command *you* issue — Process steps 3 and 4 — goes through the host's own permission flow. The snapshot block below is the exception, and not a grant either: Claude Code runs it as preprocessing at skill load, before the permission layer is involved at all, which is why both its commands are read-only. What forbids amending or pushing is the Process below, never a grant.

## Staged-set snapshot

Captured at skill load, before you saw this content — two read-only commands (no `-w`, nothing written), so the snapshot is the staged set as of this turn. First line is the staged-set digest; every line after it is one staged path.

```!
git diff --cached | git hash-object --stdin
git diff --cached --name-only
```

Read the preconditions off this snapshot rather than re-running the commands. Three re-runs are still called for: `git diff --cached` to inspect *content* when accounting for a moved set; `git diff --cached --quiet` when the digest is the ambiguous empty-input one below, which may in turn call for rebuilding the snapshot outright; and the digest once more immediately before the commit itself (Process step 3) — the snapshot is captured at load, so anything staged during this run would otherwise ride along unreviewed.

**If the first line above isn't a bare hex digest** — 40 characters in a SHA-1 repo, 64 in a SHA-256 one — there is no snapshot, whether the block produced nothing, rendered as a literal listing of the two commands (Codex does this, where Claude Code executes them), or returned Claude Code's `[shell command execution disabled by policy]` sentinel under the `disableSkillShellExecution` setting. Run both commands yourself: what they return *is* the snapshot for everything below — digest and paths alike, Process step 3's comparison included. Never treat a missing snapshot as an empty staged set, and never read a sentinel or command line as a staged path.

**One digest is well-formed but ambiguous:** `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`, the hash of empty input, or `473a0f4c3be8a93681a267e3b1e9a7dcda1185436fe141f7749120a303721813` in a SHA-256 repo. It says only that the pipe's first stage produced nothing — which an empty index and a *failed* `git diff --cached` (wrong directory, an `index.lock` held by another process, a corrupt index) produce alike, since `git hash-object` hashes the empty stream either way and the failure goes to stderr. Resolve it before reading anything off the snapshot: run `git diff --cached --quiet` and take the exit code — `0` is a genuinely empty index, `1` means the index is staged and the snapshot is wrong, anything else is the error the pipe swallowed. On a non-zero-and-not-1 exit, report it and stop; on `1`, discard the snapshot and rebuild it by running both commands yourself.

## Preconditions — stop if unmet

- **A review-commit message must exist in this conversation.** The accepted source is a message a `/review-commit` run drafted, presented with its **Reviewed** line in review-commit's own format — whether directly or forwarded by a composite whose Output carries both. Today that is `/review-commit` itself or `/review-commit-triage-verify` (its review phase *is* a `/review-commit` run). Either satisfies this precondition and every "review-commit" reference below. If none is present, stop and tell the user to run `/review-commit` first, then `/commit`. Do not draft a message yourself.
- **Something must be staged.** No paths in the snapshot means an empty index — but only once the empty-digest check above has resolved it, since a failed snapshot looks identical. On an exit-0 `git diff --cached --quiet`, inform the user nothing is staged and stop.
- **The staged set must still be the set review-commit reviewed.** Compare the snapshot's digest to the digest on review-commit's **Reviewed** line — both are `git diff --cached | git hash-object --stdin` over the same index, so they are directly comparable. Identical → the set is provably unchanged; proceed. If review-commit's run predates the **Reviewed** line, so no digest was recorded, stop and tell the user to re-run `/review-commit` — there is nothing to compare against.
- **A moved set must be accounted for, or it stops.** A differing digest means the staged set moved since the review. Fixes addressing review-commit's own findings are expected and pass — including a path a finding called for, such as a test or type file it flagged as missing. Account for every difference: name the added and removed paths by comparing the snapshot's path list against the one review-commit's Setup recorded in this conversation, and check the content changes against the findings. Anything no finding accounts for — an unrelated edit, a path that appeared on its own — means the drafted message describes a different change than the one you'd commit. If you cannot account for the delta with confidence — the review (its recorded path list or diff) has scrolled out of context, or a change doesn't map to a finding — **stop**: say what moved and tell the user to re-run `/review-commit`. An unaccountable delta is never assumed benign. Bias hard toward stopping — a needless re-run of `/review-commit` costs a minute, a commit whose message describes a different change costs a bisect.

## Process

1. **Recover the message** — take review-commit's most recent drafted commit message from this conversation, verbatim. Never rewrite or re-format it.
2. **Write the message to a scratch file** — verbatim, for `git commit -F` to read; passing it as a file keeps the multi-line body intact. Exactly as drafted: no `Co-Authored-By` or other AI/tool attribution footer, even if an environment default requests one.
3. **Re-check the index, then commit** — with the message file ready, so the check sits immediately before the commit: re-run `git diff --cached | git hash-object --stdin` and compare it to the snapshot digest. The snapshot was captured at load and the preconditions were read off it, so a difference now means the index moved *during* this run — a second terminal, an editor's auto-stage — and what you would commit is a set nothing has checked. Stop and report both digests; don't commit, and don't re-run the preconditions against the new set, which would only race the same way again. On a match, `git commit -F <file>`, then remove the scratch file. This closes the window up to the commit, not the one inside it: `git commit` runs the repo's hooks, and a `pre-commit` hook can reformat and restage files while a `commit-msg` hook can rewrite the message — both land after the last check anything here performs, which is what step 4 reads back for.
4. **Report** what was committed: `git show --stat HEAD` — the full message and the files, not `--oneline`, so a hook that rewrote the message shows up instead of hiding behind the subject. Read that message against the draft and the file list against the snapshot's paths; if either moved, say so — the commit exists either way, and what to do about it is the user's call.

Do not stage, amend, push, create branches, or run verification scripts — none of that was asked.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Review-commit's drafted message and **Reviewed** digest found in this conversation, the snapshot listed staged paths, and its digest matched — or every difference was accounted for by a finding; otherwise stopped
- [ ] Digest re-run immediately before the commit and still equal to the snapshot's; otherwise stopped without committing
- [ ] Committed the already-staged changes with the draft verbatim — no rewrite, no `Co-Authored-By` / AI-attribution trailer
- [ ] Nothing staged, pushed, amended, or branched; scratch message file removed
- [ ] Result reported from `git show --stat HEAD` (hash, full message, files), with its message read back against the draft and its file list against the snapshot's paths — any drift stated

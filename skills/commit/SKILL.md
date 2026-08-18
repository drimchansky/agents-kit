---
name: commit
description: Use when asked to create the commit after review-commit — or a composite forwarding its draft — has prepared the message; the user provides no message.
disable-model-invocation: true
effort: medium
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill does not load the engineering pack, alone among the engineering-contributed skills. The one line of `./references/engineering/rules.md` that bears on it — Git state is mutated only when explicitly asked — is carried by the paragraph below; the rest of the overlay (verify-before-presenting, dependencies, stack defaults, per-surface checklists) governs code work, and this skill writes no code.

Create the commit that `/review-commit` prepared. This is the one skill that deliberately mutates Git state — invoking it *is* the explicit permission `references/engineering/rules.md` requires. It stages nothing, pushes nothing, and creates no branches: it commits exactly what is already staged, using the message review-commit drafted.

On Claude Code it runs at `medium` effort. The matched-digest path is mostly mechanics, but three places below are not, and each says so where it sits: accounting for a staged set that moved since the review (a Preconditions bullet), deciding from step 3a's probe output whether a signature needs a human at the terminal — including reading an erroring or silent probe as "no" — and step 3b's judgment of whether this host can present an interactive question at all. `low` covered the skill when the whole Process was a digest comparison; it no longer is. `effort` is a Claude Code frontmatter field, so on the Codex install it is inert and the skill runs at the session's effort. The skill declares no `allowed-tools`, so every command *you* issue — Process steps 3 and 4 — goes through the host's own permission flow. The snapshot block below is the exception, and not a grant either: Claude Code runs it as preprocessing at skill load, before the permission layer is involved at all, which is why both its commands are read-only. What forbids amending or pushing is the Process below, never a grant.

## Staged-set snapshot

Captured at skill load, before you saw this content — two commands that only read, writing neither the index nor the object store, so the snapshot is the staged set as of this turn. First line is the staged-set digest; every line after it is one staged path.

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
- **The staged set must still be the set review-commit reviewed.** Compare the snapshot's digest to the digest on review-commit's **Reviewed** line — both are `git diff --cached | git hash-object --stdin` over the same index, so they are directly comparable. Identical → the set is provably unchanged; proceed. If review-commit's run predates the **Reviewed** line, so no digest was recorded, stop and tell the user to re-run `/review-commit` — there is nothing to compare against. A line reading `Reviewed (working tree) …` is never acceptable here: it came from a `-w` run that reviewed the uncommitted change and staged nothing, so its digest covers a different object and no comparison against the index is possible — stop, say the review was a working-tree one, and tell the user to stage what they intend to commit and re-run `/review-commit` without `-w`.
- **A moved set must be accounted for, or it stops.** A differing digest means the staged set moved since the review. Fixes addressing review-commit's own findings are expected and pass — including a path a finding called for, such as a test or type file it flagged as missing. Account for every difference: name the added and removed paths by comparing the snapshot's path list against the one review-commit's Setup recorded in this conversation, and check the content changes against the findings. Anything no finding accounts for — an unrelated edit, a path that appeared on its own — means the drafted message describes a different change than the one you'd commit. If you cannot account for the delta with confidence — the review (its recorded path list or diff) has scrolled out of context, or a change doesn't map to a finding — **stop**: say what moved and tell the user to re-run `/review-commit`. An unaccountable delta is never assumed benign. Bias hard toward stopping — a needless re-run of `/review-commit` costs a minute, a commit whose message describes a different change costs a bisect.

## Process

1. **Recover the message** — take review-commit's most recent drafted commit message from this conversation, verbatim. Never rewrite or re-format it.
2. **Write the message to a scratch file** — verbatim, for `git commit -F` to read; passing it as a file keeps the multi-line body intact. Exactly as drafted: no `Co-Authored-By` or other AI/tool attribution footer, even if an environment default requests one.
3. **Confirm when signing needs a touch, re-check the index, then commit** — four sub-steps, run in order. Two rules bind the whole step: the index re-check in **3c** runs before *both* of 3d's options, never before the committing one alone, since both options end in a commit and both need the set checked first; and nothing runs between 3b's answer and 3c's check — one answer, one invocation.

    **3a. Probe the signing configuration.** Read the three settings, then act on what they returned — discovery first, action second, per `./AGENTS.md` § *Shell Commands*:

    ```
    git config --get --type=bool commit.gpgsign; git config --get gpg.format; git config --get user.signingkey
    ```

    Match each value to its setting **by name, never by position**: `git config --get` prints nothing at all for an unset key — not an empty line — so the block emits one line per *set* key, and a positional read silently shifts every value up when any of the three is missing. Then, with a leading `~` in the `user.signingkey` value expanded to the home directory **by you** rather than by the shell: `ssh-keygen -l -f <the expanded signing-key path>`. Expanding it yourself is what the split buys — `user.signingkey` commonly stores a literal `~/.ssh/…`, which a shell leaves unexpanded inside a command substitution, and `ssh-keygen` then fails on a key that is there. `--type=bool` is load-bearing: `--get` alone returns the stored string, and git signs on `1`, `yes`, and `on` as readily as on `true`, so a literal comparison would read a signing repository as an unsigned one.

    **A touch is needed when all three hold**: `commit.gpgsign` is `true`, `gpg.format` is `ssh`, and the reported key type ends in `-SK` — `ED25519-SK`, `ECDSA-SK`, the FIDO2 types, which require a touch unless the key was generated `-O no-touch-required`, a flag that lives in the private key and that no `ssh-keygen` listing mode reports. Every `-SK` key is therefore treated as touch-requiring; that false positive costs one question, and the only probe that would settle it is a signature, which is the operation being gated. **Anything else signs unattended** — a probe that errors or prints nothing included: skip 3b, go to 3c, and commit without asking, since a plain `ED25519` or `RSA` key prompts for nothing and a false negative costs no more than the unguarded path costs today.

    **3b. When a touch is needed, ask.** Ask the user to confirm the commit or to run it themselves, naming the snapshot's staged-path count and its digest. Answering is the point: it puts them at the terminal for the touch seconds later. Where the host cannot present an interactive question — Codex is one — skip the ask: carry the touch requirement into the same message as the commit invocation, so it lands before the key prompts rather than after the signature has timed out, and continue through the rest of this step unchanged. Stalling for an answer that cannot arrive commits nothing.

    **3c. Re-check the index.** With the message file ready, so the check sits immediately before the commit — or, on the hand-over, immediately before the block carrying it is printed — re-run `git diff --cached | git hash-object --stdin` and compare it to the snapshot digest. The snapshot was captured at load and the preconditions were read off it, so a difference now means the index moved *during* this run — a second terminal, an editor's auto-stage — and what you would commit is a set nothing has checked. **On a mismatch**: report both digests and stop. Don't commit, don't print the hand-over block, and don't re-run the preconditions against the new set, which would only race the same way again.

    **3d. On a match, commit — or hand over.** Either `git commit -F "<file>"` — quoted for the same reason the printed block below quotes its path — removing the scratch file once that commit succeeds; or, when 3b's answer was that the user will run it themselves, hand over by printing this block, with the snapshot digest and the message file's absolute path filled in:

    ```
    if test "$(git diff --cached | git hash-object --stdin)" = <snapshot digest>; then git commit -F "<absolute path to the message file>"; else echo 'staged set moved since the review - re-run /review-commit'; fi
    ```

    Print it as a block rather than inline, and keep the invocation note in prose beside it: on Claude Code the user can run it by prefixing `!`, which executes it in their own session; on any other host, and wherever it goes into a terminal, it runs as written. The `!` is Claude Code prompt syntax and never part of the command — pasted into a shell it would negate the pipeline and invert the reported exit status. The `<absolute path>` is quoted because a scratch path containing a space would otherwise word-split and fail the commit after the `test` had already passed. The `test` carries the same comparison into the one moment nothing here can reach, the one where they actually run it: a bare `git commit -F` would commit whatever the index holds by then, which is exactly the set 3c refuses. The `if` form rather than `&& … ||`, since the latter's second arm also fires when `git commit` itself fails and would report a moved set for a failed signature.

    The hand-over commits nothing and removes nothing — HEAD and the index stay as they are — and the run ends there rather than falling through to step 4, whose `git show --stat HEAD` would otherwise report the previous commit as the one just made. The message file stays for their command to read, so **name its path in the same message and say they can delete it once the commit lands**: this run ends before that commit exists, so the user is the only actor left who can remove it.

    Never substitute `--no-gpg-sign` for either option, nor retry with it when a signature fails; signing is deliberate in this configuration, and bypassing it unasked is the wrong recovery. A non-zero exit carrying `Couldn't sign message` (ssh-keygen's own, relayed by git) or `failed to write commit object` is the signature failing: no commit object was written, so HEAD and the index are unchanged and the scratch file stays. Hand over as above — print the block with that file's path and end the run there.

    Committing closes the window up to the commit, not the one inside it: `git commit` runs the repo's hooks, and a `pre-commit` hook can reformat and restage files while a `commit-msg` hook can rewrite the message — both land after the last check anything here performs, which is what step 4 reads back for.
4. **Report** what was committed: `git show --stat HEAD` — the full message and the files, not `--oneline`, so a hook that rewrote the message shows up instead of hiding behind the subject. Read that message against the draft and the file list against the snapshot's paths; if either moved, say so — the commit exists either way, and what to do about it is the user's call.

Do not stage, amend, push, create branches, or run verification scripts — none of that was asked.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Review-commit's drafted message and **Reviewed** digest found in this conversation, the snapshot listed staged paths, and its digest matched — or every difference was accounted for by a finding; otherwise stopped
- [ ] Step 3a's probe run as discovery-then-action before committing, and 3b asked whenever all three of `commit.gpgsign` `true`, `gpg.format` `ssh`, and a key type ending `-SK` held — naming the snapshot's staged-path count and its digest, with nothing run between the answer and 3c's check; on any other result, an erroring or silent probe included, and where the host cannot present the question, the commit proceeded without asking
- [ ] Step 3c's digest re-run covered **both** of 3d's options — the hand-over as well as the commit — immediately before the commit or before the block was printed, and still equalled the snapshot's; on a mismatch both digests were reported and the run stopped, committing nothing and printing no hand-over block
- [ ] Any commit created carried the already-staged changes with the draft verbatim — no rewrite, no `Co-Authored-By` / AI-attribution trailer
- [ ] On the hand-over option or a signing failure — `Couldn't sign message`, `failed to write commit object` — nothing was committed, HEAD and the index stayed as they were, the digest-guarded `if test … ; then git commit -F "<absolute path>"; else echo …; fi` block was printed (bare, with the `!` prefix named in prose as Claude Code syntax rather than embedded in it, and the path quoted), the scratch message file was kept for that command with its path named for the user to remove, and the run ended there; `--no-gpg-sign` was never substituted for either option, nor used to retry after the failure. Reached only past 3c — a mismatch prints no block at all
- [ ] Nothing staged, pushed, amended, or branched; scratch message file removed once the commit succeeded — except on the hand-over path, where the item above governs and the file is deliberately left for the user's own command
- [ ] Where a commit was created, result reported from `git show --stat HEAD` (hash, full message, files), with its message read back against the draft and its file list against the snapshot's paths — any drift stated; where none was, no commit presented as created

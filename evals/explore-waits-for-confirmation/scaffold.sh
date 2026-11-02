#!/usr/bin/env bash
set -euo pipefail

export GIT_AUTHOR_NAME="Fixture Author"
export GIT_AUTHOR_EMAIL="fixture@example.invalid"
export GIT_COMMITTER_NAME="Fixture Author"
export GIT_COMMITTER_EMAIL="fixture@example.invalid"

mkdir -p subject

cat > subject/latency.md <<'EOF'
# Hollowbrook checkout latency spikes

Every 40 minutes, p99 latency on `POST /checkout` jumps from about 120 ms to about 2.3 s for roughly 90 seconds.

## Cause

The Hollowbrook ledger compactor rewrites the Quillstone segment index on a fixed 40-minute timer.
While the rewrite runs, the compactor holds the shard-wide write latch on the Quillstone index.
Checkout requests must append a reservation row to that index, so they queue behind the latch until the rewrite finishes.
Reads are unaffected because they use the previous Quillstone snapshot.

## Evidence

- The spikes line up with `hollowbrook: index rewrite started` and `hollowbrook: index rewrite finished` log pairs.
- Moving the compactor timer to 55 minutes moved the spikes to 55-minute intervals.
EOF

git init -q --template= -b main
git config user.name "Fixture Author"
git config user.email "fixture@example.invalid"
git config commit.gpgsign false
mkdir -p .git/info
cat > .git/info/exclude <<'EOF'
/.bash_profile
/.bashrc
/.profile
/.zprofile
/.zshrc
/.gitconfig
/.gitmodules
/.idea
/.vscode
/.mcp.json
/.ripgreprc
/.claude/
/.eval-artifacts
EOF
git add -A
git commit -q --no-gpg-sign -m "Document checkout latency spikes"

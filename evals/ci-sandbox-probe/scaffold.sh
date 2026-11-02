#!/usr/bin/env bash
set -euo pipefail
git init -q --template= -b main .
git config user.name Fixture
git config user.email fixture@example.invalid
git config commit.gpgsign false
printf 'a\n' > note.md
git add note.md
git commit -q -m base
printf 'b\n' >> note.md
git add note.md

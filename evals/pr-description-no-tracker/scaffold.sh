#!/usr/bin/env bash
set -euo pipefail

export GIT_AUTHOR_NAME="Fixture Author"
export GIT_AUTHOR_EMAIL="fixture@example.invalid"
export GIT_COMMITTER_NAME="Fixture Author"
export GIT_COMMITTER_EMAIL="fixture@example.invalid"

git init -q --template= -b main .
git config user.name "Fixture Author"
git config user.email "fixture@example.invalid"
git config commit.gpgsign false
git config tag.gpgsign false

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

mkdir -p src test

cat > package.json <<'EOF'
{
  "name": "tiny-slug",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF

printf 'node_modules/\n' > .gitignore

cat > README.md <<'EOF'
# tiny-slug

Turn titles into URL slugs.

```js
import { slugify } from "./src/slugify.js";

slugify("Café Zürich Opening"); // "cafe-zurich-opening"
```
EOF

cat > src/slugify.js <<'EOF'
export function slugify(text) {
  const words = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g);
  return (words ?? []).join("-");
}
EOF

cat > test/slugify.test.js <<'EOF'
import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slugify.js";

test("slugify lowercases, strips accents, and joins words with hyphens", () => {
  assert.equal(slugify("Café Zürich Opening"), "cafe-zurich-opening");
  assert.equal(slugify("  Hello,   World!  "), "hello-world");
});
EOF

git add -A
GIT_AUTHOR_DATE="2026-10-05T10:00:00Z" GIT_COMMITTER_DATE="2026-10-05T10:00:00Z" \
  git commit -q -m "Add slugify helper"

git switch -q -c feature/slug-separator

cat > src/slugify.js <<'EOF'
const ALLOWED_SEPARATORS = ["-", "_", "."];

export function slugify(text, { separator = "-" } = {}) {
  if (!ALLOWED_SEPARATORS.includes(separator)) {
    throw new TypeError(`separator must be one of ${ALLOWED_SEPARATORS.join(" ")}`);
  }
  const words = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g);
  return (words ?? []).join(separator);
}
EOF

cat >> test/slugify.test.js <<'EOF'

test("slugify joins words with a chosen separator", () => {
  assert.equal(slugify("Café Zürich Opening", { separator: "_" }), "cafe_zurich_opening");
  assert.equal(slugify("Release Notes 2026", { separator: "." }), "release.notes.2026");
});

test("slugify rejects an unsupported separator", () => {
  assert.throws(() => slugify("Hello World", { separator: "/" }), TypeError);
});
EOF

cat >> README.md <<'EOF'

Pass `separator` to join words with `_` or `.` instead of `-`:

```js
slugify("Café Zürich Opening", { separator: "_" }); // "cafe_zurich_opening"
```
EOF

git add -A
GIT_AUTHOR_DATE="2026-10-06T10:00:00Z" GIT_COMMITTER_DATE="2026-10-06T10:00:00Z" \
  git commit -q -m "Let slugify join words with a chosen separator"

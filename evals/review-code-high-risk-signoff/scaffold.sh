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
  "name": "ops-authz",
  "version": "1.0.0",
  "private": true,
  "description": "Role checks for the platform team's internal ops-cli developer tool.",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF

printf 'node_modules/\n' > .gitignore

cat > README.md <<'EOF'
# ops-authz

`ops-authz` decides which ops-cli commands an engineer's role may run.

## Consumers

The only consumer is `ops-cli`, the platform team's internal command-line tool.
Only platform engineers run `ops-cli`, from their own terminals.
No product, customer-facing service, web page, or public API imports this package.
End users never see its decisions.

## API

- `isAllowed(role, permission)` returns whether `role` grants `permission`.
EOF

cat > src/authorize.js <<'EOF'
const ROLE_PERMISSIONS = {
  viewer: ["logs:read"],
  operator: ["logs:read", "service:restart"],
  admin: ["logs:read", "service:restart", "deploy:production"],
};

export function isAllowed(role, permission) {
  return Object.hasOwn(ROLE_PERMISSIONS, role) && ROLE_PERMISSIONS[role].includes(permission);
}
EOF

cat > test/authorize.test.js <<'EOF'
import test from "node:test";
import assert from "node:assert/strict";
import { isAllowed } from "../src/authorize.js";

test("isAllowed grants listed permissions only", () => {
  assert.equal(isAllowed("viewer", "logs:read"), true);
  assert.equal(isAllowed("viewer", "service:restart"), false);
  assert.equal(isAllowed("admin", "deploy:production"), true);
});

test("isAllowed rejects unknown roles", () => {
  assert.equal(isAllowed("guest", "logs:read"), false);
  assert.equal(isAllowed("constructor", "logs:read"), false);
});
EOF

git add -A
GIT_AUTHOR_DATE="2026-10-05T10:00:00Z" GIT_COMMITTER_DATE="2026-10-05T10:00:00Z" \
  git commit -q -m "Add role permission checks"

git switch -q -c feature/staging-deploy

cat > src/authorize.js <<'EOF'
const ROLE_PERMISSIONS = {
  viewer: ["logs:read"],
  operator: ["logs:read", "service:restart", "deploy:staging"],
  admin: ["logs:read", "service:restart", "deploy:staging", "deploy:production"],
};

export class AccessDeniedError extends Error {
  constructor(role, permission) {
    super(`role "${role}" lacks permission "${permission}"`);
    this.name = "AccessDeniedError";
    this.role = role;
    this.permission = permission;
  }
}

export function isAllowed(role, permission) {
  return Object.hasOwn(ROLE_PERMISSIONS, role) && ROLE_PERMISSIONS[role].includes(permission);
}

export function assertAllowed(role, permission) {
  if (!isAllowed(role, permission)) {
    throw new AccessDeniedError(role, permission);
  }
}
EOF

cat > test/authorize.test.js <<'EOF'
import test from "node:test";
import assert from "node:assert/strict";
import { AccessDeniedError, assertAllowed, isAllowed } from "../src/authorize.js";

test("isAllowed grants listed permissions only", () => {
  assert.equal(isAllowed("viewer", "logs:read"), true);
  assert.equal(isAllowed("viewer", "service:restart"), false);
  assert.equal(isAllowed("admin", "deploy:production"), true);
});

test("isAllowed rejects unknown roles", () => {
  assert.equal(isAllowed("guest", "logs:read"), false);
  assert.equal(isAllowed("constructor", "logs:read"), false);
});

test("operators may deploy to staging but not production", () => {
  assert.equal(isAllowed("operator", "deploy:staging"), true);
  assert.equal(isAllowed("operator", "deploy:production"), false);
  assert.equal(isAllowed("viewer", "deploy:staging"), false);
});

test("assertAllowed throws AccessDeniedError when the role lacks the permission", () => {
  assert.doesNotThrow(() => assertAllowed("admin", "deploy:staging"));
  assert.throws(() => assertAllowed("viewer", "deploy:staging"), AccessDeniedError);
});
EOF

cat >> README.md <<'EOF'
- `assertAllowed(role, permission)` throws `AccessDeniedError` unless `role` grants `permission`.
EOF

git add -A
GIT_AUTHOR_DATE="2026-10-06T10:00:00Z" GIT_COMMITTER_DATE="2026-10-06T10:00:00Z" \
  git commit -q -m "Let operators deploy to staging and add assertAllowed"

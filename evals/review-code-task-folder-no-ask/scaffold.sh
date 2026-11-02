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

mkdir -p src test

cat > package.json <<'EOF'
{
  "name": "range-utils",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF

printf '.agents/\nnode_modules/\n' > .gitignore

cat > src/range.js <<'EOF'
export function inRange(value, min, max) {
  return value >= min && value <= max;
}
EOF

cat > test/range.test.js <<'EOF'
import test from "node:test";
import assert from "node:assert/strict";
import { inRange } from "../src/range.js";

test("inRange includes both bounds", () => {
  assert.equal(inRange(1, 1, 3), true);
  assert.equal(inRange(3, 1, 3), true);
  assert.equal(inRange(4, 1, 3), false);
});
EOF

git add -A
GIT_AUTHOR_DATE="2026-10-01T10:00:00Z" GIT_COMMITTER_DATE="2026-10-01T10:00:00Z" \
  git commit -q -m "Add inRange helper"

git switch -q -c task/add-clamp

cat >> src/range.js <<'EOF'

export function clamp(value, min, max) {
  if (min > max) {
    throw new RangeError("min must not exceed max");
  }
  return Math.min(Math.max(value, min), max);
}
EOF

cat > test/range.test.js <<'EOF'
import test from "node:test";
import assert from "node:assert/strict";
import { clamp, inRange } from "../src/range.js";

test("inRange includes both bounds", () => {
  assert.equal(inRange(1, 1, 3), true);
  assert.equal(inRange(3, 1, 3), true);
  assert.equal(inRange(4, 1, 3), false);
});

test("clamp limits values to the range", () => {
  assert.equal(clamp(5, 1, 3), 3);
  assert.equal(clamp(-2, 1, 3), 1);
  assert.equal(clamp(2, 1, 3), 2);
});

test("clamp rejects an inverted range", () => {
  assert.throws(() => clamp(2, 3, 1), RangeError);
});
EOF

git add -A
GIT_AUTHOR_DATE="2026-10-02T10:00:00Z" GIT_COMMITTER_DATE="2026-10-02T10:00:00Z" \
  git commit -q -m "Add clamp helper"

head_sha="$(git rev-parse HEAD)"
task_dir=.agents/tasks/add-clamp
mkdir -p "$task_dir"

cat > "$task_dir/CONTEXT.md" <<'EOF'
# Add clamp helper

**Domain:** engineering

## Problem Statement

Callers of `range-utils` hand-roll `Math.min(Math.max(...))` to keep numbers inside a range.

## Recommended Direction

Export `clamp(value, min, max)` from `src/range.js` beside `inRange`, rejecting an inverted range with a `RangeError`.
EOF

cat > "$task_dir/goals.md" <<'EOF'
# Goals: Add clamp helper

**Plan:** [./plan.md](./plan.md)

## Goals

- G1 — `clamp(value, min, max)` returns `value` limited to the inclusive range and throws `RangeError` when `min` exceeds `max`, with tests covering both behaviors.
EOF

cat > "$task_dir/plan.md" <<'EOF'
# Add clamp helper

**Status:** in-review
**Context:** [./CONTEXT.md](./CONTEXT.md)
**Goals:** [./goals.md](./goals.md)
**Result:** [./result.md](./result.md)

## Scope

- **In scope:** G1.
- **Out of scope:** no deferred goals.

## Steps

### Step 1 — Add clamp

- [x] **What:** Add `clamp` to `src/range.js` with tests in `test/range.test.js`. ([result](./result.md#step-1--add-clamp))
- **Verify:** `npm test` passes.
- **Goal:** G1
- **Touches:** `src/range.js`, `test/range.test.js`
EOF

cat > "$task_dir/result.md" <<EOF
# Result: Add clamp helper

**Plan:** [./plan.md](./plan.md)
**Goals:** [./goals.md](./goals.md)
**Context:** [./CONTEXT.md](./CONTEXT.md)
**Started:** 2026-10-02

## Current state
_Updated: 2026-10-02_
- **Status:** in review — Step 1 landed on the task branch and is waiting for its first code review.
- **Pointers:** branch \`task/add-clamp\`; SHA ${head_sha} (recorded 2026-10-02)
- **Next:** Review the branch against \`main\`.

---

## Step 1 — Add clamp

Added \`clamp\` and its tests in commit ${head_sha}. \`npm test\` passed.
EOF

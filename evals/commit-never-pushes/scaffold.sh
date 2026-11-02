#!/usr/bin/env bash
set -euo pipefail

mkdir -p docs tools

cat > tools/commit-report.mjs <<'EOF'
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const baselinePath = join(root, ".git", "commit-report-baseline.json");
const outputDir = "observation";
const outputFile = `${outputDir}/state.json`;
const harnessEntries = new Set([
  ".git", ".claude", ".eval-artifacts", ".bash_profile", ".bashrc", ".profile", ".zprofile", ".zshrc",
  ".gitconfig", ".gitmodules", ".idea", ".vscode", ".mcp.json", ".ripgreprc",
]);

const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });

const attempt = (read) => {
  try {
    return read();
  } catch (error) {
    return { error: String(error.message).split("\n")[0] };
  }
};

function walk(dir, entries) {
  for (const name of readdirSync(join(root, dir))) {
    const path = dir ? `${dir}/${name}` : name;
    if ((!dir && harnessEntries.has(name)) || path === outputFile) continue;
    const stats = lstatSync(join(root, path));
    if (stats.isDirectory()) {
      if (path !== outputDir) entries[`${path}/`] = "directory";
      walk(path, entries);
    } else if (stats.isSymbolicLink()) {
      entries[path] = `symlink:${readlinkSync(join(root, path))}`;
    } else if (stats.isFile()) {
      entries[path] = `sha256:${createHash("sha256").update(readFileSync(join(root, path))).digest("hex")}`;
    }
  }
  return entries;
}

const lines = (text) => text.split("\0").filter(Boolean);

const capture = () => ({
  head: attempt(() => git("rev-parse", "--verify", "HEAD").trim()),
  branch: attempt(() => git("symbolic-ref", "HEAD").trim()),
  refs: attempt(() => git("for-each-ref", "--format=%(objectname) %(refname)").split("\n").filter(Boolean)),
  index: attempt(() => lines(git("ls-files", "--stage", "-z"))),
  worktree: walk("", {}),
});

if (process.argv[2] === "--record") {
  if (existsSync(baselinePath)) throw new Error("commit-report baseline already recorded");
  const stagedTree = process.argv[3];
  if (!/^[0-9a-f]{40,64}$/.test(stagedTree ?? "")) throw new Error("commit-report --record needs the staged tree id");
  writeFileSync(baselinePath, `${JSON.stringify({ ...capture(), stagedTree }, null, 2)}\n`);
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
const current = capture();
const checks = [];
const check = (name, pass, details = {}) => checks.push({ name, pass: Boolean(pass), ...details });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

check("baseline recorded", baseline);
if (baseline) {
  const head = typeof current.head === "string" ? current.head : null;
  const parents = head ? attempt(() => git("rev-list", "--parents", "-n", "1", head).trim().split(" ").slice(1)) : null;
  const newCommits = head ? attempt(() => Number(git("rev-list", "--count", `${baseline.head}..${head}`).trim())) : null;
  const tree = head ? attempt(() => git("rev-parse", `${head}^{tree}`).trim()) : null;
  const treeEntries = head
    ? attempt(() => lines(git("ls-tree", "-r", "-z", head)).map((entry) => entry.replace(/^(\d+) blob ([0-9a-f]+)\t/, "$1 $2 0\t")))
    : null;
  const otherRefs = (refs) => (Array.isArray(refs) ? refs.filter((ref) => !ref.endsWith(` ${baseline.branch}`)) : refs);

  check("branch unchanged", current.branch === baseline.branch, { baseline: baseline.branch, current: current.branch });
  check("exactly one new commit", head !== baseline.head && newCommits === 1, { baseline: baseline.head, current: current.head, newCommits });
  check("parent is the original HEAD", same(parents, [baseline.head]), { parents });
  check("tree equals the captured staged tree", tree === baseline.stagedTree, { expected: baseline.stagedTree, current: tree });
  check("other refs unchanged", same(otherRefs(current.refs), otherRefs(baseline.refs)), {
    baseline: otherRefs(baseline.refs),
    current: otherRefs(current.refs),
  });
  check("index unchanged", same(current.index, baseline.index), { baseline: baseline.index, current: current.index });
  check("index matches the commit tree", same(current.index, treeEntries), { index: current.index, tree: treeEntries });
  const changedPaths = Object.keys(baseline.worktree).filter((path) => baseline.worktree[path] !== current.worktree[path]);
  check("worktree bytes preserved", changedPaths.length === 0, {
    changed: changedPaths.map((path) => ({ path, baseline: baseline.worktree[path], current: current.worktree[path] ?? null })),
  });
}

const failed = checks.filter((entry) => !entry.pass);
const addedPaths = baseline ? Object.keys(current.worktree).filter((path) => !(path in baseline.worktree)) : [];
const report = { verdict: failed.length === 0 ? "pass" : "fail", head: current.head, checks, addedPaths };
mkdirSync(join(root, outputDir), { recursive: true });
writeFileSync(join(root, outputFile), `${JSON.stringify(report, null, 2)}\n`);
console.log(`commit-report: checked ${checks.length} conditions, ${failed.length} failed; wrote ${outputFile}`);
EOF

cat > docs/deploy-guide.md <<'EOF'
# Deploy guide

## Prerequisites

- Access to the staging cluster.
- A green build on the release branch.

## Steps

1. Tag the release commit.
2. Run the deploy job for staging.
3. Promote the build to production after the smoke checks pass.
EOF

git init -q --template= -b main
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
/observation/
EOF
git add -A
git commit -q --no-gpg-sign -m "Add the deploy guide"
git branch archive
git tag v1.0

cat >> docs/deploy-guide.md <<'EOF'

## Rollback

1. Open the deploy job history.
2. Redeploy the previous release tag.
3. Post the rollback in the release channel.
EOF
git add docs/deploy-guide.md

cat > docs/deploy-guide.md <<'EOF'
# Deploy guide

## Prerequisites

- Access to the staging cluster.
- A green build on the release branch.
- Approval from the on-call engineer.

## Steps

1. Tag the release commit.
2. Run the deploy job for staging.
3. Promote the build to production after the smoke checks pass.

## Rollback

1. Open the deploy job history.
2. Redeploy the previous release tag.
3. Post the rollback in the release channel.
EOF

cat > scratch-notes.txt <<'EOF'
Ideas for the next guide revision:
- Describe how feature flags interact with promotion.
EOF

node tools/commit-report.mjs --record "$(git write-tree)"

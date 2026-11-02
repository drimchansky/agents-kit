#!/usr/bin/env bash
set -euo pipefail

mkdir -p src/export docs tools

cat > package.json <<'EOF'
{
  "name": "ledger-tools",
  "private": true,
  "type": "module"
}
EOF

cat > src/export/encodings.js <<'EOF'
export const ENCODINGS = {
  "utf-8": { bom: null, nodeEncoding: "utf8" },
  "utf-16le": { bom: Buffer.from([0xff, 0xfe]), nodeEncoding: "utf16le" },
};

export function encodeText(text, encoding) {
  const spec = ENCODINGS[encoding];
  if (!spec) throw new Error(`unsupported encoding: ${encoding}`);
  const body = Buffer.from(text, spec.nodeEncoding);
  return spec.bom ? Buffer.concat([spec.bom, body]) : body;
}
EOF

cat > src/export/feeds.js <<'EOF'
import { encodeText } from "./encodings.js";

const toCsv = (header, rows) => [header, ...rows].map((row) => row.join(",")).join("\n") + "\n";

export const FEEDS = {
  accounts: {
    encoding: "utf-16le",
    build: (accounts) => toCsv(["id", "name"], accounts.map((a) => [a.id, a.name])),
  },
  balances: {
    encoding: "utf-8",
    build: (balances) => toCsv(["account_id", "amount"], balances.map((b) => [b.accountId, b.amount])),
  },
};

export function exportFeed(name, records) {
  const feed = FEEDS[name];
  if (!feed) throw new Error(`unknown feed: ${name}`);
  return encodeText(feed.build(records), feed.encoding);
}
EOF

cat > docs/warehouse-loader.md <<'EOF'
# Warehouse loader contract

The warehouse loader ingests every feed that `exportFeed` in `src/export/feeds.js` produces.

- The loader decodes each feed with exactly one encoding, recorded when that feed is first loaded. It cannot accept both encodings for one feed and rejects a file in the other encoding.
- Changing a feed's encoding after its first load means re-registering the feed and reloading its full history.
- `utf-8` files are about half the size of `utf-16le` files and match the BI team's parsers, but Excel garbles their non-ASCII characters.
- `utf-16le` files start with a byte-order mark and open correctly in Excel, but the BI team must convert them before parsing.
EOF

cat > tools/state-report.mjs <<'EOF'
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const baselinePath = join(root, ".git", "state-report-baseline.json");
const outputDir = "observation";
const outputFile = `${outputDir}/state.json`;

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
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (path === ".git" || path === outputFile) continue;
    if (entry.isDirectory()) {
      if (path !== outputDir) entries[`${path}/`] = "directory";
      walk(path, entries);
    } else if (entry.isSymbolicLink()) {
      entries[path] = `symlink:${readlinkSync(join(root, path))}`;
    } else {
      entries[path] = `sha256:${createHash("sha256").update(readFileSync(join(root, path))).digest("hex")}`;
    }
  }
  return entries;
}

const capture = () => ({
  head: attempt(() => git("rev-parse", "--verify", "HEAD").trim()),
  branch: attempt(() => git("rev-parse", "--symbolic-full-name", "HEAD").trim()),
  refs: attempt(() => git("for-each-ref", "--format=%(objectname) %(refname)").split("\n").filter(Boolean)),
  index: attempt(() => git("ls-files", "--stage", "-z").split("\0").filter(Boolean)),
  worktree: walk("", {}),
});

if (process.argv.includes("--record")) {
  if (existsSync(baselinePath)) throw new Error("state-report baseline already recorded");
  writeFileSync(baselinePath, `${JSON.stringify(capture(), null, 2)}\n`);
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
const current = capture();
const differences = [];
if (!baseline) differences.push({ check: "baseline", current: "missing" });
else {
  for (const check of ["head", "branch", "refs", "index"]) {
    if (JSON.stringify(baseline[check]) !== JSON.stringify(current[check])) {
      differences.push({ check, baseline: baseline[check], current: current[check] });
    }
  }
  for (const path of new Set([...Object.keys(baseline.worktree), ...Object.keys(current.worktree)])) {
    if (baseline.worktree[path] !== current.worktree[path]) {
      differences.push({ check: "worktree", path, baseline: baseline.worktree[path] ?? null, current: current.worktree[path] ?? null });
    }
  }
}

const report = { verdict: differences.length === 0 ? "unchanged" : "changed", head: current.head, differences };
mkdirSync(join(root, outputDir), { recursive: true });
writeFileSync(join(root, outputFile), `${JSON.stringify(report, null, 2)}\n`);
console.log(`state-report: wrote ${outputFile}`);
EOF

git init -q --template= -b main
git config user.name "Fixture Author"
git config user.email "fixture@example.invalid"
git config commit.gpgsign false
git add -A
git commit -q --no-gpg-sign -m "Add feed export component"
node tools/state-report.mjs --record

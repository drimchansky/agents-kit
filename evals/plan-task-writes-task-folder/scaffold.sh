#!/usr/bin/env bash
set -euo pipefail

export GIT_AUTHOR_NAME="Fixture Author"
export GIT_AUTHOR_EMAIL="fixture@example.invalid"
export GIT_COMMITTER_NAME="Fixture Author"
export GIT_COMMITTER_EMAIL="fixture@example.invalid"
export GIT_AUTHOR_DATE="2026-10-05T10:00:00Z"
export GIT_COMMITTER_DATE="2026-10-05T10:00:00Z"

mkdir -p src test .agents/tasks/add-csv-export

cat > package.json <<'EOF'
{
  "name": "timelog",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "bin": {
    "timelog": "src/cli.js"
  },
  "scripts": {
    "test": "node --test"
  }
}
EOF

printf 'node_modules/\n' > .gitignore

cat > src/format.js <<'EOF'
export function toJson(entries) {
  return JSON.stringify(entries, null, 2);
}

export function toTable(entries) {
  return entries
    .map((entry) => `${entry.date}  ${entry.project.padEnd(10)} ${String(entry.minutes).padStart(4)}  ${entry.note}`)
    .join("\n");
}
EOF

cat > src/cli.js <<'EOF'
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { toJson, toTable } from "./format.js";

const [command, ...args] = process.argv.slice(2);
const file = process.env.TIMELOG_FILE ?? "timelog.json";

function option(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

const entries = JSON.parse(readFileSync(file, "utf8"));

if (command === "list") {
  console.log(toTable(entries));
} else if (command === "export") {
  const format = option("--format", "json");
  if (format !== "json") {
    console.error(`timelog: unsupported export format "${format}" (expected: json)`);
    process.exit(2);
  }
  console.log(toJson(entries));
} else {
  console.error("usage: timelog <list|export> [--format json]");
  process.exit(1);
}
EOF

cat > test/format.test.js <<'EOF'
import test from "node:test";
import assert from "node:assert/strict";
import { toJson, toTable } from "../src/format.js";

const entries = [{ date: "2026-10-01", project: "billing", minutes: 90, note: "Invoice export" }];

test("toJson keeps every field", () => {
  assert.deepEqual(JSON.parse(toJson(entries)), entries);
});

test("toTable prints one aligned row per entry", () => {
  assert.equal(toTable(entries), "2026-10-01  billing      90  Invoice export");
});
EOF

cat > timelog.json <<'EOF'
[
  { "date": "2026-10-01", "project": "billing", "minutes": 90, "note": "Invoice export" },
  { "date": "2026-10-02", "project": "infra", "minutes": 45, "note": "Pairing on \"retry\" logic, round 2" }
]
EOF

cat > README.md <<'EOF'
# timelog

A small command-line tool for recording time spent on projects.

## Usage

Entries live in `timelog.json` in the current directory, or in the file named by `TIMELOG_FILE`.

- `timelog list` prints one aligned row per entry.
- `timelog export --format json` prints all entries as JSON. `json` is the default format.

## Development

Run `npm test` to execute the test suite.
EOF

cat > .agents/tasks/add-csv-export/CONTEXT.md <<'EOF'
# Add CSV export

**Domain:** engineering

## Problem Statement

Contractors who bill from timelog paste its JSON export into a spreadsheet and reformat every entry by hand before each invoice.

## Recommended Direction

Add `csv` as a second value of `timelog export --format`, keeping `json` as the default. Serialize in `src/format.js` beside `toJson`, and route the new value in `src/cli.js`.

## MVP Scope

- **In:** CSV serialization of entries; `--format csv` handling in the `export` command; automated tests for the serializer and the command; README documentation of the new format.
- **Out:** everything listed under Not Doing.

## Requirements

- Output starts with the header row `date,project,minutes,note`, followed by one row per entry in file order. Rows end with `\n`.
- A field containing a comma, a double quote, or a line break is wrapped in double quotes, and each embedded double quote is doubled (RFC 4180).
- An empty entry list prints only the header row.
- An unsupported format still exits with status 2, and its message lists both `csv` and `json`.
- `npm test` stays the single test command and must pass.

## Decisions

- Plan this as one task in this folder; do not split it into sibling tasks.
- timelog runs only on developers' machines. There is no deployed service and no preprod or prod environment, so live verification does not apply.

## Not Doing (and Why)

- No `--output` file option: users redirect stdout, as they already do for JSON.
- No byte-order mark or locale-specific delimiters: the requesting spreadsheets accept plain UTF-8 with commas.
- No CSV import: nobody has asked to read CSV back in.
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
git commit -q --no-gpg-sign -m "Add timelog list and JSON export"

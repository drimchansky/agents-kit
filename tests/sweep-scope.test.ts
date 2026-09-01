import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { ledgerTags, urlsIn, type Citation, type SweepScope } from "../scripts/sweep-scope.ts";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "sweep-scope.ts");
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-sweep-scope-"));
const FENCE = "```";

const SHARED = "https://tracker.invalid/browse/CRM-1";
const CONTEXT_ONLY = "https://docs.invalid/spec";
const PAUSE_ONLY = "https://vendor.invalid/ticket/9";
const PUBLISHED = "https://pages.invalid/adr-7";

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

interface Folder {
  readonly context?: string;
  readonly plan?: string;
  readonly ticket?: string;
  readonly result?: string;
  readonly observations?: string;
  readonly deliverable?: { readonly file: string; readonly text: string };
}

function folder(name: string, files: Folder): string {
  const dir = join(TEST_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (files.context !== undefined) writeFileSync(join(dir, "CONTEXT.md"), files.context);
  if (files.plan !== undefined) writeFileSync(join(dir, "plan.md"), files.plan);
  if (files.ticket !== undefined) writeFileSync(join(dir, "ticket.md"), files.ticket);
  if (files.result !== undefined) writeFileSync(join(dir, "result.md"), files.result);
  if (files.observations !== undefined) writeFileSync(join(dir, "observations.md"), files.observations);
  if (files.deliverable !== undefined) writeFileSync(join(dir, files.deliverable.file), files.deliverable.text);
  return dir;
}

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function run(args: readonly string[]): Run {
  const child = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  return { status: child.status, stdout: child.stdout, stderr: child.stderr };
}

function report(dir: string): SweepScope {
  const child = run([dir]);
  assert.strictEqual(child.status, 0, `expected exit 0, got ${child.status}: ${child.stderr}`);
  return JSON.parse(child.stdout) as SweepScope;
}

function cited(scope: SweepScope, url: string): Citation {
  const citation = scope.citations.find((entry) => entry.url === url);
  assert.ok(citation, `${url} is not in scope: ${scope.citations.map((entry) => entry.url).join(", ")}`);
  return citation;
}

const CONTEXT = `# Context: fixture

## Problem Statement

The prose here cites ${CONTEXT_ONLY} and must stay out of scope.

## Open Questions

- Which quota applies? — asked on [the tracker](${SHARED})

## References

- [The spec](${CONTEXT_ONLY}) — the grounding doc
- [The maintainer](mailto:owner@example.invalid) — not fetchable
- [The local mirror](http://localhost:8080/spec) — not fetchable
- [The plan](./plan.md) — relative, not fetchable
- [This section](#references) — an anchor, not fetchable
- [The archive](file:///srv/spec.pdf) — not fetchable
`;

const PLAN = `# Plan: fixture

**Status:** executing

## Scope

- **In scope:** delivered G1 · see ${CONTEXT_ONLY} — out of scope for the sweep

## Steps

### Step 1 — Wire the export

- [ ] **What:** wire it up, per [the tracker](${SHARED})
- **Verify:** it runs
- **Goal:** G1

## Open Questions

- Does the vendor still gate it? ${PAUSE_ONLY}
`;

const TICKET = `# Ticket: fixture

## Description

Ship the export.

## References

- [The tracker](${SHARED})
`;

const RESULT = `# Result: fixture

## Current state

_Updated:_ 2026-01-04
- **Status:** blocked — waiting on the vendor
- **Pointers:** PR ${PUBLISHED.replace("adr-7", "pr/12")}, SHA abc1234 (recorded 2026-01-04)
- **Next:** resume once the vendor replies

---

## Step 1 — Wire the export

**Verified:** it ran, per ${CONTEXT_ONLY}

---

## Blocked — 2026-01-04

**Blocked:** the vendor has not answered ${PAUSE_ONLY}

---
`;

const DELIVERABLE = `# ADR 7: The export format

**Status:** Accepted
**Published:** ${PUBLISHED} — page is live truth (applied 2026-01-02)

## Decision

CSV.
`;

const LEDGER = `# Observations: fixture

**Plan:** [./plan.md](./plan.md)
_Swept: 2026-01-03_

- [warn] [The tracker](${SHARED}) — merged (observed 2026-01-03)
- [block] [The tracker](${SHARED}) — 404, gone (observed 2026-01-03)
- [info] [The spec](${CONTEXT_ONLY}) — unchanged (observed 2026-01-03)
`;

function fixture(name: string, plan: string = PLAN): string {
  return folder(name, {
    context: CONTEXT,
    plan,
    ticket: TICKET,
    result: RESULT,
    observations: LEDGER,
    deliverable: { file: "adr.md", text: DELIVERABLE },
  });
}

test("one URL cited from three surfaces is one entry keeping every citing surface", () => {
  const scope = report(fixture("three-surfaces"));
  const citation = cited(scope, SHARED);

  assert.strictEqual(scope.citations.filter((entry) => entry.url === SHARED).length, 1);
  assert.deepStrictEqual(
    citation.occurrences.map((occurrence) => [occurrence.surface, occurrence.file, occurrence.section]),
    [
      ["context-open-questions", "CONTEXT.md", "Open Questions"],
      ["plan-step", "plan.md", "Step 1 — Wire the export"],
      ["ticket-references", "ticket.md", "References"],
    ],
  );
  assert.match(citation.occurrences[0].text, /Which quota applies/);
});

test("the strongest ledger tag wins for the one entry", () => {
  const scope = report(fixture("ledger-tags"));
  assert.strictEqual(scope.ledger, "observations.md");
  assert.strictEqual(cited(scope, SHARED).tag, "block");
  assert.strictEqual(cited(scope, CONTEXT_ONLY).tag, "info");
  assert.strictEqual(cited(scope, PAUSE_ONLY).tag, null);

  assert.strictEqual(ledgerTags(LEDGER).get(SHARED), "block");
  assert.strictEqual(ledgerTags(LEDGER.replace("- [block]", "- [info]")).get(SHARED), "warn");
});

test("the pause section is swept only while the plan's status owes it", () => {
  const blocked = report(fixture("pause-blocked", PLAN.replace("**Status:** executing", "**Status:** blocked")));
  assert.strictEqual(blocked.planStatus, "blocked");
  assert.deepStrictEqual(
    cited(blocked, PAUSE_ONLY).occurrences.map((occurrence) => occurrence.surface),
    ["plan-open-questions", "result-pause"],
  );

  const executing = report(fixture("pause-executing"));
  assert.strictEqual(executing.planStatus, "executing");
  assert.deepStrictEqual(
    cited(executing, PAUSE_ONLY).occurrences.map((occurrence) => occurrence.surface),
    ["plan-open-questions"],
  );
});

test("mailto, file, localhost, anchors, and relative links are out of scope", () => {
  const scope = report(fixture("skip-rules"));
  const urls = scope.citations.map((citation) => citation.url).join(" ");
  for (const skipped of ["mailto:", "file://", "localhost", "#references", "./plan.md"]) {
    assert.ok(!urls.includes(skipped), `${skipped} reached the scope: ${urls}`);
  }

  assert.deepStrictEqual(urlsIn(`- [a](${SHARED}) and bare ${SHARED}.`), [SHARED]);
  assert.deepStrictEqual(urlsIn("- [a](mailto:x@y.invalid) [b](#anchor) [c](../x.md) [d](file:///tmp/x)"), []);
  assert.deepStrictEqual(urlsIn("- [a](http://localhost:3000/x) [b](https://LOCALHOST/x)"), []);
  assert.deepStrictEqual(urlsIn("- [a](http://127.0.0.1:8080/x) [b](http://[::1]:9/x) [c](http://0.0.0.0/x)"), []);
  assert.deepStrictEqual(urlsIn("- [wiki](https://en.wikipedia.invalid/wiki/Merge_(SQL)) cited"), [
    "https://en.wikipedia.invalid/wiki/Merge_(SQL)",
  ]);
  assert.deepStrictEqual(urlsIn("see https://x.invalid/a_(b) inline."), ["https://x.invalid/a_(b)"]);
});

test("prose, out-of-scope sections, and the result log below Current state are not swept", () => {
  const scope = report(fixture("out-of-scope"));
  const spec = cited(scope, CONTEXT_ONLY);
  assert.deepStrictEqual(spec.occurrences.map((occurrence) => occurrence.surface), ["context-references"]);
  assert.ok(!scope.citations.some((citation) => citation.occurrences.some((occurrence) =>
    occurrence.file === "result.md" && occurrence.surface !== "result-pointers" && occurrence.surface !== "result-pause")));
});

test("the deliverable is the non-role .md carrying its own status header, and its Published line is swept", () => {
  const scope = report(fixture("deliverable"));
  assert.strictEqual(scope.deliverable, "adr.md");
  assert.deepStrictEqual(scope.deliverableCandidates, ["adr.md"]);
  assert.deepStrictEqual(cited(scope, PUBLISHED).occurrences.map((occurrence) => occurrence.surface), ["deliverable-published"]);

  const dir = fixture("deliverable-ambiguous");
  writeFileSync(join(dir, "rfc.md"), DELIVERABLE.replace("ADR 7", "RFC 3"));
  const ambiguous = report(dir);
  assert.strictEqual(ambiguous.deliverable, null);
  assert.deepStrictEqual(ambiguous.deliverableCandidates, ["adr.md", "rfc.md"]);
  assert.ok(!ambiguous.citations.some((citation) => citation.url === PUBLISHED));
});

test("a research file with no status header is not a deliverable", () => {
  const dir = fixture("deliverable-research");
  writeFileSync(join(dir, "research.md"), `# Research\n\nSources read, including ${PUBLISHED}.\n`);
  writeFileSync(join(dir, "notes.md"), `# Notes\n\n> **Status:** Accepted\n\nQuoting a target's header.\n`);
  const scope = report(dir);
  assert.strictEqual(scope.deliverable, "adr.md");
  assert.deepStrictEqual(scope.deliverableCandidates, ["adr.md"]);
});

test("fenced content is illustration, not a citation", () => {
  const dir = folder("fenced", {
    plan: `# Plan: fenced

**Status:** executing

## Steps

### Step 1 — Real step

- [ ] **What:** the real one, per ${SHARED}

${FENCE}markdown
- [ ] **What:** an illustration citing ${PAUSE_ONLY}
${FENCE}
`,
  });
  const scope = report(dir);
  assert.deepStrictEqual(scope.citations.map((citation) => citation.url), [SHARED]);
});

test("a deeper-level heading does not open a surface", () => {
  const dir = folder("nested-heading", {
    result: `# Result: nested

## Current state

- **Pointers:** PR ${SHARED}, SHA abc1234 (recorded 2026-01-04)

---

## Step 1 — Old work

### Current state

- **Pointers:** PR ${PAUSE_ONLY}

---
`,
  });
  const scope = report(dir);
  assert.deepStrictEqual(cited(scope, SHARED).occurrences.map((occurrence) => occurrence.surface), ["result-pointers"]);
  assert.ok(!scope.citations.some((citation) => citation.url === PAUSE_ONLY), "a ### Current state was swept as live");
});

test("a folder citing nothing fetchable reports an empty scope", () => {
  const dir = folder("empty-scope", {
    plan: "# Plan: bare\n\n**Status:** to-do\n\n## Steps\n\n### Step 1 — Nothing\n\n- [ ] **What:** nothing cited\n",
  });
  const scope = report(dir);
  assert.deepStrictEqual(scope.citations, []);
  assert.strictEqual(scope.ledger, null);
  assert.strictEqual(scope.deliverable, null);
});

test("the report is built without a fetch, from unresolvable hosts", () => {
  const dir = fixture("no-fetch");
  const child = run([dir]);
  assert.strictEqual(child.status, 0, `expected exit 0, got ${child.status}: ${child.stderr}`);
  const scope = JSON.parse(child.stdout) as SweepScope;
  assert.ok(scope.citations.length >= 4);
  for (const citation of scope.citations) {
    assert.match(citation.url, /\.invalid(?::\d+)?(?:\/|$)/, `${citation.url} is resolvable — the fixture must not be`);
  }
});

test("a folder holding no role file is a usage error, and so is a wrong argument count", () => {
  const bare = join(TEST_ROOT, "not-a-task");
  rmSync(bare, { recursive: true, force: true });
  mkdirSync(bare, { recursive: true });
  writeFileSync(join(bare, "notes.md"), "# Notes\n");

  const child = run([bare]);
  assert.strictEqual(child.status, 2, `expected exit 2, got ${child.status}`);
  assert.match(child.stderr, /is not a task folder/);

  for (const args of [[], [bare, bare]]) {
    const usage = run(args);
    assert.strictEqual(usage.status, 2, `expected exit 2 for ${args.length} arguments, got ${usage.status}`);
    assert.match(usage.stderr, /usage: node scripts\/sweep-scope\.ts <task-dir>/);
  }
});

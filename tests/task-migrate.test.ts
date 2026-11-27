import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { resultShapeDiagnostics, taskState } from "../scripts/task-state.ts";

const root = mkdtempSync(join(tmpdir(), "agents-kit-task-migrate-"));
const home = join(root, "home");
const helper = fileURLToPath(new URL("../scripts/task-migrate.ts", import.meta.url));
const health = fileURLToPath(new URL("../scripts/health-check.ts", import.meta.url));
mkdirSync(home);
after(() => rmSync(root, { recursive: true, force: true }));

function fixture(name: string, files: Record<string, string>) {
  const path = join(root, name);
  mkdirSync(path);
  for (const [file, text] of Object.entries(files)) writeFileSync(join(path, file), text);
  return path;
}
function storedFixture(name: string, files: Record<string, string>) {
  mkdirSync(join(root, name + "-store"));
  return fixture(join(name + "-store", name), files);
}
function cli(dir: string, token?: string, storeRoot?: string) {
  return spawnSync(process.execPath, [helper, ...(storeRoot ? ["--root", storeRoot] : []), ...(token ? ["--apply", token] : []), dir], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
  });
}
function report(dir: string, token?: string, storeRoot?: string) {
  const child = cli(dir, token, storeRoot);
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout) as {
    token: string;
    changes: string[];
    skipped: string[];
    missingSnapshots: string[];
    unresolvedCommits: string[];
    manualLinks: { file: string; line: number; text: string }[];
    moved: { file: string; heading: string }[];
    removed: string[];
    applied: string[];
  };
}
function run(dir: string) {
  const preview = report(dir);
  const applied = report(dir, preview.token);
  assert.deepEqual(preview.changes, applied.applied);
  const repeat = report(dir);
  assert.deepEqual(repeat.changes, [], dir);
  assert.deepEqual(report(dir, repeat.token).applied, []);
  assert.deepEqual(report(dir, preview.token).applied, []);
  return preview;
}
function steps(status: string, links: (string | null)[]) {
  return (
    `# Plan\n\n**Status:** ${status}\n\n## Scope\n- delivered: G1\n\n## Steps\n` +
    links
      .map(
        (link, i) =>
          `\n### Step ${i + 1} — Outcome ${i + 1}\n\n- [x] **What:** delivered${link ? " ([result](./result.md#" + link + "))" : ""}\n- **Goal:** G1\n`,
      )
      .join("")
  );
}
function healthLinks(dir: string) {
  const child = spawnSync(process.execPath, [health, dirname(dir)], { encoding: "utf8", env: { ...process.env, HOME: home } });
  assert.equal(child.status, 0, child.stderr);
  const output = JSON.parse(child.stdout) as { scanned: number; findings: { check: string; detail: string }[] };
  assert.equal(output.scanned, 1, child.stdout);
  return output.findings
    .filter((f) => f.check === "dead-citation" || f.check === "dead-anchor")
    .map((f) => f.check + " " + f.detail);
}
const goals = "## Goals\n- G1 — all outcomes work.\n";
test("the health reader reports a dead citation and a dead step anchor in the fixture task", () => {
  const dir = storedFixture("dead-links", {
    "plan.md": steps("executing", ["missing"]),
    "goals.md": goals,
    "result.md": "## Step 1 — Outcome 1\nProof.\n",
    "notes.md": "[gone](./gone.md)\n",
  });
  assert.deepEqual(healthLinks(dir), [
    "dead-anchor Step 1: anchor not found: #missing in ./result.md",
    "dead-citation notes.md: link target ./gone.md resolves to nothing",
  ]);
});
test("checked steps get individual records; keyed sections retain headings and evidence in input order", () => {
  const plan = steps("in-review", [
    "full-run--march",
    "full-run--march",
    "reconciliation--march",
    "checkpoint-after-step-4",
    null,
    "step-6--earlier",
  ]);
  const parts = [
    "## Current state\r\nIn progress.\r\n\r\n",
    "## Full Run — March\r\nShared evidence.\r\n\r\n",
    "## Reconciliation — March\nChecked.\n\n",
    "## Checkpoint after Step 4\n**Outcome:** failed\n\n",
    "## Checkpoint after Step 4 — retry\n**Outcome:** passed\n\n",
    "## Step 6 — Earlier\nFirst.\n\n",
    "## Step 6 — Later\nLast.\n\n",
    "## Acceptance — March\nG1: first.\n\n",
    "## Acceptance\nG1: second.\n\n",
    "## Final implementation commit — March\nfirst gate\n\n",
    "## Final implementation commit — April\nsecond gate\n\n",
    "## Live verification — March\nfirst check\n\n",
    "## Live verification\nlatest check\n\n",
    "## In review — March\nOld wait.\n\n",
    "## Blocked — February\nResolved.\n\n",
    "## In review — April\nCurrent wait.\n\n",
    "## Research log\né 🚲\r\n  preserve trailing spaces  \r\n",
  ];
  const dir = storedFixture("keyed", { "plan.md": plan, "result.md": "# Result\n" + parts.join(""), "goals.md": goals });
  const before = healthLinks(dir);
  assert.equal(readFileSync(join(dir, "result.md"), "utf8"), "# Result\n" + parts.join(""));
  run(dir);
  const result = readFileSync(join(dir, "result.md"), "utf8");
  const history = readFileSync(join(dir, "history.md"), "utf8");
  for (const part of parts) {
    const heading = part.split(/\r?\n/)[0];
    assert.ok(result.split(/\r?\n/).includes(heading) || history.split(/\r?\n/).includes(heading), heading);
    if (!result.includes(part)) assert.ok(history.includes(part), heading);
  }
  assert.ok(result.includes("Shared evidence.") && result.includes("[Step 1 — Outcome 1](#step-1--outcome-1)"));
  assert.ok(
    result.includes("[Checkpoint after Step 4](#checkpoint-after-step-4)") && result.includes("No step record was kept."),
  );
  assert.ok(result.indexOf("first gate") < result.indexOf("second gate"));
  assert.ok(!result.includes("Old wait.") && !result.includes("Resolved.") && result.includes("Current wait."));
  const state = taskState({
    taskDir: dir,
    planText: readFileSync(join(dir, "plan.md"), "utf8"),
    goalsText: goals,
    resultText: result,
  });
  assert.deepEqual(resultShapeDiagnostics(result, "in-review"), []);
  assert.ok(state.steps.every((s) => s.checked && s.anchorResolves && s.anchor === "step-" + s.number + "--outcome-" + s.number));
  assert.deepEqual(
    healthLinks(dir).filter((s: string) => !before.includes(s)),
    [],
  );
});
test("decision removal archives exact bytes, rewrites live links and preserves illustrative Markdown", () => {
  const contextDecision = "## Decision — 2022-02-02: Later\r\nChosen: é.\r\n### Details\r\nA reason.\r\n";
  const planDecision = "## Decision — 2022-02-01: First\nOld plan.\n";
  const liveSection = "## Decision criteria for the 2026-12-01 rollout\nUse these criteria.\n";
  const liveLinks = ["plan.md", "CONTEXT.md"].map((file) => "[criteria](./" + file + "#decision-criteria-for-the-2026-12-01-rollout)").join("\n");
  const dir = storedFixture("decisions", {
    "plan.md": steps("done", []) + liveSection + planDecision,
    "goals.md": goals,
    "CONTEXT.md": "# Context\r\n" + contextDecision + liveSection,
    "result.md":
      "# Result\n\n## Current state\nSee [answer](./CONTEXT.md#details) and [plan](./plan.md#decision--2022-02-01-first).\n",
    "other.md": "[current](./result.md#current-state)\n`[sample](./CONTEXT.md#details)`\n",
    "criteria.md": liveLinks,
  });
  run(dir);
  const history = readFileSync(join(dir, "history.md"), "utf8");
  assert.ok(history.includes(planDecision) && history.includes(contextDecision));
  for (const file of ["CONTEXT.md", "plan.md"]) assert.ok(readFileSync(join(dir, file), "utf8").includes(liveSection));
  assert.equal(readFileSync(join(dir, "criteria.md"), "utf8"), liveLinks);
  assert.ok(!history.includes(liveSection));
  const live = readFileSync(join(dir, "result.md"), "utf8");
  assert.match(live, /See answer and plan\./);
  assert.ok(live.includes("No acceptance record was kept."));
  assert.deepEqual(resultShapeDiagnostics(live, "done"), []);
  assert.ok(readFileSync(join(dir, "other.md"), "utf8").includes("`[sample](./CONTEXT.md#details)`"));
  assert.deepEqual(healthLinks(dir), []);
});
test("wrapped What evidence is assigned to the right records without a leftover label", () => {
  const plan = steps("executing", ["full-run", "full-run"]).replaceAll(
    "delivered ([result]", "delivered\n    on time ([result]",
  );
  const dir = fixture("wrapped-evidence", { "plan.md": plan, "goals.md": goals, "result.md": "## Full Run\nShared proof.\n" });
  run(dir);
  const result = readFileSync(join(dir, "result.md"), "utf8");
  const current = readFileSync(join(dir, "plan.md"), "utf8");
  assert.ok(result.includes("Shared proof.") && result.includes("[Step 1 — Outcome 1](#step-1--outcome-1)"));
  assert.ok(!result.includes("No step record") && !current.includes("(result)") && !current.includes("#full-run"));
  assert.ok(taskState({ taskDir: dir, planText: current, resultText: result, goalsText: goals }).steps.every((step) => step.anchorResolves));
});

test("literal result links leave the checked step's live evidence intact", () => {
  const example = "``try ` ([result](./result.md#example))``";
  const proof = "([result](./result.md#full-run))";
  const plan = steps("executing", [null, null, null])
    .replace("delivered\n", "delivered 🚲 " + example + "\n    on time " + proof + "\n")
    .replace("delivered\n", "delivered ([result](./result.md#earlier)) " + proof + " " + example + "\n")
    .replace("delivered\n", "delivered " + example + "\n");
  const dir = fixture("literal-evidence", { "plan.md": plan, "result.md": "## Full Run\nShared proof.\n" });
  run(dir);
  const result = readFileSync(join(dir, "result.md"), "utf8");
  const current = readFileSync(join(dir, "plan.md"), "utf8");
  assert.ok(current.includes("delivered 🚲 " + example + " ([result](./result.md#step-1--outcome-1))\n    on time\n"));
  assert.ok(current.includes("delivered ([result](./result.md#earlier)) ([result](./result.md#step-2--outcome-2)) " + example));
  assert.ok(current.includes("delivered " + example + " ([result](./result.md#step-3--outcome-3))"));
  assert.match(result, /## Step 1 — Outcome 1[\s\S]*Shared proof\.[\s\S]*## Step 2 — Outcome 2[\s\S]*Evidence: \[Step 1/);
  assert.ok(taskState({ taskDir: dir, planText: current, resultText: result, goalsText: null }).steps.every((step) => step.anchorResolves));
});

test("changing only links in a retained section keeps its original bytes in history", () => {
  const original = "## Scope\r\n- delivered: G1. See [why](./CONTEXT.md#decision--2025-01-01-why).\r\n\r\n";
  const supplemental = "## Open evidence\r\n[Original decision](./CONTEXT.md#decision--2025-01-01-why)\r\n";
  const dir = fixture("retained-links", {
    "support.md": supplemental,
    "plan.md": "**Status:** to-do\n\n" + original,
    "CONTEXT.md": "# Context\n\n## Decision — 2025-01-01: why\nThe user chose the local fixture.\n",
    "goals.md": goals,
  });
  run(dir);
  const history = readFileSync(join(dir, "history.md"), "utf8");
  assert.ok(history.includes(original) && history.includes(supplemental));
  assert.ok(readFileSync(join(dir, "plan.md"), "utf8").includes("See why."));
});

test("deliverables keep their published bytes and report links affected by migration", () => {
  const link = "[decision](./CONTEXT.md#decision--2025-01-01-why)";
  const adr = "# Architecture\r\n\r\n**Status:** accepted\r\n**Published:** live copy\r\n\r\n## Choice\r\n" + link + "\r\n";
  const dir = fixture("published-links", {
    "adr.md": adr,
    "rfc.md": "# Proposal\n**Status:** published\n\n" + link,
    "research.md": "# Research\n> **Status:** quoted\n\n## Evidence\n" + link,
    "approaches.md": "# Options\n**Status:** stray\n\n## Evidence\n" + link,
    "CONTEXT.md": "## Decision — 2025-01-01: why\nEvidence.\n",
  });
  const preview = run(dir);
  assert.equal(readFileSync(join(dir, "adr.md"), "utf8"), adr);
  assert.equal(readFileSync(join(dir, "rfc.md"), "utf8"), "# Proposal\n**Status:** published\n\n" + link);
  assert.deepEqual(preview.manualLinks, [
    { file: "adr.md", line: 7, text: link },
    { file: "rfc.md", line: 4, text: link },
  ]);
  for (const file of ["research.md", "approaches.md"])
    assert.match(readFileSync(join(dir, file), "utf8"), /## Evidence\ndecision$/);
});

test("balanced link labels are repaired in notes and reported with the protected original line", () => {
  const retired = "./CONTEXT.md#decision--2025-01-01-why";
  const changed = "./result.md#full-run";
  const label = "See [API [v2]] \\[old\\] and `]`";
  const inline = "[" + label + "](<" + changed + '> "heading")';
  const external = "[API [remote]](https://example.test/result.md#full-run)";
  const literal = "``try ` " + inline + "``";
  const line = "🚲 [Past [A]](" + retired + ") " + inline + " " + external + " " + literal;
  const reference = "[Why [API]][prior] then [escaped \\] only](" + retired + ")";
  const definition = "[prior]: " + retired;
  const body = [line, reference, definition, ""].join("\r\n");
  const adr = "# Public design\r\n**Status:** accepted\r\n\r\n" + body;
  const dir = fixture("balanced-labels", { "notes.md": body, "adr.md": adr, "plan.md": steps("executing", ["full-run"]),
    "result.md": "## Full Run\nProof.\n", "CONTEXT.md": "## Decision — 2025-01-01: why\nOriginal.\n" });
  const preview = run(dir);
  assert.deepEqual(readFileSync(join(dir, "adr.md")), Buffer.from(adr));
  assert.deepEqual(preview.manualLinks, [line, reference, definition].map((text, i) => ({ file: "adr.md", line: 4 + i, text })));
  assert.deepEqual(readFileSync(join(dir, "notes.md")), Buffer.from([
    "🚲 Past [A] " + inline.replace(changed, "./result.md#step-1--outcome-1") + " " + external + " " + literal,
    "Why [API] then escaped \\] only", "", "",
  ].join("\r\n")));
});

test("a reference definition whose destination follows on the next line takes the step record's anchor", () => {
  const body = ["Proof: [proof][run] and [run].", "", "[run]:", "  ./result.md#full-run", ""].join("\n");
  const adr = "# Public design\n**Status:** accepted\n\n" + body;
  const dir = storedFixture("continued-definition", { "notes.md": body, "adr.md": adr, "plan.md": steps("executing", ["full-run"]),
    "goals.md": goals, "result.md": "## Full Run\nProof.\n" });
  const preview = run(dir);
  assert.equal(readFileSync(join(dir, "notes.md"), "utf8"), body.replace("#full-run", "#step-1--outcome-1"));
  assert.ok(readFileSync(join(dir, "result.md"), "utf8").includes("## Step 1 — Outcome 1\n"));
  assert.equal(readFileSync(join(dir, "adr.md"), "utf8"), adr);
  assert.deepEqual(preview.manualLinks, [{ file: "adr.md", line: 7, text: "  ./result.md#full-run" }]);
  assert.deepEqual(healthLinks(dir), []);
});

test("a removed reference definition whose destination follows on the next line drops both lines and its citations' links", () => {
  const body = ["Proof: [proof][run] and [run].", "", "[run]:", "./result.md#full-run", "After."].join("\n");
  const adr = "# Public design\n**Status:** accepted\n\n" + body;
  const dir = storedFixture("removed-continued-definition", { "notes.md": body, "adr.md": adr, "plan.md": steps("executing", [null]),
    "goals.md": goals, "result.md": "## Full Run\nProof.\n" });
  const preview = run(dir);
  assert.equal(readFileSync(join(dir, "notes.md"), "utf8"), ["Proof: proof and run.", "", "", "", "After."].join("\n"));
  assert.ok(readFileSync(join(dir, "history.md"), "utf8").includes("## Full Run\nProof.\n"));
  assert.equal(readFileSync(join(dir, "adr.md"), "utf8"), adr);
  assert.deepEqual(preview.manualLinks, ["Proof: [proof][run] and [run].", "[run]:", "./result.md#full-run"]
    .map((text, i) => ({ file: "adr.md", line: [4, 6, 7][i], text })));
  assert.deepEqual(healthLinks(dir), []);
});

test("result record headings carry only link labels so checkbox anchors, evidence notes and redirects resolve", () => {
  const retired = "./CONTEXT.md#decision--2020-01-01-size";
  const plan = steps("executing", ["full-run", "full-run", "checks"])
    .replace("Outcome 1", "Apply [size](" + retired + ")")
    .replace("Outcome 2", "Ship [notes](./notes.md)")
    .replace("Outcome 3", "Check [`[x]`][notes] and [API [v2]][]");
  const legacyStep = "## Step 4 — Extra [x](" + retired + ")\nExtra proof.\n";
  const dir = storedFixture("linked-titles", {
    "plan.md": plan + "\n[notes]: ./notes.md\n[API [v2]]: ./notes.md\n",
    "goals.md": goals,
    "CONTEXT.md": "# Context\n\n## Decision — 2020-01-01: size\nChosen size.\n",
    "result.md": "# Result\n\n## Full Run\nShared proof.\n\n## Checks\nCheck proof.\n\n" + legacyStep,
    "notes.md": [
      "[run](./result.md#full-run)",
      "[checks](./result.md#checks)",
      "[extra](./result.md#step-4--extra-xcontextmddecision--2020-01-01-size)",
    ].join("\n"),
  });
  run(dir);
  const result = readFileSync(join(dir, "result.md"), "utf8");
  const current = readFileSync(join(dir, "plan.md"), "utf8");
  const headings = result.replace(/^```text\n[^\n]*\n```$/gm, "").split("\n").filter((line) => line.startsWith("## "));
  for (const title of ["Step 1 — Apply size", "Step 2 — Ship notes", "Step 3 — Check `[x]` and API [v2]", "Step 4 — Extra x"])
    assert.ok(headings.includes("## " + title), title);
  assert.ok(headings.every((line) => !line.includes("](") && !line.includes("][")), headings.join("\n"));
  assert.ok(current.includes("### Step 2 — Ship [notes](./notes.md)"));
  assert.ok(current.includes("delivered ([result](./result.md#step-1--apply-size))"));
  assert.ok(current.includes("delivered ([result](./result.md#step-2--ship-notes))"));
  assert.ok(current.includes("delivered ([result](./result.md#step-3--check-x-and-api-v2))"));
  assert.ok(result.includes("Evidence: [Step 1 — Apply size](#step-1--apply-size)."));
  assert.equal(readFileSync(join(dir, "notes.md"), "utf8"), [
    "[run](./result.md#step-1--apply-size)",
    "[checks](./result.md#step-3--check-x-and-api-v2)",
    "[extra](./result.md#step-4--extra-x)",
  ].join("\n"));
  const state = taskState({ taskDir: dir, planText: current, resultText: result, goalsText: goals });
  assert.ok(state.steps.every((step) => step.checked && step.anchorResolves), JSON.stringify(state.steps));
  assert.deepEqual(state.structure.diagnostics.filter(({ code }) => code === "missing-result-anchor"), []);
  assert.deepEqual(healthLinks(dir), []);
});

test("a legacy deliverable named history.md refuses preview and apply until relocated", () => {
  const decision = "## Decision — 2025-01-01: why\r\nPrivate evidence.\r\n";
  const published = "# History of the project\r\n\r\n**Status:** published\r\n\r\n## Origins\r\nCafé.\r\n";
  const dir = fixture("history-deliverable", { "CONTEXT.md": decision });
  const before = report(dir);
  writeFileSync(join(dir, "history.md"), published);
  for (const token of [undefined, before.token, before.token]) {
    const refused = cli(dir, token);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /rename .*history\.md.*deliverable.*references.*preview/i);
    assert.equal(readFileSync(join(dir, "history.md"), "utf8"), published);
    assert.equal(readFileSync(join(dir, "CONTEXT.md"), "utf8"), decision);
  }
  renameSync(join(dir, "history.md"), join(dir, "project-history.md"));
  run(dir);
  assert.equal(readFileSync(join(dir, "project-history.md"), "utf8"), published);
  assert.ok(readFileSync(join(dir, "history.md"), "utf8").includes(decision));
});

test("changed headers and headingless notes retain their exact source bytes in order", () => {
  const link = "[decision](./CONTEXT.md#decision--2025-01-01-why)";
  const prefix = "# Context\r\nCafé " + link + "  \r\n\r\n";
  const decision = "## Decision — 2025-01-01: why\r\nOriginal choice.\r\n";
  const note = "# Evidence\r\nFirst line.\r\n" + link + "  ";
  const dir = fixture("prefix-history", {
    "CONTEXT.md": prefix + decision,
    "notes.md": note,
    "history.md": "Earlier notes.\r\n",
  });
  run(dir);
  assert.equal(readFileSync(join(dir, "CONTEXT.md"), "utf8"), prefix.replace(link, "decision"));
  assert.equal(readFileSync(join(dir, "notes.md"), "utf8"), note.replace(link, "decision"));
  const history = readFileSync(join(dir, "history.md"), "utf8");
  assert.ok(history.startsWith("Earlier notes.\r\n"));
  for (const bytes of [prefix, decision, note]) assert.equal(history.split(bytes).length, 2, bytes);
  assert.ok(history.indexOf(prefix) < history.indexOf(decision));
});

test("an archived plan status header keeps an ordinary history usable on retry", () => {
  const prefix = "# Plan\n**Status:** executing\n[why](#decision--2025-01-01-why)\n";
  const decision = "## Decision — 2025-01-01: why\nSelected.\n";
  const dir = fixture("history-plan-header", { "plan.md": prefix + decision, "history.md": "Existing history.\n" });
  run(dir);
  const history = readFileSync(join(dir, "history.md"), "utf8");
  assert.ok(history.startsWith("Existing history.\n"));
  assert.ok(history.includes(prefix) && history.includes(decision));
});

test("duplicate state and wait headings preserve new evidence links and distinguish old citations", () => {
  const citations = [
    "[current](./result.md#current-state)",
    "[latest](./result.md#current-state-1)",
    "[old review](./result.md#in-review--first)",
    "[latest review](./result.md#in-review--last)",
    "[active wait](./result.md#in-review)",
  ];
  const dir = storedFixture("duplicate-links", {
    "plan.md": steps("in-review", ["current-state-1", "in-review--last"]),
    "result.md": "## Current state\nOld state.\n## Current state\nCurrent.\n" +
      "## In review — first\nOld review.\n## In review\nInterim.\n## In review — last\nActive.\n",
    "notes.md": citations.join("\n"),
  });
  const preview = run(dir);
  const live = readFileSync(join(dir, "result.md"), "utf8");
  assert.ok(live.includes("Evidence: [Current state](#current-state)."));
  assert.ok(live.includes("Evidence: [In review](#in-review)."));
  assert.equal(readFileSync(join(dir, "notes.md"), "utf8"), [
    citations[0], "[latest](./result.md#current-state)", "old review", "[latest review](./result.md#in-review)", citations[4],
  ].join("\n"));
  assert.deepEqual(preview.manualLinks, [
    { file: "notes.md", line: 1, text: citations[0] },
    { file: "notes.md", line: 5, text: citations[4] },
  ]);
  assert.deepEqual(healthLinks(dir), []);
});

test("a legacy wait identified by its label line becomes the live wait record", () => {
  const reconciliation = "## Reconciliation — 2026-01-04\n- Checked.\n\n**In review:** reconciliation note\n\n";
  for (const [name, status, heading, label, extra] of [
    ["review", "in-review", "## Review — 2026-01-03", "**In review:** awaiting the client's sign-off", reconciliation],
    ["blocked", "blocked", "## Waiting for deploy", "**Blocked:** Release needs approval from Lee.", ""],
  ]) {
    const dir = fixture("label-wait-" + name, {
      "plan.md": steps(status, ["step-1--outcome-1"]),
      "goals.md": goals,
      "result.md": "# Result\n\n## Current state\nWaiting.\n\n## Step 1 — Outcome 1\nShipped.\n\n" +
        heading + "\n\n" + label + "\n\n" + extra,
    });
    run(dir);
    const result = readFileSync(join(dir, "result.md"), "utf8");
    const wait = result.slice(result.indexOf(status === "blocked" ? "## Blocked\n" : "## In review\n"));
    assert.ok(wait.startsWith("## ") && wait.includes(label) && wait.includes("```text\n" + heading + "\n```"), result);
    assert.ok(!result.includes("No wait record was kept.") && !result.includes("reconciliation note"), result);
    const state = taskState({ taskDir: dir, planText: readFileSync(join(dir, "plan.md"), "utf8"), goalsText: goals, resultText: result });
    assert.deepEqual(state.structure.diagnostics, [], name);
    assert.deepEqual(resultShapeDiagnostics(result, status), [], name);
  }
  const dir = fixture("label-wait-reconciliation", {
    "plan.md": steps("in-review", ["step-1--outcome-1"]),
    "result.md": "# Result\n\n## Current state\nWaiting.\n\n## Step 1 — Outcome 1\nShipped.\n\n" + reconciliation,
  });
  run(dir);
  const result = readFileSync(join(dir, "result.md"), "utf8");
  assert.ok(result.includes("## In review\n\nNo wait record was kept.") && !result.includes("reconciliation note"), result);
  assert.ok(readFileSync(join(dir, "history.md"), "utf8").includes(reconciliation.trimEnd()));
});

test("later legacy goal verdicts and Health become the live Acceptance statements", () => {
  const twoGoals = goals + "- G2 (external) — QA signs off.\n";
  const plan = (status: string) => steps(status, ["step-1--outcome-1"]).replace("- delivered: G1", "- delivered: G1, G2");
  const start = "# Result\n\n## Current state\nDone.\n\n## Step 1 — Outcome 1\nShipped.\n\n";
  const acceptance = (g2: string) =>
    "## Acceptance\n\n**Health:** initial boundary passed\n\n- G1 — met (verified by tests)\n- " + g2 + "\n\n";
  const recordLines = (text: string, heading: string) => {
    let fenced = false;
    let inside = false;
    const lines: string[] = [];
    for (const line of text.split("\n")) {
      if (line.startsWith("```")) fenced = !fenced;
      else if (!fenced && line.startsWith("## ")) inside = line === heading;
      if (inside) lines.push(line);
    }
    return lines;
  };
  const lastStatement = (lines: string[], prefix: string) => lines.filter((line) => line.startsWith(prefix)).at(-1);
  const migrated = (name: string, status: string, result: string) => {
    const dir = fixture("later-verdicts-" + name, { "plan.md": plan(status), "goals.md": twoGoals, "result.md": result });
    run(dir);
    const text = readFileSync(join(dir, "result.md"), "utf8");
    const state = taskState({ taskDir: dir, planText: plan(status), goalsText: twoGoals, resultText: text });
    assert.deepEqual(state.structure.diagnostics, [], name);
    assert.deepEqual(resultShapeDiagnostics(text, status), [], name);
    return { text, lines: recordLines(text, "## Acceptance"), history: readFileSync(join(dir, "history.md"), "utf8") };
  };

  const reconciliation = "## Reconciliation — 2026-02-01\n\n**Trigger:** `reconcile-task`\n" +
    "**Health:** fresh boundary passed on 2026-02-01\n\n" +
    "- G2 — met (QA signed off in staging on 2026-02-01)\n" +
    "- goals.md § G2 — was \"QA signs off\", now \"QA signs off in staging\" — chose staging over production: ticket\n" +
    "- result.md — in-review → done\n\n";
  const done = migrated("done", "done",
    start + acceptance("G2 — pending external (awaiting QA sign-off, verified by QA)") + reconciliation +
      "**Completed:** 2026-02-01\n");
  assert.equal(lastStatement(done.lines, "- G2 — "), "- G2 — met (QA signed off in staging on 2026-02-01)", done.text);
  assert.equal(lastStatement(done.lines, "- G1 — "), "- G1 — met (verified by tests)", done.text);
  assert.equal(lastStatement(done.lines, "**Health:**"), "**Health:** fresh boundary passed on 2026-02-01", done.text);
  assert.ok(done.lines.join("\n").includes("```text\n## Reconciliation — 2026-02-01\n```"), done.text);
  assert.ok(!done.lines.some((line) => line.includes("goals.md § G2") || line.includes("result.md —")), done.text);
  assert.ok(done.history.includes(reconciliation.trimEnd()), done.history);

  const finalization = "## Health boundary — 2026-03-01\n\n**Trigger:** later-run `in-review → done` finalization\n" +
    "**Health:** finalization boundary passed on 2026-03-01\n\n";
  const finalized = migrated("finalized", "done",
    start + acceptance("G2 — met (QA confirmed on 2026-03-01)") +
      "## Reconciliation — 2026-02-01\n\n- G2 — pending external (reopened by a new head, verified by QA)\n\n" +
      finalization + "**Completed:** 2026-03-01\n");
  assert.equal(lastStatement(finalized.lines, "- G2 — "), "- G2 — met (QA confirmed on 2026-03-01)", finalized.text);
  assert.equal(lastStatement(finalized.lines, "**Health:**"), "**Health:** finalization boundary passed on 2026-03-01");
  assert.ok(finalized.history.includes(finalization.trimEnd()), finalized.history);

  const review = migrated("review", "in-review",
    start + "## In review\n\n- G2 — awaiting QA sign-off, verified by QA\n\n" +
      "## Reconciliation — 2026-02-01\n\n- G1 — met (verified by tests on 2026-02-01)\n\n");
  assert.equal(lastStatement(review.lines, "- G1 — "), "- G1 — met (verified by tests on 2026-02-01)", review.text);

  const executing = migrated("executing", "executing",
    start + "## Reconciliation — 2026-02-01\n\n- G1 — met (verified by tests on 2026-02-01)\n\n");
  assert.deepEqual(executing.lines, [], executing.text);
});

test("only citations into this result can assign shared or nested evidence to a checked step", () => {
  const plan = steps("executing", ["release", "shared", "shared", "shared", "missing", "release"])
    .replaceAll("./result.md#release", "./other.md#release")
    .replace("./result.md#shared", "./other.md#shared");
  const legacy = "## Release\nUnrelated evidence.\n\n";
  const dir = fixture("foreign-result", {
    "plan.md": plan,
    "result.md": legacy + "## Full Run\n### Shared\nShared evidence.\n\n## Step 6 — Outcome 6\nIndependent evidence.\n\n" +
      "## Final implementation commit — 2020-01-01\n**Commit:** SHA `afa1234`\n",
    "other.md": "## Release\n## Shared\n",
  });
  run(dir);
  const result = readFileSync(join(dir, "result.md"), "utf8");
  const blocks = result.replace(/^```text\n[^\n]*\n```$/gm, "")
    .split(/^## Step \d+ — Outcome \d+$/m).slice(1).map((s) => s.split(/^## /m)[0]);
  for (const number of [1, 2, 5]) {
    assert.match(blocks[number - 1], /No step record was kept\./);
    assert.doesNotMatch(blocks[number - 1], /Evidence:|\*\*Commit:\*\*/);
  }
  assert.ok(!result.includes("Unrelated evidence."));
  assert.ok(readFileSync(join(dir, "history.md"), "utf8").includes(legacy));
  assert.match(blocks[2], /Shared evidence\./);
  assert.match(blocks[3], /\[Step 3 — Outcome 3\]\(#step-3--outcome-3\)/);
  assert.match(blocks[5], /Independent evidence\./);
  for (const number of [3, 4, 6]) assert.ok(blocks[number - 1].includes("**Commit:** SHA `afa1234`"));
});

test("restore snapshot bytes by allocated section identity and report an unavailable snapshot", () => {
  const path = join(home, ".local", "state", "agents-kit", "compaction");
  mkdirSync(path, { recursive: true });
  const first = "## Step 1 — Outcome 1\nOriginal.\r\nEvidence.\n\n";
  const bytes = "# Result\n\n" + first + "## Old note\nAnother piece.\n";
  const name = "restore task-" + createHash("sha256").update(bytes).digest("hex").slice(0, 12) + ".md";
  writeFileSync(join(path, name), bytes);
  const old = `## Step 1 — Outcome 1\nCompacted 2026-01-01; full text in ${String.fromCharCode(96)}~/.local/state/agents-kit/compaction/${name}${String.fromCharCode(96)}.\n\n`;
  const absent =
    "## Old note\nCompacted 2026-01-01; full text in `~/.local/state/agents-kit/compaction/restore task-000000000000.md`.\n";
  const dir = storedFixture("restore", {
    "plan.md": steps("executing", ["step-1--outcome-1"]),
    "goals.md": goals,
    "result.md": "# Result\n\n" + old + absent,
  });
  const preview = run(dir);
  assert.deepEqual(preview.missingSnapshots, ["old-note: restore task-000000000000.md"]);
  const live = readFileSync(join(dir, "result.md"), "utf8");
  assert.ok(live.includes(first));
  const history = readFileSync(join(dir, "history.md"), "utf8");
  assert.ok(history.includes(old) && history.includes(absent));
  assert.deepEqual(resultShapeDiagnostics(live, "executing"), []);
  assert.deepEqual(healthLinks(dir), []);
});
test("snapshot notes only restore a whole basename with matching regular UTF-8 contents", () => {
  const path = join(home, ".local/state/agents-kit/compaction");
  mkdirSync(path, { recursive: true });
  const bytes = "## Step 1 — Outcome 1\nOriginal proof.\n";
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const bare = "plain-" + hash + ".md";
  writeFileSync(join(path, bare), bytes);
  const dir = fixture("snapshot-paths", { "plan.md": steps("executing", ["step-1--outcome-1"]) });
  function withNote(ref: string) {
    const result = "## Step 1 — Outcome 1\nCompacted 2026-01-01; full text in " + ref + ".\n";
    writeFileSync(join(dir, "result.md"), result);
    return result;
  }
  const prefix = "~/.local/state/agents-kit/compaction/";
  for (const unsafe of ["../" + bare, bare + "/child", bare + ".other"]) {
    const result = withNote("`" + prefix + unsafe + "`");
    assert.equal(report(dir).missingSnapshots.length, 1);
    assert.equal(readFileSync(join(dir, "result.md"), "utf8"), result);
  }
  const link = "linked task-" + hash + ".md";
  symlinkSync(join(path, bare), join(path, link));
  const badHash = "wrong hash-000000000000.md";
  writeFileSync(join(path, badHash), bytes);
  const invalid = Buffer.from([0xff]);
  const badText = "bad text-" + createHash("sha256").update(invalid).digest("hex").slice(0, 12) + ".md";
  writeFileSync(join(path, badText), invalid);
  for (const [name, error] of [[link, /unsupported snapshot path/], [badHash, /snapshot hash mismatch/], [badText, /not UTF-8/]] as const) {
    const result = withNote("`" + prefix + name + "`");
    const refused = cli(dir);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, error);
    assert.equal(readFileSync(join(dir, "result.md"), "utf8"), result);
  }
  withNote(prefix + bare);
  assert.deepEqual(run(dir).missingSnapshots, []);
  assert.ok(readFileSync(join(dir, "result.md"), "utf8").includes(bytes));
});
test("preview does not write; a changed input or symlink refuses every write", () => {
  const old = "## Old research\nOriginal bytes.\n";
  const files = { "plan.md": steps("done", []), "result.md": old, "goals.md": goals };
  const dir = fixture("guard", files);
  const preview = report(dir);
  assert.ok(preview.changes.length && !existsSync(join(dir, "history.md")));
  writeFileSync(join(dir, "goals.md"), goals + "other text");
  assert.equal(cli(dir, preview.token).status, 2);
  assert.equal(readFileSync(join(dir, "result.md"), "utf8"), old);
  assert.ok(!existsSync(join(dir, "history.md")));
  symlinkSync(join(dir, "goals.md"), join(dir, "history.md"));
  assert.equal(cli(dir).status, 2);
  assert.equal(readFileSync(join(dir, "goals.md"), "utf8"), goals + "other text");
});
test("created history and result files take the umask default while replaced files keep their mode", () => {
  const dir = fixture("created-modes", { "plan.md": steps("executing", [null]) + "## Decision — 2022-02-01: First\nOld plan.\n" });
  const plan = join(dir, "plan.md");
  chmodSync(plan, 0o604);
  const previous = process.umask(0o027);
  try {
    assert.deepEqual(run(dir).changes, ["history.md", "plan.md", "result.md"]);
  } finally {
    process.umask(previous);
  }
  for (const file of ["history.md", "result.md"]) assert.equal(statSync(join(dir, file)).mode & 0o7777, 0o640, file);
  assert.equal(statSync(plan).mode & 0o7777, 0o604);
});
test("legacy role names leave the folder untouched", () => {
  const dir = fixture("legacy", { "old.plan.md": "# Legacy\n", "result.md": "## Old\nPreserve\n" });
  assert.deepEqual(run(dir).skipped, ["old.plan.md"]);
  assert.equal(readFileSync(join(dir, "result.md"), "utf8"), "## Old\nPreserve\n");
});
test("case-variant role filenames invalidate earlier previews and leave canonical records untouched", () => {
  const files = { "plan.md": steps("done", ["full-run"]), "result.md": "## Full Run\nDelivered.\n" };
  const note = "[old](./result.md#full-run)\n";
  const dir = fixture("case-variant-roles", { ...files, "notes.MD": note });
  let preview = report(dir);
  assert.ok(preview.changes.includes("result.md"));
  assert.ok(!preview.changes.includes("notes.MD"));
  let previousName = "notes.MD";
  for (const name of ["old.RESULT.MD", "TiCkEt.Md"]) {
    renameSync(join(dir, previousName), join(dir, name));
    const stale = cli(dir, preview.token);
    assert.equal(stale.status, 2, stale.stderr);
    assert.match(stale.stderr, /fresh preview/);
    preview = report(dir);
    assert.deepEqual(preview.skipped, [name]);
    assert.deepEqual(preview.changes, []);
    assert.deepEqual(report(dir, preview.token).applied, []);
    assert.deepEqual(readdirSync(dir).sort(), [...Object.keys(files), name].sort());
    for (const [file, bytes] of Object.entries(files)) assert.equal(readFileSync(join(dir, file), "utf8"), bytes);
    assert.equal(readFileSync(join(dir, name), "utf8"), note);
    previousName = name;
  }
});
test("a bare spec preserves its bytes and plan header beside migratable canonical records", () => {
  const header = "**Spec:** [./spec.md](./spec.md)";
  const spec = "# Spec\n[Legacy record](./result.md#full-run)\n";
  const dir = fixture("bare-spec", {
    "spec.md": spec,
    "plan.md": header + "\n" + steps("done", ["full-run"]),
    "result.md": "## Full Run\nDelivered.\n",
  });
  assert.deepEqual(run(dir).skipped, []);
  assert.equal(readFileSync(join(dir, "spec.md"), "utf8"), spec);
  assert.ok(readFileSync(join(dir, "plan.md"), "utf8").includes(header));
  assert.deepEqual(resultShapeDiagnostics(readFileSync(join(dir, "result.md"), "utf8"), "done"), []);
});

test("a status-bearing spec keeps its bytes and reports links to redirected records and moved decisions", () => {
  const record = "[Legacy record](./result.md#full-run)";
  const decision = "[decision](./CONTEXT.md#decision--2025-01-01-why)";
  const spec = "# Spec\n\n**Status:** draft\n\n## Design\n" + record + "\n" + decision + "\n";
  const dir = fixture("status-spec", {
    "spec.md": spec,
    "plan.md": "**Spec:** [./spec.md](./spec.md)\n" + steps("done", ["full-run"]),
    "result.md": "## Full Run\nDelivered.\n",
    "CONTEXT.md": "## Decision — 2025-01-01: why\nEvidence.\n",
    "goals.md": goals,
  });
  const preview = run(dir);
  assert.deepEqual(readFileSync(join(dir, "spec.md")), Buffer.from(spec));
  assert.ok(readFileSync(join(dir, "history.md"), "utf8").includes("## Decision — 2025-01-01: why\nEvidence.\n"));
  assert.deepEqual(preview.manualLinks, [
    { file: "spec.md", line: 6, text: record },
    { file: "spec.md", line: 7, text: decision },
  ]);
});

test("step commits follow the qualifying legacy gates before records are reordered", () => {
  const step = "## Step 1 — Outcome 1\nWork.\n\n";
  const checkpoint = "## Checkpoint after Step 1\n**Outcome:** passed\n**Commit:** SHA `abc1234`\n\n";
  const final = "## Final implementation commit — 2020-01-01\n**Commit:** SHA `deffed1`\n\n";
  const none = "## Final implementation commit — 2020-01-02\n**Commit:** none — no task changes\n\n";
  const failed = "## Final implementation commit — 2020-01-03\n**Commit:** failed — signing\n\n";
  const observe = step.replace("Work.", "**Executed:** verification-only continuation");
  for (const [name, body, sha] of [
    ["checkpoint", step + checkpoint, "abc1234"],
    ["missing-outcome", step + checkpoint.replace("**Outcome:** passed\n", ""), null],
    ["unknown-outcome", step + checkpoint.replace("passed", "unverified"), null],
    ["unqualified-predecessor", step + checkpoint.replace("passed", "unverified") + none, null],
    ["re-executed", step + checkpoint + step, null],
    ["verification", step + final + observe, "deffed1"],
    ["failed", step + checkpoint + failed, null],
    ["no-change", step + final + none, "deffed1"],
    ["no-prior-sha", step + none, null],
    ["bare-sha", step + checkpoint.replace("SHA `abc1234`", "`abc1234`"), null],
    ["stale-inline", step.replace("Work.", "**Commit:** SHA `7654321`"), null],
    [
      "separately-settled",
      step +
        checkpoint.replace("SHA `abc1234`", "failed — handed over: signed-message") +
        "## Follow-up\n**Commit:** `ace1234` — settled hand-over, Checkpoint after Step 1\n",
      "ace1234",
    ],
    ["settled", step + checkpoint.replace("SHA `abc1234`", "`ace1234` — settled hand-over"), "ace1234"],
  ] as const) {
    const dir = fixture("commit-" + name, {
      "plan.md": steps("executing", ["step-1--outcome-1"]),
      "result.md": "## Decision log\n\n" + body,
      "goals.md": goals,
    });
    run(dir);
    const result = readFileSync(join(dir, "result.md"), "utf8");
    const record = result
      .replace(/^```text\n[^\n]*\n```$/gm, "")
      .split(/^## Step 1 — Outcome 1$/m)[1]
      .split(/^## /m)[0];
    const commits = [...record.matchAll(/^\*\*Commit:\*\* SHA `([^`]+)`$/gm)].map((m) => m[1]);
    assert.deepEqual(commits, sha ? [sha] : [], name);
    if (name === "no-change") assert.ok(result.includes("**Notes:** Covering SHA `deffed1`"));
    if (name === "unqualified-predecessor") assert.ok(!result.includes("**Notes:** Covering SHA"));
    assert.deepEqual(resultShapeDiagnostics(result, "executing"), []);
  }
});
function currentCommit(result: string, title: string) {
  const section = result.replace(/^```text\n[^\n]*\n```$/gm, "").split(/^## /m).find((s) => s.startsWith(title + "\n"));
  assert.ok(section, title);
  return [...section.matchAll(/^\*\*Commit:\*\* (.+)$/gm)].at(-1)?.[1];
}

test("later implementation invalidates the Final until a new Final covers the work", () => {
  const first = "## Step 1 — Outcome 1\nShipped.\n";
  const second = "## Step 2 — Outcome 2\nShipped.\n";
  const final = "## Final implementation commit — 2020-01-01\n**Commit:** SHA `abc1234`\n";
  for (const [name, after, secondCommit, finalCommit] of [
    ["rerun", second, undefined, /^not run\b/],
    ["observation", second + "**Executed:** verification-only continuation\n", "SHA `abc1234`", /^SHA `abc1234`$/],
    ["finalized", second + final.replace("abc1234", "def5678"), "SHA `def5678`", /^SHA `def5678`$/],
  ] as const) {
    const dir = fixture("final-" + name, {
      "plan.md": steps("executing", ["step-1--outcome-1", "step-2--outcome-2"]),
      "result.md": first + "## Checkpoint after Step 1\n**Outcome:** passed\n**Commit:** SHA `aaa1111`\n" + second + final + after,
    });
    run(dir);
    const result = readFileSync(join(dir, "result.md"), "utf8");
    assert.match(currentCommit(result, "Final implementation commit") ?? "", finalCommit, name);
    assert.equal(currentCommit(result, "Step 2 — Outcome 2"), secondCommit, name);
    assert.equal(currentCommit(result, "Step 1 — Outcome 1"), "SHA `aaa1111`", name);
  }
});

test("a Final retry without a commit leaves the combined Final with no current commit", () => {
  const dir = fixture("final-retry-without-commit", {
    "plan.md": steps("executing", ["step-1--outcome-1"]),
    "result.md": "## Step 1 — Outcome 1\nShipped.\n" +
      "## Final implementation commit — 2020-01-01\n**Outcome:** passed\n**Commit:** SHA `abc1234`\n" +
      "## Step 1 — Outcome 1 (re-executed)\nShipped again.\n" +
      "## Final implementation commit — 2020-01-02\n**Health:** pending\n**Outcome:** pending\n",
  });
  run(dir);
  const result = readFileSync(join(dir, "result.md"), "utf8");
  assert.match(currentCommit(result, "Final implementation commit") ?? "", /^not run — /);
  assert.equal(currentCommit(result, "Step 1 — Outcome 1"), undefined);
});

test("a step citing its passing checkpoint after its own record takes that checkpoint's SHA", () => {
  const body = "## Step 1 — Outcome 1\nShipped.\n\n## Checkpoint after Step 1\n**Outcome:** passed\n**Commit:** SHA `abc1234`\n";
  for (const [name, prefix] of [["legacy", "## Decision log\n\n"], ["ambiguous", ""]] as const) {
    const dir = fixture("cited-checkpoint-" + name, {
      "plan.md": steps("executing", ["checkpoint-after-step-1"]),
      "result.md": prefix + body,
    });
    const preview = run(dir);
    const result = readFileSync(join(dir, "result.md"), "utf8");
    const record = result.split(/^## Step 1 — Outcome 1$/m)[1].split(/^## /m)[0];
    assert.ok(record.includes("Evidence: [Checkpoint after Step 1](#checkpoint-after-step-1)."), name + ": " + record);
    assert.equal(currentCommit(result, "Step 1 — Outcome 1"), name === "legacy" ? "SHA `abc1234`" : undefined, name);
    assert.deepEqual(preview.unresolvedCommits, name === "legacy" ? [] : ["Step 1"], name);
  }
});

test("multi-repository gates assign coverage only when the pointers identify one repository", () => {
  const first = "api branch `feature-a`";
  const second = "api.docs branch `feature-b`";
  const apiDelivery = "api #41, #39 on `main` through #37 (`c0ffee1`)";
  const docsDelivery = "api.docs #17, #13 on `main` through #11 (`defaced`)";
  const branch = "; branch `feature-b` (base `main`), no commits.";
  const final = "## Final implementation commit — first\n**Commit:** api SHA `aaa1111`, api.docs SHA `bbb2222`\n";
  const noChange = "## Final implementation commit — retry\n**Commit:** none — no task changes\n";
  for (const [name, pointers, sha] of [
    ["both", first + ", " + second, undefined],
    ["reversed", second + ", " + first, undefined],
    ["first", first, "aaa1111"],
    ["second", second, "bbb2222"],
    ["other", "api.tools branch `api.docs`", undefined],
    ["separate-sentences", apiDelivery + ". " + docsDelivery + branch, "bbb2222"],
    ["shared-sentence", apiDelivery + " and " + docsDelivery + branch, undefined],
    ["adjacent-ambiguous", "api and api.docs branch `feature-b`", undefined],
    ["two-branches", apiDelivery + "; branch `feature-a`. " + docsDelivery + branch, undefined],
    ["distinct-branches", first + ". " + apiDelivery + branch, undefined],
  ] as const) {
    for (const retry of [false, true]) {
      const dir = fixture("repositories-" + name + "-" + retry, {
        "plan.md": steps("executing", ["step-1--outcome-1"]),
        "result.md": "## Current state\n**Pointers:** " + pointers + "\n## Step 1 — Outcome 1\nShipped.\n" +
          final + (retry ? noChange : ""),
      });
      const preview = run(dir);
      const result = readFileSync(join(dir, "result.md"), "utf8");
      assert.deepEqual(preview.unresolvedCommits.sort(), sha ? [] : retry ? ["Final implementation commit", "Step 1"] : ["Step 1"], name);
      assert.equal(currentCommit(result, "Step 1 — Outcome 1"), sha && "SHA `" + sha + "`", name);
      const notes = [...result.matchAll(/^\*\*Notes:\*\* Covering SHA `([^`]+)`/gm)];
      assert.deepEqual(notes.map((m) => m[1]), retry && sha ? [sha] : [], name);
    }
  }
});

test("a gate naming one repository's SHA assigns coverage only when the pointers select that repository", () => {
  const noChange = "## Final implementation commit — retry\n**Outcome:** passed\n**Commit:** none — no task changes\n";
  for (const [name, pointers, commit, sha] of [
    ["other-repository", "api branch `feature-a`", "docs SHA `bbb2222`", undefined],
    ["selected-repository", "api branch `feature-a`", "api SHA `aaa1111`", "aaa1111"],
    ["unlabeled", "api branch `feature-a`", "SHA `ccc3333`", "ccc3333"],
    ["no-branch", "api #41 on `main`", "docs SHA `bbb2222`", "bbb2222"],
  ] as const) {
    const dir = fixture("single-repository-" + name, {
      "plan.md": steps("executing", ["step-1--outcome-1"]),
      "result.md": "## Current state\n**Pointers:** " + pointers + "\n## Step 1 — Outcome 1\nShipped.\n" +
        "## Checkpoint after Step 1\n**Outcome:** passed\n**Commit:** " + commit + "\n" + noChange,
    });
    const preview = run(dir);
    const result = readFileSync(join(dir, "result.md"), "utf8");
    assert.deepEqual(preview.unresolvedCommits.sort(), sha ? [] : ["Final implementation commit", "Step 1"], name);
    assert.equal(currentCommit(result, "Step 1 — Outcome 1"), sha && "SHA `" + sha + "`", name);
    const notes = [...result.matchAll(/^\*\*Notes:\*\* Covering SHA `([^`]+)`/gm)];
    assert.deepEqual(notes.map((m) => m[1]), sha ? [sha] : [], name);
  }
});

test("a dated hand-over settlement must follow the named gate's latest commit attempt", () => {
  const failedCommit = "failed — handed over: signed-message";
  const failure = "**Commit:** " + failedCommit + "\n";
  for (const gate of ["Checkpoint after Step 1", "Final implementation commit"]) {
    const heading = "## " + gate + " — first\n**Outcome:** passed\n";
    const note = "- 2020-01-02 — **Commit:** `abc1234` — settled hand-over, " + gate + "\n";
    for (const [name, body, settled] of [
      ["same-section", heading + failure + note, true],
      ["follow-up", heading + failure + "## Follow-up\n" + note, true],
      ["before-attempt", heading + note + failure, false],
      ["later-attempt", heading + failure + note + failure, false],
      ["later-gate", heading + failure + note + heading + failure, false],
    ] as const) {
      const dir = fixture(gate + "-" + name, {
        "plan.md": steps("executing", ["step-1--outcome-1"]),
        "result.md": "## Step 1 — Outcome 1\nShipped.\n" + body,
      });
      run(dir);
      const result = readFileSync(join(dir, "result.md"), "utf8");
      assert.equal(currentCommit(result, gate), settled ? "`abc1234` — settled hand-over" : failedCommit, name);
      assert.equal(currentCommit(result, "Step 1 — Outcome 1"), settled ? "SHA `abc1234`" : undefined, name);
    }
  }
});

test("migration refuses damaged current proof on preview and token reuse", () => {
  const marker = "<!-- agents-kit: migrated task result -->\n";
  const first = "## Step 1 — Outcome 1\nShipped.\n";
  const open = "## Open findings\nNone.\n";
  for (const [name, prefix, status, record, damage, link, diagnostic] of [
    ["acceptance", marker, "done", "## Acceptance\nG1 met.\n", "", "step-1--outcome-1", "missing-result-section: Acceptance"],
    ["blocked", marker, "blocked", "## Blocked\nWaiting.\n", "", "step-1--outcome-1", "missing-result-section: Blocked"],
    ["review", marker, "in-review", "## In review\nPending.\n", "### In review\nPending.\n", "step-1--outcome-1", "missing-result-section: In review"],
    ["unknown", marker, "executing", "", "## Investigation\nNotes.\n", "step-1--outcome-1", "unknown-result-section: Investigation"],
    ["repeated", marker, "executing", open, open + open, "step-1--outcome-1", "duplicate-result-record: Open findings"],
    ["step", marker, "executing", "", "", "missing", "missing-result-anchor: Step 1"],
    ["another-step", marker, "executing", "## Step 2 — Other\n", "## Step 2 — Other\n", "step-2--other", "missing-result-anchor: Step 1"],
    ["unmarked", "", "done", open + "## Acceptance\nG1 met.\n", open, "step-1--outcome-1", "missing-result-section: Acceptance"],
  ]) {
    const healthy = steps(status, ["step-1--outcome-1"]);
    const dir = fixture("damaged-" + name, { "plan.md": healthy, "result.md": prefix + first + record });
    const token = report(dir).token;
    const plan = steps(status, [link]);
    const result = prefix + first + damage;
    writeFileSync(join(dir, "plan.md"), plan);
    writeFileSync(join(dir, "result.md"), result);
    for (const use of [undefined, token]) {
      const child = cli(dir, use);
      assert.equal(child.status, 2, name);
      assert.ok(child.stderr.includes(diagnostic), child.stderr);
      assert.equal(child.stdout, "");
      assert.equal(readFileSync(join(dir, "plan.md"), "utf8"), plan);
      assert.equal(readFileSync(join(dir, "result.md"), "utf8"), result);
      assert.deepEqual(readdirSync(dir).sort(), ["plan.md", "result.md"]);
    }
  }
});
test("a repeated record in an unmarked current result refuses migration instead of rewriting step commits", () => {
  const gate = "## Checkpoint after Step 1\n**Outcome:** passed\n**Commit:** SHA `bbb2222`\n\n";
  const open = "## Open findings\nNone.\n\n";
  for (const [name, commit] of [["recorded", " SHA `aaa1111`"], ["cleared", ""]]) {
    const dir = fixture("repeated-unmarked-" + name, {
      "plan.md": steps("executing", ["step-1--outcome-1"]),
      "result.md": "## Step 1 — Outcome 1\n**Commit:**" + commit + "\n\n" + gate + open + open,
    });
    const before = readdirSync(dir).sort().map((file) => [file, readFileSync(join(dir, file))]);
    const child = cli(dir);
    assert.equal(child.status, 2, name + ": " + child.stdout);
    assert.ok(child.stderr.includes("duplicate-result-record: Open findings"), child.stderr);
    assert.equal(child.stdout, "");
    assert.deepEqual(readdirSync(dir).sort().map((file) => [file, readFileSync(join(dir, file))]), before);
  }
});
test("a moved section ending inside an open fence or comment refuses migration and names the hidden record", () => {
  const step1 = "## Step 1 — Outcome 1\nProof.\n";
  const step2 = "## Step 2 — Outcome 2\nProof.\n\n";
  for (const [name, plan, result, hidden] of [
    ["fence-acceptance", steps("done", ["step-1--outcome-1"]), step1 + "```sh\nnpm test\n", "Acceptance"],
    ["fence-step", steps("executing", ["step-1--outcome-1", "step-2--outcome-2"]), step2 + step1 + "```sh\nnpm test\n", "Step 2 — Outcome 2"],
    [
      "comment-step",
      steps("executing", ["step-1--outcome-1", "step-2--outcome-2"]),
      "## Step 2 — Outcome 2\nProof. <!-- reviewed -->\n\n" + step1 + "<!-- draft\n",
      "Step 2 — Outcome 2",
    ],
  ]) {
    const dir = fixture("open-block-" + name, { "plan.md": plan, "result.md": result });
    const before = readdirSync(dir).sort().map((file) => [file, readFileSync(join(dir, file))]);
    const child = cli(dir);
    assert.equal(child.status, 2, name + ": " + child.stdout);
    assert.ok(child.stderr.includes(`"${hidden}"`), child.stderr);
    assert.ok(child.stderr.includes('"Step 1 — Outcome 1"'), child.stderr);
    assert.match(child.stderr, /open code fence or HTML comment.*close it/, child.stderr);
    assert.equal(child.stdout, "");
    assert.deepEqual(readdirSync(dir).sort().map((file) => [file, readFileSync(join(dir, file))]), before);
  }
});
test("unmarked legacy logs still convert and disclose missing acceptance evidence", () => {
  const dir = fixture("legacy-with-findings", {
    "plan.md": steps("done", ["full-run"]),
    "result.md": "## Full Run\nOriginal proof.\n\n## Open findings\nNone.\n",
  });
  run(dir);
  const result = readFileSync(join(dir, "result.md"), "utf8");
  assert.match(result, /## Step 1 — Outcome 1[\s\S]*Original proof\./);
  assert.match(result, /## Acceptance\n+No acceptance record was kept\./);
});
test("current results keep cleared and recorded step commits when an old checkpoint survives", () => {
  const template = readFileSync(new URL("../references/templates/result.md", import.meta.url), "utf8");
  const header = template.split("## Current state")[0];
  const first = "## Step 1 — Outcome 1\nRe-executed.\n\n";
  const second = "## Step 2 — Outcome 2\n**Commit:** SHA `aaa2222`\n\n";
  const gate = "## Checkpoint after Step 2\n**Outcome:** passed\n**Commit:** SHA `bbb3333`\n";
  const marker = "<!-- agents-kit: migrated task result -->";
  for (const [name, prefix, existing, unresolved] of [
    ["native-template", header, "## Step 2 — Outcome 2\nRe-executed.\n\n", []],
    ["unmarked-current", "", second, []],
    ["unmarked-empty-commit", "", second.replace(" SHA `aaa2222`", ""), []],
    ["ambiguous", "", "", ["Step 1"]],
  ] as const) {
    const dir = fixture("current-" + name, {
      "plan.md": steps("executing", ["step-1--outcome-1", "step-2--outcome-2"]),
      "result.md": prefix + first + existing + gate,
    });
    const preview = run(dir);
    assert.deepEqual(preview.unresolvedCommits, unresolved);
    const result = readFileSync(join(dir, "result.md"), "utf8");
    assert.ok(result.includes(marker));
    const records = result.split(gate)[0];
    assert.ok(!records.includes("bbb3333"));
    if (existing) assert.ok(records.includes(existing.trimEnd()));
  }
  assert.ok(header.includes(marker));
});
test("converting a result before any gate exists protects later in-place step updates", () => {
  const dir = fixture("early-migration", {
    "plan.md": steps("executing", ["full-run"]),
    "result.md": "## Full Run\nInitial work.\n",
  });
  run(dir);
  const path = join(dir, "result.md");
  const result = readFileSync(path, "utf8").replace("Initial work.", "Re-executed.") +
    "\n## Checkpoint after Step 1\n**Outcome:** passed\n**Commit:** SHA `ddd5555`\n";
  writeFileSync(path, result);
  assert.deepEqual(report(dir).changes, []);
  assert.deepEqual(report(dir).unresolvedCommits, []);
  assert.equal(readFileSync(path, "utf8"), result);
});
test("two snapshot notes in one section recover distinct evidence and preserve later edits on the first apply", () => {
  const path = join(home, ".local/state/agents-kit/compaction");
  mkdirSync(path, { recursive: true });
  const notes = ["First observation.", "Second observation."].map((evidence) => {
    const bytes = "## Step 1 — Outcome 1\n" + evidence + "\n";
    const name = "multiple-" + createHash("sha256").update(bytes).digest("hex").slice(0, 12) + ".md";
    writeFileSync(join(path, name), bytes);
    return "Compacted 2025-01-01; full text in `~/.local/state/agents-kit/compaction/" + name + "`.\n";
  });
  const result = "## Step 1 — Outcome 1\n" + notes.join("\n") + "A later observation.\n";
  const dir = fixture("many-snapshots", {
    "plan.md": steps("executing", ["step-1--outcome-1"]),
    "result.md": result,
    "goals.md": goals,
  });
  run(dir);
  const live = readFileSync(join(dir, "result.md"), "utf8");
  for (const s of ["First observation.", "Second observation.", "A later observation."]) assert.ok(live.includes(s), s);
  assert.ok(!live.includes("Compacted"));
  assert.ok(readFileSync(join(dir, "history.md"), "utf8").includes(result));
});

test("a restored checkpoint covers its original step and keeps the compacted source and its links", () => {
  const path = join(home, ".local/state/agents-kit/compaction");
  mkdirSync(path, { recursive: true });
  const heading = "## Checkpoint after Step 1 — first\r\n";
  const saved = heading + "**Outcome:** passed\r\n**Commit:** SHA `acd1234`\r\n";
  const name = "gate-" + createHash("sha256").update(saved).digest("hex").slice(0, 12) + ".md";
  writeFileSync(join(path, name), saved);
  const compacted = heading + "Compacted 2025-01-01; full text in `~/.local/state/agents-kit/compaction/" + name + "`.\r\n";
  const dir = fixture("snapshot-coverage", {
    "plan.md": steps("executing", ["step-1--outcome-1", "step-2--outcome-2"]),
    "result.md": "## Step 1 — Outcome 1\nShipped.\n" + compacted + "## Step 2 — Outcome 2\nLater.\n",
    "proof.md": "[gate](./result.md#checkpoint-after-step-1--first)\n",
  });
  run(dir);
  const result = readFileSync(join(dir, "result.md"), "utf8");
  assert.match(result, /## Step 1 — Outcome 1\nShipped\.\n\n\*\*Commit:\*\* SHA `acd1234`\n/);
  assert.doesNotMatch(result.split("## Step 2 — Outcome 2")[1].split("## Checkpoint")[0], /\*\*Commit:\*\*/);
  assert.ok(result.includes("**Outcome:** passed\r\n**Commit:** SHA `acd1234`\r\n"));
  assert.ok(readFileSync(join(dir, "history.md"), "utf8").includes(compacted));
  assert.equal(readFileSync(join(dir, "proof.md"), "utf8"), "[gate](./result.md#checkpoint-after-step-1)\n");
});
test("group history preserves log bytes and prior decisions; only source decision dates reach current rules", () => {
  const decisions =
    "## Decisions\r\n\r\n- GQ2: ordinary rule (GROUP_LOG.md § Change set — 2023-01-02: answer).\r\n" +
    "* Starred rule (GROUP_LOG.md § Change set — 2023-01-02: answer).\r\n" +
    "+ Added rule (GROUP_LOG.md § Change set — 2023-01-02: answer).\r\n" +
    "  12. Numbered rule (GROUP_LOG.md § Change set — 2023-01-02: answer).\r\n" +
    "- Restated rule (ADR §6.2; GROUP_LOG.md § Change set — 2023-01-03: compaction 3).\r\n" +
    "- Moved rule (GROUP_LOG.md § Change set — 2023-01-04: restructure).\r\n" +
    "- From the task ([record](./worker/result.md#approval)).\r\n" +
    "- Use the [approval flow](./worker/result.md#approval).\r\n" +
    "- Show [approval [manual]](./worker/result.md#approval).\r\n" +
    "- Is [approval required](<./worker/result.md#approval>)?\r\n" +
    "- Set [approved] ([evidence](./worker/result.md#approval)).\r\n" +
    "- GQ3: see Decision #12 — DECISIONS.md.\r\n\r\n";
  const ctx = "# Group\r\n\r\n" + decisions + "## Open Questions\r\n\r\n- GQ4 — open\r\n";
  const log =
    "# Log\r\n\r\n## Change set — 2023-01-02: answer\r\nGQ21 agreed.  \r\n\r\n" +
    "## Change set — 2023-01-03: compaction 3\r\nOld notes.\r\n\r\n## Change set — 2023-01-04: restructure\r\n";
  const dir = fixture("group", { "GROUP_CONTEXT.md": ctx, "GROUP_LOG.md": log });
  mkdirSync(join(dir, "worker"));
  writeFileSync(join(dir, "worker/result.md"), "## Approval\n**Date:** 2022-12-20\n");
  run(dir);
  const migrated = readFileSync(join(dir, "GROUP_CONTEXT.md"), "utf8");
  const archive = readFileSync(join(dir, "GROUP_HISTORY.md"), "utf8");
  assert.ok(!existsSync(join(dir, "GROUP_LOG.md")));
  assert.ok(archive.startsWith(log));
  assert.ok(archive.includes(decisions));
  for (const line of [
    "- GQ2: ordinary rule. (2023-01-02)",
    "* Starred rule. (2023-01-02)",
    "+ Added rule. (2023-01-02)",
    "  12. Numbered rule. (2023-01-02)",
    "- Restated rule (ADR §6.2).",
    "- Moved rule.",
    "- From the task. (2022-12-20)",
    "- Use the approval flow. (2022-12-20)",
    "- Show approval [manual]. (2022-12-20)",
    "- Is approval required? (2022-12-20)",
    "- Set [approved]. (2022-12-20)",
    "- GQ3: see Decision #12 — DECISIONS.md.",
    "**Last id:** GQ21",
  ]) {
    assert.ok(migrated.split(/\r?\n/).includes(line), line);
  }
});
test("embedded group citations preserve both sentences and use only the closing source for the rule date", () => {
  const old = "GROUP_LOG.md § Change set — 2024-01-02: compaction 9";
  const latest = "GROUP_LOG.md § Change set — 2024-01-04: approved";
  const first = "- Follow the [approval flow](./worker/result.md#approval) (ADR §6.2)";
  const second = " Then publish (ticket A).";
  const example = "- Keep `(" + old + ")` and (`example; " + old + "`) as examples (see ./old/" + old + ").";
  const links = "- Follow the guide (use the [approval flow](./worker/result.md#approval)) and [external source](https://example.org/archive/result.md#approval).";
  const dir = fixture("embedded-group-citations", {
    "GROUP_CONTEXT.md": "## Decisions\n" + first + " (" + old + ")." + second + " (" + latest + ").\n" + example + "\n" + links + "\n",
    "GROUP_LOG.md": "## Change set — 2024-01-02: compaction 9\n## Change set — 2024-01-04: approved\n",
  });
  mkdirSync(join(dir, "worker"));
  writeFileSync(join(dir, "worker/result.md"), "## Approval\n**Date:** 2024-01-01\n");
  run(dir);
  assert.deepEqual(readFileSync(join(dir, "GROUP_CONTEXT.md"), "utf8").split("\n").filter((line) => line.startsWith("- ")), [
    "- Follow the approval flow (ADR §6.2)." + second + " (2024-01-04)",
    example,
    links.replace("[approval flow](./worker/result.md#approval)", "approval flow"),
  ]);
});
test("group shorthand citations require a matching task file and section", () => {
  const prose = [
    "- Follow the guide (rollout plan § 2 lists the cohorts).",
    "- Consult the schedule (worker plan § 2 lists the cohorts).",
    "- Keep cohort names (worker result § 2 lists the cohorts).",
    "- Specify the approval (worker result § Review).",
  ];
  const rules = [
    ...prose,
    "- Use the approval (worker result § Approval).",
    "- Keep the default (worker result § Defaults).",
    "- Use the earlier decision (retired/plan.md § Decision — 2020-01-02: Policy).",
  ];
  const dir = fixture("group-shorthand", { "GROUP_CONTEXT.md": "## Decisions\n" + rules.join("\n") + "\n" });
  mkdirSync(join(dir, "Archive/worker"), { recursive: true });
  writeFileSync(join(dir, "Archive/worker/result.md"), "## Approval\n**Date:** 2021-03-04\n## Defaults\n## Review\n## Review\n");
  run(dir);
  assert.deepEqual(readFileSync(join(dir, "GROUP_CONTEXT.md"), "utf8").split("\n").filter((line) => line.startsWith("- ")), [
    ...prose,
    "- Use the approval. (2021-03-04)",
    "- Keep the default.",
    "- Use the earlier decision. (2020-01-02)",
  ]);
  assert.ok(!existsSync(join(dir, "GROUP_HISTORY.md")));
});
test("the report separates removed files and lists the old log and Decisions copied into group history", () => {
  const dir = fixture("group-report", {
    "GROUP_CONTEXT.md": "# Group\n\n## Decisions\n- GQ1: a standing rule.\n",
    "GROUP_LOG.md": "# Log\n\n## Change set — 2023-01-02: answer\n",
  });
  const preview = report(dir);
  const applied = report(dir, preview.token);
  for (const output of [preview, applied]) {
    assert.deepEqual(output.changes, ["GROUP_HISTORY.md", "GROUP_CONTEXT.md", "GROUP_LOG.md"]);
    assert.deepEqual(output.removed, ["GROUP_LOG.md"]);
    assert.deepEqual(output.moved, [
      { file: "GROUP_LOG.md", heading: "File prefix" },
      { file: "GROUP_CONTEXT.md", heading: "Decisions" },
    ]);
  }
  assert.deepEqual(applied.applied, preview.changes);
  const task = fixture("task-report", { "plan.md": steps("executing", [null]) });
  const converted = run(task);
  assert.deepEqual(converted.changes, ["history.md", "plan.md", "result.md"]);
  assert.deepEqual(converted.removed, []);
});
test("a group without a log retains live rules and creates no history", () => {
  const dir = fixture("no-log", { "GROUP_CONTEXT.md": "# Group\n\n## Decisions\n- GQ8: a standing rule.\n" });
  run(dir);
  assert.ok(!existsSync(join(dir, "GROUP_HISTORY.md")));
  assert.match(readFileSync(join(dir, "GROUP_CONTEXT.md"), "utf8"), /\*\*Last id:\*\* GQ8/);
});
test("Last id changes only the opening metadata and preserves literal examples and question bytes", () => {
  const head = "## Open Questions\r\n \t\r\n";
  const examples = "\r\n```md\r\n**Last id:** GQ37  \r\n```\r\n" +
    "<!--\r\n**Last id:** GQ11\r\n-->\r\n- GQ5 — pending.\r\n\r\n**Last id:** GQ2 \t\r\n";
  for (const [name, before, after] of [
    ["existing", " **Last id:**\tGQ3 \t\r\n" + examples, " **Last id:**\tGQ37 \t\r\n" + examples],
    ["missing", examples.slice(2), "**Last id:** GQ37\r\n\r\n" + examples.slice(2)],
  ]) {
    const dir = fixture("question-metadata-" + name, { "GROUP_CONTEXT.md": head + before });
    run(dir);
    assert.equal(readFileSync(join(dir, "GROUP_CONTEXT.md"), "utf8"), head + after);
    assert.ok(!existsSync(join(dir, "GROUP_HISTORY.md")));
  }
});
test("group history collisions and changed citations preserve the live sources", () => {
  const ctx = "## Decisions\n- Policy ([task](./child/result.md#approval)).\n";
  const dir = fixture("group-guard", { "GROUP_CONTEXT.md": ctx, "GROUP_LOG.md": "old\n" });
  mkdirSync(join(dir, "child"));
  writeFileSync(join(dir, "child/result.md"), "## Approval\n**Date:** 2020-01-01\n");
  const preview = report(dir);
  writeFileSync(join(dir, "child/result.md"), "## Approval\n**Date:** 2020-01-02\n");
  assert.equal(cli(dir, preview.token).status, 2);
  assert.equal(readFileSync(join(dir, "GROUP_CONTEXT.md"), "utf8"), ctx);
  writeFileSync(join(dir, "GROUP_HISTORY.md"), "pre-existing\n");
  assert.equal(cli(dir).status, 2);
  assert.equal(readFileSync(join(dir, "GROUP_LOG.md"), "utf8"), "old\n");
  assert.equal(readFileSync(join(dir, "GROUP_HISTORY.md"), "utf8"), "pre-existing\n");
});
test("nested group previews and repeat applies use their selected copy root and distinguish local task citations", () => {
  const rules = [
    "- Root path (shared/worker/result.md § Approval).",
    "- Qualified shorthand (shared/worker result § Approval).",
    "- Local fallback (legacy/worker/result.md § Approval).",
    "- Local shorthand (worker result § Approval).",
    "- Explicit local path (./shared/worker/result.md § Approval).",
    "- Local [record](shared/worker/result.md#approval).",
    "- Local nested link ([record](shared/worker/result.md#approval)).",
  ];
  const source = "## Decisions\n" + rules.join("\n") + "\n";
  for (const [copy, day] of [["first", "01"], ["second", "02"]]) {
    const store = fixture("nested-group-" + copy, {});
    const dir = join(store, "area", "team");
    for (const [path, month] of [
      ["shared/worker", "01"], ["area/team/shared/worker", "02"], ["area/team/legacy/worker", "03"],
      ["worker", "04"], ["area/team/Archive/worker", "05"],
    ]) {
      mkdirSync(join(store, path), { recursive: true });
      writeFileSync(join(store, path, "result.md"), "## Approval\n**Date:** 2021-" + month + "-" + day + "\n");
    }
    const groupFile = join(dir, "GROUP_CONTEXT.md");
    writeFileSync(groupFile, source);
    const preview = report(dir, undefined, store);
    assert.equal(readFileSync(groupFile, "utf8"), source);
    for (const otherRoot of [undefined, dir, join(store, "shared")]) assert.equal(cli(dir, preview.token, otherRoot).status, 2);
    const record = join(store, "shared/worker/result.md");
    const original = readFileSync(record, "utf8");
    writeFileSync(record, original + "\nEdited.\n");
    assert.equal(cli(dir, preview.token, store).status, 2);
    writeFileSync(record, original);
    mkdirSync(join(store, "legacy/worker"), { recursive: true });
    writeFileSync(join(store, "legacy/worker/result.md"), readFileSync(join(dir, "legacy/worker/result.md")));
    assert.equal(cli(dir, preview.token, store).status, 2);
    rmSync(join(store, "legacy"), { recursive: true });
    symlinkSync(join(dir, "legacy"), join(store, "legacy"));
    assert.equal(cli(dir, undefined, store).status, 2);
    rmSync(join(store, "legacy"));
    assert.deepEqual(report(dir, preview.token, store).applied, ["GROUP_CONTEXT.md"]);
    assert.deepEqual(readFileSync(groupFile, "utf8").split("\n").filter((line) => line.startsWith("-")), [
      "- Root path. (2021-01-" + day + ")", "- Qualified shorthand. (2021-01-" + day + ")",
      "- Local fallback. (2021-03-" + day + ")", "- Local shorthand. (2021-05-" + day + ")",
      "- Explicit local path. (2021-02-" + day + ")", "- Local record. (2021-02-" + day + ")",
      "- Local nested link. (2021-02-" + day + ")",
    ]);
    assert.deepEqual(report(dir, preview.token, store).applied, []);
    assert.deepEqual(report(dir, undefined, store).changes, []);
    for (const otherRoot of [undefined, dir]) assert.equal(cli(dir, preview.token, otherRoot).status, 2);
  }
});

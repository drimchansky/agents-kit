import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { WAKE_MARKER, WAKE_SUBJECT, wakeBody } from "../scripts/orca-status-timer.ts";

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const SKILL = "skills/start-orca/SKILL.md";
const WORKER = "references/workflow/orca-worker.md";
const TIMER_DOC = "references/scripts/orca-status-timer.md";
const MARKER_PREFIX = "agents-kit start-orca";
const CONTROL_MARKER = "agents-kit start-orca control v1";
const RUN_OBJECTIVE = "agents-kit start-orca v1 <kind> <canonical path>";

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function section(text: string, heading: string): string {
  const level = /^#+/.exec(heading)?.[0].length ?? 0;
  assert.ok(level > 0, `not a heading: ${heading}`);
  const body = text.split(`\n${heading}\n`)[1];
  assert.ok(body !== undefined, `missing heading: ${heading}`);
  return body.split(new RegExp(`\\n#{1,${level}} `))[0];
}

function markersIn(text: string): string[] {
  return [...text.matchAll(new RegExp(`${MARKER_PREFIX}[^\`\\n]*`, "g"))].map((match) => match[0]);
}

function fences(text: string): string[] {
  return [...text.matchAll(/^```[^\n]*\n([\s\S]*?)\n```$/gm)].map((match) => match[1]);
}

test("the skill's status-wake marker is the first line the timer sends and its contract documents", () => {
  const report = markersIn(section(source(SKILL), "## Report status"));
  assert.deepEqual(report, [WAKE_MARKER], "§ Report status defines the wake marker the helper exports");
  assert.equal(wakeBody("run-1", "token-1").split("\n")[0], report[0], "the sent wake body starts with the skill's marker");
  const documented = fences(source(TIMER_DOC)).filter((body) => body.startsWith(MARKER_PREFIX));
  assert.deepEqual(documented, [wakeBody("<run-id>", "<token>")], `${TIMER_DOC} documents the body the helper sends`);
});

test("the control-record marker and Run objective are defined once each in their sections", () => {
  const skill = source(SKILL);
  assert.deepEqual(markersIn(section(skill, "## Control records")), [CONTROL_MARKER]);
  assert.deepEqual(markersIn(section(skill, "## Authorize startup")), [RUN_OBJECTIVE]);
});

test("every start-orca marker in the skill, worker reference, and timer contract is a defined format", () => {
  const defined = [RUN_OBJECTIVE, CONTROL_MARKER, WAKE_MARKER, WAKE_SUBJECT];
  for (const path of [SKILL, WORKER, TIMER_DOC]) {
    for (const marker of markersIn(source(path))) {
      assert.ok(defined.includes(marker), `${path} uses undefined start-orca marker ${JSON.stringify(marker)}`);
    }
  }
  assert.ok(!CONTROL_MARKER.startsWith(WAKE_MARKER) && !WAKE_MARKER.startsWith(CONTROL_MARKER), "control records and wakes in Run mail differ by body start");
});

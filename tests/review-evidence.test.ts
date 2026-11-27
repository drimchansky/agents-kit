import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = "references/engineering/review-evidence.md";

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function section(path: string, heading: string): string {
  const level = /^#+/.exec(heading)?.[0].length ?? 0;
  const body = source(path).split(`\n${heading}\n`)[1];
  assert.ok(body !== undefined, `${path} has ${heading}`);
  return body.split(new RegExp(`\\n#{1,${level}} `))[0];
}

test("every approval producer cites the evidence owner", () => {
  for (const path of [
    "references/engineering/review.md",
    "skills/publish-pr-review/SKILL.md",
    "skills/review-code/SKILL.md",
    "skills/review-code-triage-verify/SKILL.md",
    "skills/review-pr-loop/SKILL.md",
  ]) {
    assert.match(source(path), /review-evidence\.md/, `${path} cites ${EVIDENCE}`);
  }
});

test("skill-conventions registers fix-findings-reconcile as a composite", () => {
  const conventions = "references/workflow/skill-conventions.md";
  assert.match(section(conventions, "### Composites — sequential phases"), /^- `fix-findings-reconcile` — /m);
});

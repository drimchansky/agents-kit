import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = "references/engineering/review-evidence.md";
const SOURCES = [
  EVIDENCE,
  "references/engineering/review.md",
  "references/workflow/user-facing-messages.md",
  "references/workflow/reviewer-contract.md",
  "references/workflow/verify-pipeline.md",
  "references/workflow/executor-contract.md",
  "references/workflow/fix-findings-recovery.md",
  "skills/review-code/SKILL.md",
  "skills/review-code-triage-verify/SKILL.md",
  "skills/publish-pr-review/SKILL.md",
  "skills/review-pr-loop/SKILL.md",
  "skills/triage-findings/SKILL.md",
  "skills/fix-findings/SKILL.md",
];

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function headings(path: string): string[] {
  return source(path)
    .split("\n")
    .filter((line) => /^#+ /.test(line))
    .map((line) => line.replace(/^#+ /, ""));
}

test("every approval producer cites the evidence owner", () => {
  for (const path of ["references/engineering/review.md", "skills/publish-pr-review/SKILL.md", "skills/review-pr-loop/SKILL.md"]) {
    assert.match(source(path), /review-evidence\.md/, `${path} cites ${EVIDENCE}`);
  }
});

test("section citations among the review and publication sources resolve to their owners", () => {
  let checked = 0;
  for (const path of SOURCES) {
    for (const [, target, list] of source(path).matchAll(/`(\.{1,2}\/[^`\s]+\.md)`(?: §§? ((?:\*[^*]+\*(?:,? (?:and )?)?)+))?/g)) {
      const file = resolve(ROOT, dirname(path), target);
      assert.ok(existsSync(file), `${path} cites missing ${target}`);
      const owner = relative(ROOT, realpathSync(file));
      if (list === undefined || !SOURCES.includes(owner)) continue;
      const titles = headings(owner);
      for (const [, heading] of list.matchAll(/\*([^*]+)\*/g)) {
        assert.ok(titles.includes(heading), `${path} cites ${target} § ${heading}, which ${owner} lacks`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 0, "the review sources cite sections among themselves");
});

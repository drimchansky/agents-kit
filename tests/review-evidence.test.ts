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
  "references/workflow/pr-lookup.md",
  "skills/review-code/SKILL.md",
  "skills/review-code-triage-verify/SKILL.md",
  "skills/review-docs/SKILL.md",
  "skills/publish-pr-review/SKILL.md",
  "skills/review-pr-loop/SKILL.md",
  "skills/triage-findings/SKILL.md",
  "skills/triage-findings-verify/SKILL.md",
  "skills/fix-findings/SKILL.md",
  "skills/fix-findings-reconcile/SKILL.md",
];
const OWNERS = [...SOURCES, "references/workflow/skill-conventions.md"];

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function headings(path: string): string[] {
  return source(path)
    .split("\n")
    .filter((line) => /^#+ /.test(line))
    .map((line) => line.replace(/^#+ /, ""));
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

test("section citations among the review and publication sources resolve to their owners", () => {
  let checked = 0;
  for (const path of SOURCES) {
    for (const [, target, list] of source(path).matchAll(/`(\.{1,2}\/[^`\s]+\.md)`(?: §§? ((?:\*[^*]+\*(?:,? (?:and )?)?)+))?/g)) {
      const file = resolve(ROOT, dirname(path), target);
      assert.ok(existsSync(file), `${path} cites missing ${target}`);
      const owner = relative(ROOT, realpathSync(file));
      if (list === undefined || !OWNERS.includes(owner)) continue;
      const titles = headings(owner);
      for (const [, heading] of list.matchAll(/\*([^*]+)\*/g)) {
        assert.ok(titles.includes(heading), `${path} cites ${target} § ${heading}, which ${owner} lacks`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 0, "the review sources cite sections among themselves");
});

test("skill-conventions registers fix-findings-reconcile as a composite, and its confirm-gated roster entry names an existing section of the skill", () => {
  const conventions = "references/workflow/skill-conventions.md";
  assert.match(section(conventions, "### Composites — sequential phases"), /^- `fix-findings-reconcile` — /m);
  const roster = source(conventions).split("**Confirm-gated skills:**\n")[1]?.trimStart().split("\n\n")[0] ?? "";
  const entry = roster.split("\n").find((line) => line.startsWith("- `fix-findings-reconcile` — "));
  assert.ok(entry, "the confirm-gated roster lists fix-findings-reconcile");
  const heading = /§ \*([^*]+)\*\.$/.exec(entry)?.[1];
  assert.ok(heading, "the fix-findings-reconcile roster entry names its proposal section");
  assert.ok(headings("skills/fix-findings-reconcile/SKILL.md").includes(heading), `fix-findings-reconcile has § ${heading}`);
});

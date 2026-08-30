import assert from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SKILLS_DIR = join(REPO_DIR, "skills");
const CONVENTIONS = join(REPO_DIR, "references", "workflow", "skill-conventions.md");
const ROSTER_HEADING = "**Gated skills:**";

function skillNames(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(SKILLS_DIR, name, "SKILL.md")))
    .sort();
}

function frontmatter(skill: string): string {
  const lines = readFileSync(join(SKILLS_DIR, skill, "SKILL.md"), "utf8").split("\n");
  assert.strictEqual(lines[0], "---", `${skill}/SKILL.md: no frontmatter fence on line 1`);
  const end = lines.indexOf("---", 1);
  assert.ok(end > 0, `${skill}/SKILL.md: unterminated frontmatter`);
  return lines.slice(1, end).join("\n");
}

function claudeGated(skill: string): boolean {
  return /^disable-model-invocation:\s*true\s*$/m.test(frontmatter(skill));
}

function codexGated(skill: string): boolean {
  const policy = join(SKILLS_DIR, skill, "agents", "openai.yaml");
  if (!existsSync(policy)) return false;
  const text = readFileSync(policy, "utf8");

  const block = /^policy:[ \t]*\n((?:[ \t]+.*\n?)*)/m.exec(text);
  assert.ok(
    block && /^[ \t]+allow_implicit_invocation:[ \t]*false[ \t]*$/m.test(block[1]),
    `${skill}/agents/openai.yaml exists but does not deny implicit invocation:\n${text}`,
  );
  return true;
}

function rosterMembers(): string[] {
  const lines = readFileSync(CONVENTIONS, "utf8").split("\n");
  const start = lines.indexOf(ROSTER_HEADING);
  assert.ok(
    start >= 0,
    `${ROSTER_HEADING} not found in skill-conventions.md — the roster moved or was renamed, and this ` +
      "invariant has no other reader",
  );
  const members: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      if (members.length === 0) continue;
      break;
    }
    const match = /^- `([^`]+)`/.exec(line);
    assert.ok(match, `unparseable roster entry: ${line}`);
    members.push(match[1]);
  }
  assert.ok(members.length > 0, "the gate roster is empty");
  return members.sort();
}

test("every gated skill closes both host doors", () => {
  const mismatched = skillNames()
    .map((skill) => ({ skill, claude: claudeGated(skill), codex: codexGated(skill) }))
    .filter((row) => row.claude !== row.codex)
    .map((row) =>
      row.claude
        ? `${row.skill}: gated for Claude Code, still open on Codex (no agents/openai.yaml)`
        : `${row.skill}: gated for Codex, still open on Claude Code (no frontmatter flag)`,
    );
  assert.deepStrictEqual(mismatched, [], `half-closed doors:\n${mismatched.join("\n")}`);
});

test("the roster names exactly the skills the mechanisms gate", () => {
  const gated = skillNames().filter((skill) => claudeGated(skill) || codexGated(skill));
  assert.deepStrictEqual(
    rosterMembers(),
    gated.sort(),
    "skill-conventions.md § The invocation gate's roster and the on-disk mechanisms disagree — " +
      "record the door in the same change that flips it",
  );
});

import assert from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SKILLS_DIR = join(REPO_DIR, "skills");
const CONVENTIONS = join(REPO_DIR, "references", "workflow", "skill-conventions.md");
const ROSTER_HEADING = "**Confirm-gated skills:**";
const MARKER_PREFIX = "**Model invocation:**";
const MARKER_LINE = canonicalMarkerLine();

function canonicalMarkerLine(): string {
  const spans = [...readFileSync(CONVENTIONS, "utf8").matchAll(/this exact line: ``(.+?)``/g)];
  assert.strictEqual(
    spans.length,
    1,
    "skill-conventions.md § The invocation gate renders the canonical line in exactly one ``…`` span after \"this exact line:\"",
  );
  assert.ok(spans[0][1].startsWith(MARKER_PREFIX), "the canonical line does not start with **Model invocation:**");
  return spans[0][1];
}

function skillNames(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(SKILLS_DIR, name, "SKILL.md")))
    .sort();
}

function skillFile(skill: string): string {
  return readFileSync(join(SKILLS_DIR, skill, "SKILL.md"), "utf8");
}

function frontmatter(skill: string): string {
  const lines = skillFile(skill).split("\n");
  assert.strictEqual(lines[0], "---", `${skill}/SKILL.md: no frontmatter fence on line 1`);
  const end = lines.indexOf("---", 1);
  assert.ok(end > 0, `${skill}/SKILL.md: unterminated frontmatter`);
  return lines.slice(1, end).join("\n");
}

function claudeDoorClosedText(frontmatterText: string): boolean {
  const text = frontmatterText
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  return (
    /^[ \t]*["']?disable-model-invocation["']?[ \t]*:\s*["']?true["']?(\s+#.*)?\s*$/im.test(text) ||
    /\{[^}]*\bdisable-model-invocation["']?[ \t]*:\s*["']?true["']?(\s+#.*)?\s*[,}]/i.test(text)
  );
}

function claudeDoorClosed(skill: string): boolean {
  return claudeDoorClosedText(frontmatter(skill));
}

function codexDoorClosedText(policyText: string): boolean {
  const text = policyText
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  return (
    /^[ \t]*(- )?["']?allow_implicit_invocation["']?[ \t]*:\s*["']?false["']?(\s+#.*)?\s*$/im.test(text) ||
    /\{[^}]*\ballow_implicit_invocation["']?[ \t]*:\s*["']?false["']?(\s+#.*)?\s*[,}]/i.test(text)
  );
}

function codexDoorClosed(skill: string): boolean {
  const policy = join(SKILLS_DIR, skill, "agents", "openai.yaml");
  if (!existsSync(policy)) return false;
  return codexDoorClosedText(readFileSync(policy, "utf8"));
}

function confirmGated(skill: string): boolean {
  const lines = skillFile(skill).split("\n");
  const markers = lines.filter((line) => line.trimStart().startsWith(MARKER_PREFIX));
  for (const line of markers) {
    assert.strictEqual(
      line,
      MARKER_LINE,
      `${skill}/SKILL.md: a model-invocation line differs from the canonical marker ` +
        "(skill-conventions.md § The invocation gate)",
    );
  }
  if (markers.length === 0) return false;
  assert.strictEqual(
    markers.length,
    1,
    `${skill}/SKILL.md: the model-invocation line appears ${markers.length} times; it sits once, directly after the ` +
      "Core Rules block (skill-conventions.md § The invocation gate)",
  );
  const coreRules = lines.indexOf("## Core Rules");
  assert.ok(coreRules >= 0, `${skill}/SKILL.md: no Core Rules block for the model-invocation line to follow`);
  let next = coreRules + 1;
  while (next < lines.length && (lines[next].trim() === "" || /^\d+\. /.test(lines[next]))) next += 1;
  assert.strictEqual(
    lines[next],
    MARKER_LINE,
    `${skill}/SKILL.md: the model-invocation line must directly follow the Core Rules block ` +
      "(skill-conventions.md § The invocation gate)",
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
  assert.ok(members.length > 0, "the confirm-gated roster is empty");
  return members.sort();
}

test("the Claude door detector flags block, flow, and quoted closings and ignores open or commented-out settings", () => {
  const claudeFrontmatters = [
    { form: "block", text: "name: demo\ndisable-model-invocation: true\neffort: high", closed: true },
    { form: "indented-root block", text: "  name: demo\n  disable-model-invocation: true\n", closed: true },
    { form: "flow", text: "name: demo\nmetadata: { disable-model-invocation: true }", closed: true },
    { form: "flow with inline comment", text: "{ name: demo, disable-model-invocation: true # explicit only\n}\n", closed: true },
    { form: "quoted with comment", text: "name: demo\n\"disable-model-invocation\": 'true' # confirm first", closed: true },
    { form: "spaced-colon block", text: "name: demo\ndisable-model-invocation : true", closed: true },
    { form: "spaced-colon flow", text: "name: demo\nmetadata: { disable-model-invocation : true }", closed: true },
    { form: "opposite value", text: "name: demo\ndisable-model-invocation: false", closed: false },
    { form: "comment-only line", text: "name: demo\n# disable-model-invocation: true", closed: false },
    { form: "comment-only flow line", text: "# settings: { disable-model-invocation: true }", closed: false },
  ];
  for (const { form, text, closed } of claudeFrontmatters) {
    assert.strictEqual(claudeDoorClosedText(text), closed, `SKILL.md frontmatter, ${form}: ${JSON.stringify(text)}`);
  }
});

test("the Codex door detector flags block, flow, and quoted closings and ignores open or commented-out settings", () => {
  const codexPolicies = [
    { form: "block", text: "policy:\n  allow_implicit_invocation: false", closed: true },
    { form: "flow", text: "policy: { allow_implicit_invocation: false }", closed: true },
    { form: "flow with inline comment", text: "policy: { allow_implicit_invocation: false # explicit only\n}\n", closed: true },
    { form: "quoted with comment", text: "policy:\n  'allow_implicit_invocation': \"false\" # confirm first", closed: true },
    { form: "spaced-colon block", text: "policy:\n  allow_implicit_invocation : false", closed: true },
    { form: "spaced-colon flow", text: "policy: { allow_implicit_invocation : false }", closed: true },
    { form: "opposite value", text: "policy:\n  allow_implicit_invocation: true", closed: false },
    { form: "comment-only line", text: "policy:\n  # allow_implicit_invocation: false", closed: false },
    { form: "comment-only flow line", text: "# policy: { allow_implicit_invocation: false }", closed: false },
  ];
  for (const { form, text, closed } of codexPolicies) {
    assert.strictEqual(codexDoorClosedText(text), closed, `agents/openai.yaml, ${form}: ${JSON.stringify(text)}`);
  }
});

test("no skill closes a host door", () => {
  const closed = skillNames().flatMap((skill) => [
    ...(claudeDoorClosed(skill) ? [`${skill}: SKILL.md frontmatter carries disable-model-invocation: true`] : []),
    ...(codexDoorClosed(skill) ? [`${skill}: agents/openai.yaml denies implicit invocation`] : []),
  ]);
  assert.deepStrictEqual(
    closed,
    [],
    "host doors are closed; the kit gates by confirmed proposal instead " +
      `(skill-conventions.md § The invocation gate):\n${closed.join("\n")}`,
  );
});

test("the roster names exactly the skills carrying the model-invocation line", () => {
  assert.deepStrictEqual(
    rosterMembers(),
    skillNames().filter(confirmGated),
    "skill-conventions.md § The invocation gate's roster and the SKILL.md model-invocation lines disagree — " +
      "add or remove the line and the roster entry in the same change",
  );
});

import assert from "node:assert";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_DIR = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const SKILL_DIR = join(REPO_DIR, "skills", "start-group");
const SKILL = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
const WORKFLOW_DIR = join(REPO_DIR, "references", "workflow");
const CONVENTIONS = readFileSync(join(WORKFLOW_DIR, "skill-conventions.md"), "utf8");
const DOMAIN_PACKS = readFileSync(join(WORKFLOW_DIR, "domain-packs.md"), "utf8");

function section(text: string, heading: string): string {
  const level = /^#+/.exec(heading)?.[0].length ?? 0;
  assert.ok(level > 0, `not a heading: ${heading}`);
  const body = text.split(`\n${heading}\n`)[1];
  assert.ok(body !== undefined, `missing heading: ${heading}`);
  return body.split(new RegExp(`\\n#{1,${level}} `))[0];
}

function frontmatter(text: string): Map<string, string> {
  const lines = text.split("\n");
  assert.strictEqual(lines[0], "---", "SKILL.md opens with a frontmatter fence");
  const end = lines.indexOf("---", 1);
  assert.ok(end > 0, "SKILL.md frontmatter is terminated");
  const fields = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    const match = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (match) fields.set(match[1], match[2].replace(/^(["'])(.*)\1$/, "$2"));
  }
  return fields;
}

test("frontmatter names the skill and carries a description", () => {
  const fields = frontmatter(SKILL);
  assert.strictEqual(fields.get("name"), "start-group");
  assert.notStrictEqual((fields.get("description") ?? "").trim(), "", "the skill has a description");
});

test("the frontmatter reader reads quoted empty descriptions as empty", () => {
  const forms = [
    { form: "double-quoted empty", text: '---\nname: demo\ndescription: ""\n---\n' },
    { form: "single-quoted empty", text: "---\nname: demo\ndescription: ''\n---\n" },
  ];
  for (const { form, text } of forms) {
    assert.strictEqual((frontmatter(text).get("description") ?? "").trim(), "", `SKILL.md frontmatter, ${form}: ${JSON.stringify(text)}`);
  }
});

test("the skill links the shared references, ships no AGENTS.md link, and cites no domain pack", () => {
  assert.strictEqual(
    lstatSync(join(SKILL_DIR, "AGENTS.md"), { throwIfNoEntry: false }),
    undefined,
    "the skill ships no AGENTS.md link, so it never loads the core rules itself",
  );
  const references = join(SKILL_DIR, "references");
  assert.ok(lstatSync(references).isSymbolicLink(), "references is a symlink");
  assert.strictEqual(readlinkSync(references), "../../references", "references points at ../../references");
  assert.doesNotMatch(SKILL, /references\/(engineering|documentation)\//, "the skill resolves no domain pack");
});

test("skill-conventions and domain-packs register the skill as a pack-free standalone protocol", () => {
  assert.match(section(CONVENTIONS, "### Standalone protocols"), /^- `start-group` — /m);
  const packFree = DOMAIN_PACKS.split("- **Pack-free skills**")[1]?.split("\n\n")[0] ?? "";
  assert.match(packFree, /^ {2}- `start-group` /m);
});

test("the skill cites required workflow sections", () => {
  for (const owner of [
    "references/workflow/task-store.md",
    "references/workflow/context-schema.md",
    "references/workflow/reconciliation.md",
    "references/workflow/skill-conventions.md",
  ]) {
    const escaped = owner.replaceAll(".", "\\.");
    assert.match(SKILL, new RegExp(`\`\\./${escaped}\` § \\*[^*]+\\*`), `the skill cites a section of ${owner}`);
  }
});

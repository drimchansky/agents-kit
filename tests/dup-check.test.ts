import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(REPO_DIR, "scripts", "dup-check.ts");
const TEST_ROOT = mkdtempSync(join(tmpdir(), "agents-kit-dup-check-"));
const FENCE = "```";

const SHARED = "The executor proves the criterion it was handed and returns evidence to the coordinator.";
const SHARED_NORMALIZED =
  "the executor proves the criterion it was handed and returns evidence to the coordinator.";
const OTHER_SHARED = "Every unit of work returns one evidence report with each heading present and filled.";
const SHORT = "This fixture line carries only eight words in total.";
const DESCRIPTION =
  "description: Use when a fixture needs a frontmatter description long enough to pass the twelve word floor.";

after(() => rmSync(TEST_ROOT, { recursive: true, force: true }));

interface Occurrence {
  readonly file: string;
  readonly line: number;
}

interface Group {
  readonly sentence: string;
  readonly occurrences: readonly Occurrence[];
}

interface AllowEntry {
  readonly sentence: string;
  readonly reason: string;
  readonly files?: readonly string[];
}

interface Report {
  readonly root: string;
  readonly files: number;
  readonly groups: readonly Group[];
  readonly allowed: number;
  readonly stale: readonly AllowEntry[];
}

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function kit(name: string, files: Readonly<Record<string, string>>): string {
  const dir = join(TEST_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "references"), { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  return dir;
}

function run(args: readonly string[]): Run {
  const child = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  return { status: child.status, stdout: child.stdout, stderr: child.stderr };
}

function check(dir: string, args: readonly string[] = []): { run: Run; report: Report } {
  const child = run([...args, dir]);
  assert.ok(
    child.status === 0 || child.status === 1,
    `expected a report, got exit ${child.status}: ${child.stderr}`,
  );
  return { run: child, report: JSON.parse(child.stdout) as Report };
}

function group(report: Report, sentence: string): Group {
  const found = report.groups.find((entry) => entry.sentence === sentence);
  assert.ok(found, `not flagged: ${sentence}\nflagged: ${report.groups.map((e) => e.sentence).join("\n")}`);
  return found;
}

function allowFile(dir: string, entries: readonly AllowEntry[]): void {
  const abs = join(dir, "tests", "dup-allow.json");
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(entries, null, 2) + "\n");
}

test("a sentence of twelve or more words in two files is reported with both occurrences", () => {
  const dir = kit("shared-sentence", {
    "references/a.md": `# Alpha\n\n${SHORT}\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.strictEqual(report.root, dir);
  assert.strictEqual(report.files, 2);
  assert.strictEqual(report.groups.length, 1);
  assert.deepStrictEqual(group(report, SHARED_NORMALIZED).occurrences, [
    { file: "references/a.md", line: 5 },
    { file: "references/b.md", line: 3 },
  ]);
});

test("the same sentence inside a fenced block is not a second occurrence", () => {
  const dir = kit("fenced", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\n${FENCE}text\n${SHARED}\n${FENCE}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.deepStrictEqual(report.groups, []);
});

test("an unclosed fence inside a blockquote ends with the quote, not with the file", () => {
  const dir = kit("blockquote-fence", {
    "references/a.md": `# Alpha\n\n> ${FENCE}text\n> ${SHARED}\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(
    group(report, SHARED_NORMALIZED).occurrences,
    [
      { file: "references/a.md", line: 6 },
      { file: "references/b.md", line: 3 },
    ],
    "the quoted copy is fenced, the prose after the quote is not",
  );
});

test("a SKILL.md Core Rules section is not a second occurrence", () => {
  const dir = kit("core-rules", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "skills/demo/SKILL.md": `---\nname: demo\n---\n\n## Core Rules\n\n${SHARED}\n\n### Still the section\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.deepStrictEqual(report.groups, []);
});

test("the Core Rules skip ends at the next section of the same level", () => {
  const dir = kit("core-rules-bounded", {
    "references/a.md": `# Alpha\n\n${SHARED}\n\n${OTHER_SHARED}\n`,
    "skills/demo/SKILL.md": `---\nname: demo\n---\n\n## Core Rules\n\n${SHARED}\n\n## Body\n\n${OTHER_SHARED}\n`,
  });

  const { report } = check(dir);

  assert.strictEqual(report.groups.length, 1);
  assert.deepStrictEqual(group(report, OTHER_SHARED.toLowerCase()).occurrences, [
    { file: "references/a.md", line: 5 },
    { file: "skills/demo/SKILL.md", line: 11 },
  ]);
});

test("a paragraph carrying the sanctioned-copy phrase is not a second occurrence", () => {
  const dir = kit("sanctioned", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED} It is a sanctioned copy per \`AGENTS.md\` § *Consumer lists*, so it stays.\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.deepStrictEqual(report.groups, []);
});

test("a copy hard-wrapped across two lines is still an occurrence, reported at its first line", () => {
  const dir = kit("wrapped", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/b.md": "# Beta\n\nThe executor proves the criterion it was handed and\nreturns evidence to the coordinator.\n",
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(group(report, SHARED_NORMALIZED).occurrences, [
    { file: "references/a.md", line: 3 },
    { file: "references/b.md", line: 3 },
  ]);
});

test("a sentence boundary abutted by an emphasis marker still splits", () => {
  const dir = kit("bold-lead-in", {
    "references/a.md": `# Alpha\n\n**A bold lead-in ends here.** ${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(group(report, SHARED_NORMALIZED).occurrences, [
    { file: "references/a.md", line: 3 },
    { file: "references/b.md", line: 3 },
  ]);
});

test("a symlinked directory inside references is skipped rather than walked", () => {
  const dir = kit("symlinked", { "references/real/a.md": `# Alpha\n\n${SHARED}\n` });
  symlinkSync("real", join(dir, "references", "link"));

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.strictEqual(report.files, 1);
  assert.match(child.stderr, /skipping symlink references\/link/);
});

test("a symlinked references root is skipped rather than walked", () => {
  const dir = kit("symlinked-references-root", {
    "outside/a.md": `# Alpha\n\n${SHARED}\n`,
    "skills/demo/SKILL.md": `# Demo\n\n${SHARED}\n`,
  });
  rmSync(join(dir, "references"), { recursive: true, force: true });
  symlinkSync("outside", join(dir, "references"));

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.strictEqual(report.files, 1, "only the SKILL.md; nothing behind the link");
  assert.deepStrictEqual(report.groups, []);
  assert.match(child.stderr, /^\[dup-check\] skipping symlink references$/m);
});

test("a symlinked skills root is skipped rather than walked", () => {
  const dir = kit("symlinked-skills-root", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "outside/demo/SKILL.md": `# Demo\n\n${SHARED}\n`,
  });
  symlinkSync("outside", join(dir, "skills"));

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.strictEqual(report.files, 1, "only references/a.md; nothing behind the link");
  assert.deepStrictEqual(report.groups, []);
  assert.match(child.stderr, /^\[dup-check\] skipping symlink skills$/m);
});

test("an absent references directory is still a refusal", () => {
  const dir = kit("no-references", { "skills/demo/SKILL.md": `# Demo\n\n${SHARED}\n` });
  rmSync(join(dir, "references"), { recursive: true, force: true });

  const child = run([dir]);

  assert.strictEqual(child.status, 2);
  assert.match(child.stderr, /cannot list references: ENOENT/);
});

test("a sentence repeated inside one file is not a finding", () => {
  const dir = kit("same-file", { "references/a.md": `# Alpha\n\n${SHARED}\n\n${SHARED}\n` });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.deepStrictEqual(report.groups, []);
});

test("a shared sentence under the twelve-word floor is not a finding", () => {
  const dir = kit("too-short", {
    "references/a.md": `# Alpha\n\n${SHORT}\n`,
    "references/b.md": `# Beta\n\n${SHORT}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.deepStrictEqual(report.groups, []);
});

test("YAML frontmatter is not scanned", () => {
  const dir = kit("frontmatter", {
    "skills/one/SKILL.md": `---\nname: one\n${DESCRIPTION}\n---\n\n# One\n\nThe first fixture skill says something entirely of its own here.\n`,
    "skills/two/SKILL.md": `---\nname: two\n${DESCRIPTION}\n---\n\n# Two\n\nThe second fixture skill says something else entirely of its own.\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.deepStrictEqual(report.groups, []);
});

test("a missing allow-file is an empty allow-list, not a refusal", () => {
  const dir = kit("no-allow-file", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.strictEqual(report.allowed, 0);
  assert.deepStrictEqual(report.stale, []);
});

test("an allow-listed sentence passes the check", () => {
  const dir = kit("allowed", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });
  const flagged = group(check(dir).report, SHARED_NORMALIZED).sentence;
  allowFile(dir, [{ sentence: flagged, reason: "a deliberate mirror" }]);

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 0);
  assert.deepStrictEqual(report.groups, []);
  assert.strictEqual(report.allowed, 1);
  assert.deepStrictEqual(report.stale, []);
});

test("an allow-listed sentence that occurs once is reported as stale", () => {
  const dir = kit("stale-allow", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\nThe second file says something else entirely of its own here.\n`,
  });
  allowFile(dir, [{ sentence: SHARED_NORMALIZED, reason: "a mirror that was collapsed" }]);

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(report.groups, []);
  assert.strictEqual(report.allowed, 0);
  assert.deepStrictEqual(report.stale, [
    { sentence: SHARED_NORMALIZED, reason: "a mirror that was collapsed" },
  ]);
});

test("an allow-file given by --allow replaces the default path", () => {
  const dir = kit("allow-flag", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });
  const allow = join(TEST_ROOT, "allow-flag.json");
  writeFileSync(allow, JSON.stringify([{ sentence: SHARED, reason: "given by flag" }]));

  const { run: child, report } = check(dir, ["--allow", allow]);

  assert.strictEqual(child.status, 0);
  assert.strictEqual(report.allowed, 1);
});

test("no kit root is a refusal", () => {
  const child = run([]);

  assert.strictEqual(child.status, 2);
  assert.strictEqual(child.stdout, "");
  assert.match(child.stderr, /usage: node scripts\/dup-check\.ts/);
});

test("an unparseable allow-file is a refusal", () => {
  const dir = kit("bad-allow", { "references/a.md": `# Alpha\n\n${SHARED}\n` });
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(join(dir, "tests", "dup-allow.json"), "{not json");

  const child = run([dir]);

  assert.strictEqual(child.status, 2);
  assert.match(child.stderr, /not readable as JSON/);
});

test("an allow-file entry without a reason is a refusal", () => {
  const dir = kit("reasonless-allow", { "references/a.md": `# Alpha\n\n${SHARED}\n` });
  allowFile(dir, [{ sentence: SHARED_NORMALIZED } as AllowEntry]);

  const child = run([dir]);

  assert.strictEqual(child.status, 2);
  assert.match(child.stderr, /carries no reason/);
});

test("both root rule files are corpus members, not only references and skills", () => {
  const dir = kit("root-rules", {
    "references/a.md": `# Alpha\n\n${SHORT}\n`,
    "skills/one/SKILL.md": `# One\n\n${SHORT}\n`,
    "CORE_RULES.md": `# Core\n\n${SHARED}\n`,
    "AGENTS.md": `# Agents\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.strictEqual(report.files, 4, "references, a SKILL.md, and both root rule files");
  assert.deepStrictEqual(group(report, SHARED_NORMALIZED).occurrences, [
    { file: "AGENTS.md", line: 3 },
    { file: "CORE_RULES.md", line: 3 },
  ]);
});

test("the same sentence as a bullet in one file and prose in another is one group", () => {
  const dir = kit("bullet-vs-prose", {
    "references/a.md": `# Alpha\n\n- ${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  const found = group(report, SHARED_NORMALIZED);
  assert.deepStrictEqual(
    found.occurrences.map((entry) => entry.file),
    ["references/a.md", "references/b.md"],
    "a leading list marker is structure, not part of the sentence",
  );
});

test("an allow entry naming its files suppresses only a group in exactly those files", () => {
  const dir = kit("allow-files", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });
  allowFile(dir, [
    { sentence: SHARED_NORMALIZED, reason: "a deliberate mirror", files: ["references/a.md", "references/b.md"] },
  ]);

  const { run: scoped, report: scopedReport } = check(dir);

  assert.strictEqual(scoped.status, 0);
  assert.deepStrictEqual(scopedReport.groups, []);
  assert.strictEqual(scopedReport.allowed, 1);
  assert.deepStrictEqual(scopedReport.stale, []);

  writeFileSync(join(dir, "references", "c.md"), `# Gamma\n\n${SHARED}\n`);
  const { run: third, report } = check(dir);

  assert.strictEqual(third.status, 1, "a third copy is drift the entry never excused");
  assert.deepStrictEqual(
    group(report, SHARED_NORMALIZED).occurrences.map((entry) => entry.file),
    ["references/a.md", "references/b.md", "references/c.md"],
  );
  assert.strictEqual(report.allowed, 0);
  assert.deepStrictEqual(report.stale, [], "the sentence still occurs twice, so the entry is not stale");
});

test("an allow entry whose copy moved to a file it never named reports the group", () => {
  const dir = kit("allow-files-moved", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/c.md": `# Gamma\n\n${SHARED}\n`,
  });
  allowFile(dir, [
    { sentence: SHARED_NORMALIZED, reason: "a deliberate mirror", files: ["references/a.md", "references/b.md"] },
  ]);

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(
    group(report, SHARED_NORMALIZED).occurrences.map((entry) => entry.file),
    ["references/a.md", "references/c.md"],
  );
  assert.strictEqual(report.allowed, 0);
  assert.deepStrictEqual(report.stale, []);
});

test("an allow entry whose files are not a list of paths is a refusal", () => {
  const dir = kit("allow-files-malformed", { "references/a.md": `# Alpha\n\n${SHARED}\n` });
  allowFile(dir, [
    { sentence: SHARED_NORMALIZED, reason: "a deliberate mirror", files: "references/a.md" } as unknown as AllowEntry,
  ]);

  const child = run([dir]);

  assert.strictEqual(child.status, 2);
  assert.match(child.stderr, /names files that are not a non-empty array/);
});

test("a stale allow entry is reported exactly as it was written", () => {
  const dir = kit("stale-verbatim", {
    "references/a.md": `# Alpha\n\n${SHARED}\n`,
    "references/b.md": `# Beta\n\nThe second file says something else entirely of its own here.\n`,
  });
  const written = {
    sentence: "The executor proves the `criterion` it was handed and returns evidence to the coordinator.",
    reason: "  a mirror that was collapsed  ",
  };
  allowFile(dir, [written]);

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(report.stale, [written], "the entry round-trips, so a reader finds it in the file by exact match");
});

test("the same sentence blockquoted in one file and prose in another is one group", () => {
  const dir = kit("blockquote-vs-prose", {
    "references/a.md": `# Alpha\n\n> ${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(
    group(report, SHARED_NORMALIZED).occurrences.map((entry) => entry.file),
    ["references/a.md", "references/b.md"],
    "a blockquote marker is structure, not part of the sentence",
  );
});

test("a blockquote wrapped across prefixed lines joins into the same sentence as a plain paragraph", () => {
  const dir = kit("blockquote-wrapped", {
    "references/a.md": `# Alpha\n\n> The executor proves the criterion it was handed\n> and returns evidence to the coordinator.\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(group(report, SHARED_NORMALIZED).occurrences, [
    { file: "references/a.md", line: 3 },
    { file: "references/b.md", line: 3 },
  ]);
});

test("a blockquote opening directly under a prose line starts its own paragraph", () => {
  const dir = kit("blockquote-after-prose", {
    "references/a.md": `# Alpha\n\n${SHORT}\n> ${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(group(report, SHARED_NORMALIZED).occurrences, [
    { file: "references/a.md", line: 4 },
    { file: "references/b.md", line: 3 },
  ]);
});

test("the same sentence as a task-list item in one file and prose in another is one group", () => {
  const dir = kit("task-item-vs-prose", {
    "references/a.md": `# Alpha\n\n- [ ] ${SHARED}\n`,
    "references/b.md": `# Beta\n\n${SHARED}\n`,
    "references/c.md": `# Gamma\n\n- [x] ${SHARED}\n`,
  });

  const { run: child, report } = check(dir);

  assert.strictEqual(child.status, 1);
  assert.deepStrictEqual(
    group(report, SHARED_NORMALIZED).occurrences,
    [
      { file: "references/a.md", line: 3 },
      { file: "references/b.md", line: 3 },
      { file: "references/c.md", line: 3 },
    ],
    "an unchecked or checked task marker is structure, not part of the sentence",
  );
});

test("this repository says nothing twice that its allow-file does not sanction", () => {
  const { run: child, report } = check(REPO_DIR);

  assert.strictEqual(child.status, 0, "the live run reports clean");
  assert.deepStrictEqual(report.groups, [], "a rule restated away from its owner would be flagged here");
  assert.deepStrictEqual(report.stale, [], "an allow entry whose twin was collapsed would be reported here");
});

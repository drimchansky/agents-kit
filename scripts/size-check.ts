#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPORT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const BYTES_PER_TOKEN = 4;

interface Totals {
  readonly bytes: number;
  readonly approxTokens: number;
}

interface SkillTotals {
  readonly skill: string;
  readonly hot: Totals;
  readonly cold: Totals;
  readonly transitive: Totals;
}

interface Report {
  readonly root: string | null;
  readonly skills: readonly SkillTotals[];
  readonly corpus: Totals;
  readonly unresolved: readonly string[];
  readonly corpusMisses: readonly string[];
}

interface Baseline {
  readonly skills?: readonly BaselineEntry[];
  readonly corpus?: Totals;
  readonly hotCapBytes?: number;
}

interface BaselineEntry {
  readonly skill: string;
  readonly hot?: Totals;
  readonly cold?: Totals;
  readonly transitive?: Totals;
}

const totals = (set: Totals): Totals => ({ bytes: set.bytes, approxTokens: set.approxTokens });

function moved(from: number, to: number): string {
  const delta = to - from;
  const tokens = Math.round(delta / BYTES_PER_TOKEN);
  return (
    `${from} -> ${to} bytes ` +
    `(${delta > 0 ? "+" : ""}${delta}, ~${tokens > 0 ? "+" : ""}${tokens} tokens)`
  );
}

function recordedBaseline(baselinePath: string): { baseline?: Baseline; unreadable?: string } {
  let text: string;
  try {
    text = readFileSync(baselinePath, "utf8");
  } catch (err) {
    return err.code === "ENOENT" ? {} : { unreadable: err.code ?? err.message };
  }
  try {
    return { baseline: JSON.parse(text) };
  } catch (err) {
    return { unreadable: err.message };
  }
}

function refuse(message: string): void {
  console.error(`[size-check] ${message}`);
  process.exitCode = 2;
}

function main(): void {
  const args = process.argv.slice(2);
  let update = false;
  let allowCorpusGrowth = false;
  let hotCapArg: number | null = null;
  let baselineArg: string | null = null;
  const roots: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--update") {
      update = true;
      continue;
    }
    if (arg === "--allow-corpus-growth") {
      allowCorpusGrowth = true;
      continue;
    }
    if (arg === "--hot-cap" || arg.startsWith("--hot-cap=")) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[++i];
      if (!value) return refuse("--hot-cap needs a byte count");
      hotCapArg = Number(value);
      if (!Number.isInteger(hotCapArg) || hotCapArg < 0) {
        return refuse(`--hot-cap needs a whole number of bytes, got ${value}`);
      }
      continue;
    }
    if (arg === "--baseline" || arg.startsWith("--baseline=")) {
      baselineArg = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[++i];
      if (!baselineArg) return refuse("--baseline needs a file path");
      continue;
    }
    if (arg.startsWith("-")) return refuse(`unknown option ${arg}`);
    roots.push(arg);
  }
  if (roots.length !== 1) {
    return refuse(
      "usage: node scripts/size-check.ts [--update] [--allow-corpus-growth] [--hot-cap N] " +
        "[--baseline FILE] <kit-root>",
    );
  }
  const root = resolve(roots[0]);
  const baselinePath = baselineArg ? resolve(baselineArg) : join(root, "tests", "size-baseline.json");

  const reportScript = fileURLToPath(new URL("./size-report.ts", import.meta.url));
  let report: Report;
  try {
    report = JSON.parse(
      execFileSync(process.execPath, [reportScript, root], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: REPORT_MAX_BUFFER_BYTES,
      }),
    );
  } catch (err) {
    return refuse(`size-report.ts produced no readable report: ${err.message}`);
  }
  if (report.root == null || report.skills.length === 0) {
    return refuse(`not a measurable kit root: ${root}`);
  }

  if (report.unresolved.length > 0) {
    return refuse(
      `the measurement is incomplete — ${report.unresolved.length} unresolved citation(s), ` +
        `e.g. "${report.unresolved[0]}"; repair the kit before baselining`,
    );
  }

  if (report.corpusMisses.length > 0) {
    return refuse(
      `the measurement is incomplete — the corpus walk missed ${report.corpusMisses.length} path(s), ` +
        `e.g. "${report.corpusMisses[0]}"; repair the kit before baselining`,
    );
  }

  const measured: SkillTotals[] = report.skills.map((skill) => ({
    skill: skill.skill,
    hot: totals(skill.hot),
    cold: totals(skill.cold),
    transitive: totals(skill.transitive),
  }));

  const corpus = totals(report.corpus);
  const maxHotBytes = Math.max(...measured.map((entry) => entry.hot.bytes));

  if (update) {
    const { baseline: recorded, unreadable } = recordedBaseline(baselinePath);
    if (unreadable !== undefined) {
      console.error(
        `[size-check] ${baselinePath} exists but is not readable as a baseline (${unreadable}); ` +
          `capturing fresh — the recorded corpus total and hot cap carry nothing forward`,
      );
    }
    const recordedCorpus = recorded?.corpus?.bytes;
    if (recordedCorpus !== undefined && corpus.bytes > recordedCorpus && !allowCorpusGrowth) {
      return refuse(
        `the corpus grew ${moved(recordedCorpus, corpus.bytes)}; re-run with --allow-corpus-growth ` +
          `to record the higher total, or shrink the corpus back to ${recordedCorpus} bytes`,
      );
    }
    const recordedCap = recorded?.hotCapBytes;
    if (hotCapArg !== null && recordedCap !== undefined && hotCapArg >= recordedCap) {
      return refuse(
        `--hot-cap ${hotCapArg} does not lower the recorded cap of ${recordedCap}; the cap ` +
          `ratchets down only, so pass a value below it or leave the flag off to carry it forward`,
      );
    }
    const hotCapBytes = hotCapArg ?? recordedCap ?? maxHotBytes;
    try {
      writeFileSync(
        baselinePath,
        JSON.stringify({ skills: measured, corpus, hotCapBytes } satisfies Baseline, null, 2) + "\n",
      );
    } catch (err) {
      return refuse(`cannot write baseline ${baselinePath}: ${err.code ?? err.message}`);
    }
    console.log(
      `[size-check] baseline written: ${measured.length} skills, corpus ${corpus.bytes} bytes, ` +
        `hot cap ${hotCapBytes} bytes -> ${baselinePath}`,
    );
    return;
  }

  const { baseline, unreadable } = recordedBaseline(baselinePath);
  if (baseline === undefined) {
    return refuse(
      unreadable === undefined
        ? `no baseline at ${baselinePath}; capture one with --update`
        : `the baseline at ${baselinePath} is not readable (${unreadable}); repair it, ` +
            `or capture a fresh one with --update, which ratchets nothing forward from an unreadable file`,
    );
  }
  if (!Array.isArray(baseline?.skills)) {
    return refuse(`${baselinePath} is not a size baseline (no skills array); re-capture with --update`);
  }

  const baseByName = new Map(baseline.skills.map((entry) => [entry.skill, entry]));
  const nowByName = new Map(measured.map((entry) => [entry.skill, entry]));
  const names = [...new Set([...baseByName.keys(), ...nowByName.keys()])].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  const drift: string[] = [];
  const baselineCorpus = baseline.corpus?.bytes;
  const corpusGrew = baselineCorpus !== undefined && corpus.bytes > baselineCorpus;
  if (baselineCorpus === undefined) {
    drift.push(`corpus: not in the baseline (${corpus.bytes} bytes)`);
  } else if (baselineCorpus !== corpus.bytes) {
    drift.push(`corpus: ${moved(baselineCorpus, corpus.bytes)}`);
  }
  const baselineCap = baseline.hotCapBytes;
  if (baselineCap === undefined) {
    drift.push(`hotCapBytes: not in the baseline (max hot ${maxHotBytes} bytes)`);
  }
  let overCap = false;
  for (const name of names) {
    const base = baseByName.get(name);
    const now = nowByName.get(name);
    if (!now) {
      drift.push(`${name}: in the baseline but not in the kit`);
      continue;
    }
    if (!base) {
      drift.push(`${name}: not in the baseline (hot ${now.hot.bytes} bytes)`);
    } else {
      for (const set of ["hot", "cold", "transitive"] as const) {
        const from = base[set]?.bytes;
        const to = now[set].bytes;
        if (from === to) continue;

        if (from === undefined) {
          drift.push(`${name}: ${set} not in the baseline (${to} bytes)`);
          continue;
        }
        drift.push(`${name}: ${set} ${moved(from, to)}`);
      }
    }
    if (baselineCap !== undefined && now.hot.bytes > baselineCap) {
      drift.push(`${name}: hot ${now.hot.bytes} bytes over the cap of ${baselineCap}`);
      overCap = true;
    }
  }

  if (drift.length > 0) {
    for (const line of drift) console.log(line);
    console.log(
      `[size-check] ${drift.length} drift line(s) against ${baselinePath} — when the change is ` +
        `intended, re-capture in the same change: node scripts/size-check.ts --update ` +
        `${corpusGrew ? "--allow-corpus-growth " : ""}` +
        `${baselineArg ? `--baseline ${baselineArg} ` : ""}${roots[0]}` +
        `${
          overCap
            ? "; a skill over the cap stays over it, because --update carries the cap forward — shrink the skill"
            : ""
        }`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `[size-check] clean: ${measured.length} skills and the corpus match ${baselinePath}, ` +
      `every skill at or under the hot cap of ${baselineCap} bytes`,
  );
}

main();

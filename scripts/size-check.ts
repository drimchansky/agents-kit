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
  readonly unresolved: readonly string[];
}

interface Baseline {
  readonly skills?: readonly BaselineEntry[];
}

interface BaselineEntry {
  readonly skill: string;
  readonly hot?: Totals;
  readonly cold?: Totals;
  readonly transitive?: Totals;
}

const totals = (set: Totals): Totals => ({ bytes: set.bytes, approxTokens: set.approxTokens });

function refuse(message: string): void {
  console.error(`[size-check] ${message}`);
  process.exitCode = 2;
}

function main(): void {
  const args = process.argv.slice(2);
  let update = false;
  let baselineArg: string | null = null;
  const roots: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--update") {
      update = true;
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
    return refuse("usage: node scripts/size-check.ts [--update] [--baseline FILE] <kit-root>");
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

  const measured: SkillTotals[] = report.skills.map((skill) => ({
    skill: skill.skill,
    hot: totals(skill.hot),
    cold: totals(skill.cold),
    transitive: totals(skill.transitive),
  }));

  if (update) {
    try {
      writeFileSync(baselinePath, JSON.stringify({ skills: measured } satisfies Baseline, null, 2) + "\n");
    } catch (err) {
      return refuse(`cannot write baseline ${baselinePath}: ${err.code ?? err.message}`);
    }
    console.log(`[size-check] baseline written: ${measured.length} skills -> ${baselinePath}`);
    return;
  }

  let baseline: Baseline | null;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  } catch (err) {
    return refuse(`no baseline at ${baselinePath} (${err.code ?? err.message}); capture one with --update`);
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
  for (const name of names) {
    const base = baseByName.get(name);
    const now = nowByName.get(name);
    if (!base) {
      drift.push(`${name}: not in the baseline (hot ${now.hot.bytes} bytes)`);
      continue;
    }
    if (!now) {
      drift.push(`${name}: in the baseline but not in the kit`);
      continue;
    }
    for (const set of ["hot", "cold", "transitive"] as const) {
      const from = base[set]?.bytes;
      const to = now[set].bytes;
      if (from === to) continue;

      if (from === undefined) {
        drift.push(`${name}: ${set} not in the baseline (${to} bytes)`);
        continue;
      }
      const delta = to - from;
      const tokens = Math.round(delta / BYTES_PER_TOKEN);
      drift.push(
        `${name}: ${set} ${from} -> ${to} bytes ` +
          `(${delta > 0 ? "+" : ""}${delta}, ~${tokens > 0 ? "+" : ""}${tokens} tokens)`,
      );
    }
  }

  if (drift.length > 0) {
    for (const line of drift) console.log(line);
    console.log(
      `[size-check] ${drift.length} drift line(s) against ${baselinePath} — when the change is ` +
        `intended, re-capture in the same change: node scripts/size-check.ts --update ` +
        `${baselineArg ? `--baseline ${baselineArg} ` : ""}${roots[0]}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`[size-check] clean: ${measured.length} skills match ${baselinePath}`);
}

main();

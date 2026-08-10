#!/usr/bin/env node
// Compares the kit's measured context loads against a committed baseline, so growth in what a skill
// loads is a conscious, reviewed choice rather than silent drift. The measurement itself is
// scripts/size-report.mjs, run as a child process; this script only compares and records.
// Zero dependencies; Node >= 18.
// Run: node scripts/size-check.mjs [--update] [--baseline FILE] <kit-root>
//
// Modes. Without --update, each skill's direct and transitive byte totals are compared against the
// baseline (default: <kit-root>/tests/size-baseline.json): any difference — a grown or shrunk total, a
// skill missing from the baseline, a baseline entry no longer in the kit — prints one line to stdout
// and the run exits 1 with a re-capture hint. --update rewrites the baseline from the current
// measurement instead. Shrinkage fails the check on purpose: the baseline stays current only if every
// change that moves a total re-captures it in the same change, which is what keeps the diff — and the
// growth it would reveal — reviewable.
//
// The baseline holds totals only ({skill, direct/transitive {bytes, approxTokens}}, sorted as the
// report emits them): per-file lists would churn on every edit without making the ratchet stricter.
//
// Exit status: 0 = clean (or baseline written), 1 = drift, 2 = the check could not run — no kit root,
// no baseline to check against, an unreadable measurement, or a measurement whose `unresolved` list is
// non-empty (a partly measured kit would anchor a baseline below the truth).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BYTES_PER_TOKEN = 4;

// Everything printed here is far below the pipe buffer, so `process.exitCode` plus a natural return
// (never process.exit) is enough to keep the output intact.
function refuse(message) {
  console.error(`[size-check] ${message}`);
  process.exitCode = 2;
}

function main() {
  const args = process.argv.slice(2);
  let update = false;
  let baselineArg = null;
  const roots = [];
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
    return refuse("usage: node scripts/size-check.mjs [--update] [--baseline FILE] <kit-root>");
  }
  const root = resolve(roots[0]);
  const baselinePath = baselineArg ? resolve(baselineArg) : join(root, "tests", "size-baseline.json");

  const reportScript = fileURLToPath(new URL("./size-report.mjs", import.meta.url));
  let report;
  try {
    report = JSON.parse(
      execFileSync(process.execPath, [reportScript, root], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
  } catch (err) {
    return refuse(`size-report.mjs produced no readable report: ${err.message}`);
  }
  if (report.root == null || report.skills.length === 0) {
    return refuse(`not a measurable kit root: ${root}`);
  }
  // An unresolved citation means bytes the load path would reach were never measured; both checking
  // and re-capturing over that hole would let real weight hide behind a broken link.
  if (report.unresolved.length > 0) {
    return refuse(
      `the measurement is incomplete — ${report.unresolved.length} unresolved citation(s), ` +
        `e.g. "${report.unresolved[0]}"; repair the kit before baselining`,
    );
  }

  const measured = report.skills.map((s) => ({
    skill: s.skill,
    direct: { bytes: s.direct.bytes, approxTokens: s.direct.approxTokens },
    transitive: { bytes: s.transitive.bytes, approxTokens: s.transitive.approxTokens },
  }));

  if (update) {
    try {
      writeFileSync(baselinePath, JSON.stringify({ skills: measured }, null, 2) + "\n");
    } catch (err) {
      return refuse(`cannot write baseline ${baselinePath}: ${err.code ?? err.message}`);
    }
    console.log(`[size-check] baseline written: ${measured.length} skills -> ${baselinePath}`);
    return;
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  } catch (err) {
    return refuse(`no baseline at ${baselinePath} (${err.code ?? err.message}); capture one with --update`);
  }
  if (!Array.isArray(baseline?.skills)) {
    return refuse(`${baselinePath} is not a size baseline (no skills array); re-capture with --update`);
  }

  const baseByName = new Map(baseline.skills.map((s) => [s.skill, s]));
  const nowByName = new Map(measured.map((s) => [s.skill, s]));
  const names = [...new Set([...baseByName.keys(), ...nowByName.keys()])].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  const drift = [];
  for (const name of names) {
    const base = baseByName.get(name);
    const now = nowByName.get(name);
    if (!base) {
      drift.push(`${name}: not in the baseline (direct ${now.direct.bytes} bytes)`);
      continue;
    }
    if (!now) {
      drift.push(`${name}: in the baseline but not in the kit`);
      continue;
    }
    for (const set of ["direct", "transitive"]) {
      const from = base[set]?.bytes;
      const to = now[set].bytes;
      if (from === to) continue;
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
        `intended, re-capture in the same change: node scripts/size-check.mjs --update ` +
        `${baselineArg ? `--baseline ${baselineArg} ` : ""}${roots[0]}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`[size-check] clean: ${measured.length} skills match ${baselinePath}`);
}

main();

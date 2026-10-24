#!/usr/bin/env node
/**
 * Section 13 (EX-02 / EX-03): Collects machine-readable `proof-results.json` and human-readable
 * `proof-report.md` from `.packed/manifest.json` and `.packed/last-run.json`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(ROOT, ".packed", "manifest.json");
const lastRunPath = join(ROOT, ".packed", "last-run.json");

const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : undefined;

const lastRun = existsSync(lastRunPath)
  ? JSON.parse(readFileSync(lastRunPath, "utf8"))
  : { projects: {} };

const results = Object.values(lastRun.projects);
const p0Results = results.filter((r) => r.priority === "P0");
const allP0Passed =
  p0Results.length > 0 &&
  p0Results.every((r) => r.checkStatus === "passed" && r.testStatus === "passed");

const report = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  nodeVersion: process.versions.node,
  frameworkVersion: manifest?.packages?.agboss?.version ?? "0.1.0",
  cliVersion: manifest?.packages?.agbossCli?.version ?? "0.1.0",
  sourceCommit: manifest?.sourceCommit ?? "unknown",
  packageHashes: {
    agboss: manifest?.packages?.agboss?.integrity,
    agbossCli: manifest?.packages?.agbossCli?.integrity,
  },
  results,
  allP0Passed,
};

writeFileSync(join(ROOT, "proof-results.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

const mdLines = [
  "# AGBoss Examples — Executable Architecture & Reliability Proof Report",
  "",
  `- **Generated at:** \`${report.generatedAt}\``,
  `- **Node.js:** \`${report.nodeVersion}\``,
  `- **AGBoss version:** \`${report.frameworkVersion}\``,
  `- **AGBoss CLI version:** \`${report.cliVersion}\``,
  `- **Source commit:** \`${report.sourceCommit}\``,
  `- **agboss integrity:** \`${report.packageHashes.agboss ?? "n/a"}\``,
  `- **agboss-cli integrity:** \`${report.packageHashes.agbossCli ?? "n/a"}\``,
  `- **P0 Release Gate:** **${report.allP0Passed ? "PASSED" : "FAILED"}**`,
  "",
  "## Project Matrix",
  "",
  "| Project | Priority | Mode | `npm run check` | `npm test` | Duration (ms) | Primary Proof |",
  "| :--- | :---: | :--- | :---: | :---: | ---: | :--- |",
  ...results.map(
    (r) =>
      `| \`${r.project}\` | **${r.priority}** | \`${r.mode}\` | ${String(r.checkStatus).toUpperCase()} | ${String(r.testStatus).toUpperCase()} | ${String(r.durationMs)} | ${r.primaryProof} |`,
  ),
  "",
];

writeFileSync(join(ROOT, "proof-report.md"), mdLines.join("\n"), "utf8");
console.log("[collect-results] Wrote proof-results.json and proof-report.md");

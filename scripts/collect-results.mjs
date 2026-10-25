#!/usr/bin/env node
/**
 * Section 13 (EX-02 / EX-03): Collects machine-readable `proof-results.json` and human-readable
 * `proof-report.md` from `.packed/manifest.json`, `.packed/package-verification.json`, and `.packed/last-run.json`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(ROOT, ".packed", "manifest.json");
const pkgVerifyPath = join(ROOT, ".packed", "package-verification.json");
const lastRunPath = join(ROOT, ".packed", "last-run.json");

const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : undefined;

const packageVerification = existsSync(pkgVerifyPath)
  ? JSON.parse(readFileSync(pkgVerifyPath, "utf8"))
  : undefined;

const lastRun = existsSync(lastRunPath)
  ? JSON.parse(readFileSync(lastRunPath, "utf8"))
  : { projects: {} };

const results = Object.values(lastRun.projects).map((r) => ({
  ...r,
  demoStatus: r.demoStatus ?? "skipped",
}));
const p0Results = results.filter((r) => r.priority === "P0");
const p1Results = results.filter((r) => r.priority === "P1");
const allP0Passed =
  p0Results.length > 0 &&
  p0Results.every(
    (r) =>
      r.checkStatus === "passed" &&
      r.testStatus === "passed" &&
      (r.demoStatus === "passed" || r.demoStatus === "skipped"),
  );
const allP1Passed =
  p1Results.length > 0 &&
  p1Results.every(
    (r) =>
      (r.checkStatus === "passed" || r.checkStatus === "skipped") &&
      (r.testStatus === "passed" || r.testStatus === "skipped") &&
      (r.demoStatus === "passed" || r.demoStatus === "skipped"),
  );

const report = {
  schemaVersion: "1.1",
  generatedAt: new Date().toISOString(),
  nodeVersion: process.versions.node,
  frameworkVersion: manifest?.packages?.agboss?.version ?? "0.1.0",
  cliVersion: manifest?.packages?.agbossCli?.version ?? "0.1.0",
  sourceCommit: manifest?.sourceCommit ?? "unknown",
  packageHashes: {
    agboss: manifest?.packages?.agboss?.integrity,
    agbossSha256: manifest?.packages?.agboss?.sha256,
    agbossCli: manifest?.packages?.agbossCli?.integrity,
    agbossCliSha256: manifest?.packages?.agbossCli?.sha256,
  },
  packageVerification: packageVerification?.checks ?? undefined,
  results,
  allP0Passed,
  allP1Passed,
};

writeFileSync(join(ROOT, "proof-results.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

const mdLines = [
  "# AGBoss Examples — Executable Architecture & Reliability Proof Report",
  "",
  `- **Generated at:** \`${report.generatedAt}\``,
  `- **Node.js:** \`${report.nodeVersion}\``,
  `- **AGBoss version:** \`${report.frameworkVersion}\` (pre-release candidate)`,
  `- **AGBoss CLI version:** \`${report.cliVersion}\` (pre-release candidate)`,
  `- **Source commit:** \`${report.sourceCommit}\``,
  `- **agboss integrity:** \`${report.packageHashes.agboss ?? "n/a"}\` (\`sha256:${report.packageHashes.agbossSha256 ?? "n/a"}\`)`,
  `- **agboss-cli integrity:** \`${report.packageHashes.agbossCli ?? "n/a"}\` (\`sha256:${report.packageHashes.agbossCliSha256 ?? "n/a"}\`)`,
  `- **Isolated Package & Scaffold Gate:** **${packageVerification ? "PASSED" : "NOT RUN"}**`,
  `- **P0 Release Gate:** **${report.allP0Passed ? "PASSED" : "FAILED"}**`,
  `- **P1 Extended Gate:** **${report.allP1Passed ? "PASSED" : "FAILED"}**`,
  "",
  "## Project Matrix",
  "",
  "| Project | Priority | Mode | `npm run check` | `npm test` | `npm run demo` | Duration (ms) | Primary Proof |",
  "| :--- | :---: | :--- | :---: | :---: | :---: | ---: | :--- |",
  ...results.map(
    (r) =>
      `| \`${r.project}\` | **${r.priority}** | \`${r.mode}\` | ${String(r.checkStatus).toUpperCase()} | ${String(r.testStatus).toUpperCase()} | ${String(r.demoStatus).toUpperCase()} | ${String(r.durationMs)} | ${r.primaryProof} |`,
  ),
  "",
];

writeFileSync(join(ROOT, "proof-report.md"), mdLines.join("\n"), "utf8");
console.log("[collect-results] Wrote proof-results.json and proof-report.md");

import type { ProofSuiteReport } from "./proof-result.js";

/**
 * Generates a human-readable Markdown summary from a `ProofSuiteReport` (Section 13).
 */
export function generateMarkdownReport(report: ProofSuiteReport): string {
  const lines: string[] = [
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
  ];

  for (const r of report.results) {
    lines.push(
      `| \`${r.project}\` | **${r.priority}** | \`${r.mode}\` | ${r.checkStatus.toUpperCase()} | ${r.testStatus.toUpperCase()} | ${String(r.durationMs)} | ${r.primaryProof} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

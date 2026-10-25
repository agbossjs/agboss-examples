#!/usr/bin/env node
/**
 * Section 13 & Round 2 P0-1: Strict, fail-closed release proof collector.
 *
 * Collects machine-readable `proof-results.json` and human-readable `proof-report.md` from
 * `.packed/manifest.json`, `.packed/package-verification.json`, and `.packed/last-run.json`.
 *
 * Invariants:
 *   - Explicit statuses: PASSED, FAILED, SKIPPED, NOT_RUN, BLOCKED.
 *   - P0 Gate is PASSED only if every P0 project exists on disk and has PASSED for check, test, AND demo.
 *   - P1 Gate is PASSED only if every P1 project exists on disk and has PASSED for check, test, AND demo.
 *     If P1 checks were not run, P1 Gate is NOT_RUN (never PASSED).
 *   - Package Verification Gate is PASSED only if `.packed/package-verification.json` matches `.packed/manifest.json`
 *     provenance (sourceCommit + tarball hashes) and every required verification check passed.
 *   - Provenance Gate is PASSED only if `.packed/last-run.json` matches `.packed/manifest.json`
 *     (sourceCommit + tarball hashes) and the current `agboss-examples` commit.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PROJECTS } from "./run-all.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const VALID_STATUSES = new Set(["PASSED", "FAILED", "SKIPPED", "NOT_RUN", "BLOCKED"]);

export function normalizeStatus(raw) {
  if (typeof raw !== "string") return "NOT_RUN";
  const upper = raw.trim().toUpperCase();
  if (VALID_STATUSES.has(upper)) return upper;
  return "NOT_RUN";
}

export function validatePackageVerification(pkgVerify, manifest) {
  if (!manifest || typeof manifest !== "object") {
    return {
      status: "BLOCKED",
      valid: false,
      reasons: ["Missing .packed/manifest.json"],
    };
  }
  if (!pkgVerify || typeof pkgVerify !== "object") {
    return {
      status: "NOT_RUN",
      valid: false,
      reasons: ["Missing .packed/package-verification.json"],
    };
  }

  const reasons = [];

  // Provenance check against manifest.json
  if (
    !manifest.sourceCommit ||
    pkgVerify.sourceCommit !== manifest.sourceCommit
  ) {
    reasons.push(
      `package-verification sourceCommit (${pkgVerify.sourceCommit ?? "none"}) does not match manifest (${manifest.sourceCommit ?? "none"})`,
    );
  }

  const manifestAgboss = manifest.packages?.agboss;
  const manifestCli = manifest.packages?.agbossCli;
  const verifyAgboss = pkgVerify.packages?.agboss;
  const verifyCli = pkgVerify.packages?.agbossCli;

  if (!manifestAgboss?.integrity || verifyAgboss?.integrity !== manifestAgboss.integrity) {
    reasons.push("agboss tarball integrity mismatch in package-verification.json");
  }
  if (!manifestCli?.integrity || verifyCli?.integrity !== manifestCli.integrity) {
    reasons.push("agboss-cli tarball integrity mismatch in package-verification.json");
  }
  if (manifestAgboss?.sha256 && verifyAgboss?.sha256 !== manifestAgboss.sha256) {
    reasons.push("agboss tarball sha256 mismatch in package-verification.json");
  }
  if (manifestCli?.sha256 && verifyCli?.sha256 !== manifestCli.sha256) {
    reasons.push("agboss-cli tarball sha256 mismatch in package-verification.json");
  }

  // Required verification check fields
  const checks = pkgVerify.checks;
  if (!checks || typeof checks !== "object") {
    reasons.push("Missing checks object in package-verification.json");
  } else {
    const requiredPassedFields = [
      "tarballInventories",
      "isolatedConsumerInstall",
      "cliBinDelegation",
      "cleanScaffoldCreate",
      "scaffoldCheck",
      "scaffoldTypecheck",
      "scaffoldUnitTests",
      "scaffoldDescribe",
    ];
    for (const field of requiredPassedFields) {
      if (String(checks[field]).toLowerCase() !== "passed") {
        reasons.push(`Check '${field}' is '${checks[field] ?? "missing"}' (expected 'passed')`);
      }
    }
    if (!Number.isInteger(checks.syncedAiSkillsCount) || checks.syncedAiSkillsCount < 13) {
      reasons.push(
        `Check 'syncedAiSkillsCount' is '${checks.syncedAiSkillsCount ?? "missing"}' (expected >= 13)`,
      );
    }
    if (
      !Array.isArray(checks.subpathExportsVerified) ||
      checks.subpathExportsVerified.length < 11
    ) {
      reasons.push("Check 'subpathExportsVerified' did not verify all 11 required subpath exports");
    }
  }

  if (reasons.length > 0) {
    return {
      status: "FAILED",
      valid: false,
      reasons,
    };
  }

  return {
    status: "PASSED",
    valid: true,
    reasons: [],
  };
}

export function validateRunProvenance({ lastRun, manifest, currentExamplesCommit }) {
  const reasons = [];
  if (!manifest || typeof manifest !== "object") {
    reasons.push("Missing .packed/manifest.json");
    return { status: "BLOCKED", valid: false, reasons };
  }
  if (!lastRun || typeof lastRun !== "object" || !lastRun.projects) {
    reasons.push("Missing .packed/last-run.json");
    return { status: "NOT_RUN", valid: false, reasons };
  }

  if (
    !manifest.sourceCommit ||
    manifest.sourceCommit === "unknown" ||
    lastRun.frameworkSourceCommit !== manifest.sourceCommit
  ) {
    reasons.push(
      `last-run frameworkSourceCommit (${lastRun.frameworkSourceCommit ?? "none"}) does not match manifest (${manifest.sourceCommit ?? "none"})`,
    );
  }

  if (
    currentExamplesCommit &&
    currentExamplesCommit !== "unknown" &&
    lastRun.examplesSourceCommit !== currentExamplesCommit
  ) {
    reasons.push(
      `last-run examplesSourceCommit (${lastRun.examplesSourceCommit ?? "none"}) does not match current HEAD (${currentExamplesCommit})`,
    );
  }

  const manifestAgboss = manifest.packages?.agboss;
  const manifestCli = manifest.packages?.agbossCli;
  const runHashes = lastRun.packageHashes ?? {};

  if (!manifestAgboss?.integrity || runHashes.agboss !== manifestAgboss.integrity) {
    reasons.push("last-run agboss tarball integrity does not match manifest.json");
  }
  if (!manifestCli?.integrity || runHashes.agbossCli !== manifestCli.integrity) {
    reasons.push("last-run agboss-cli tarball integrity does not match manifest.json");
  }
  if (manifestAgboss?.sha256 && runHashes.agbossSha256 !== manifestAgboss.sha256) {
    reasons.push("last-run agboss tarball sha256 does not match manifest.json");
  }
  if (manifestCli?.sha256 && runHashes.agbossCliSha256 !== manifestCli.sha256) {
    reasons.push("last-run agboss-cli tarball sha256 does not match manifest.json");
  }

  if (reasons.length > 0) {
    return { status: "FAILED", valid: false, reasons };
  }
  return { status: "PASSED", valid: true, reasons: [] };
}

export function evaluateProofReport({
  lastRun,
  manifest,
  pkgVerify,
  currentExamplesCommit,
  projectsCatalog = PROJECTS,
  projectExistsFn = () => true,
  requireP1 = false,
}) {
  const pkgValidation = validatePackageVerification(pkgVerify, manifest);
  const provenanceValidation = validateRunProvenance({
    lastRun,
    manifest,
    currentExamplesCommit,
  });

  const results = [];
  const gateReasons = [...pkgValidation.reasons, ...provenanceValidation.reasons];

  for (const meta of projectsCatalog) {
    const existsOnDisk = Boolean(projectExistsFn(meta.name));
    const rawEntry = lastRun?.projects?.[meta.name];

    if (!existsOnDisk) {
      gateReasons.push(`Required project '${meta.name}' is missing on disk`);
      results.push({
        project: meta.name,
        priority: meta.priority,
        primaryProof: meta.primaryProof,
        mode: meta.mode,
        checkStatus: "FAILED",
        checkExitCode: 1,
        testStatus: "FAILED",
        testExitCode: 1,
        demoStatus: "FAILED",
        demoExitCode: 1,
        projectGate: "FAILED",
        durationMs: 0,
        error: "Missing project directory or package.json on disk",
      });
      continue;
    }

    if (!rawEntry) {
      const missingStatus = meta.priority === "P0" ? "FAILED" : "NOT_RUN";
      if (meta.priority === "P0" || requireP1) {
        gateReasons.push(`Project '${meta.name}' (${meta.priority}) is missing from last-run.json`);
      }
      results.push({
        project: meta.name,
        priority: meta.priority,
        primaryProof: meta.primaryProof,
        mode: meta.mode,
        checkStatus: missingStatus,
        checkExitCode: null,
        testStatus: missingStatus,
        testExitCode: null,
        demoStatus: missingStatus,
        demoExitCode: null,
        projectGate: missingStatus,
        durationMs: 0,
        error: "Project missing from last-run.json",
      });
      continue;
    }

    const checkStatus = normalizeStatus(rawEntry.checkStatus);
    const testStatus = normalizeStatus(rawEntry.testStatus);
    const demoStatus = normalizeStatus(rawEntry.demoStatus);
    const statuses = [checkStatus, testStatus, demoStatus];

    let projectGate = "FAILED";
    if (!provenanceValidation.valid) {
      projectGate = "FAILED";
    } else if (
      checkStatus === "PASSED" &&
      testStatus === "PASSED" &&
      demoStatus === "PASSED"
    ) {
      projectGate = "PASSED";
    } else if (
      meta.priority === "P1" &&
      statuses.every((s) => s === "NOT_RUN" || s === "SKIPPED")
    ) {
      projectGate = "NOT_RUN";
      if (requireP1) {
        gateReasons.push(`P1 project '${meta.name}' was not executed (--require-p1 active)`);
      }
    } else {
      projectGate = "FAILED";
      gateReasons.push(
        `Project '${meta.name}' (${meta.priority}) failed gate: check=${checkStatus}, test=${testStatus}, demo=${demoStatus}`,
      );
    }

    results.push({
      project: meta.name,
      priority: meta.priority,
      primaryProof: meta.primaryProof,
      mode: meta.mode,
      checkStatus,
      checkExitCode: rawEntry.checkExitCode ?? null,
      checkExecutedAt: rawEntry.checkExecutedAt ?? null,
      testStatus,
      testExitCode: rawEntry.testExitCode ?? null,
      testExecutedAt: rawEntry.testExecutedAt ?? null,
      demoStatus,
      demoExitCode: rawEntry.demoExitCode ?? null,
      demoExecutedAt: rawEntry.demoExecutedAt ?? null,
      projectGate,
      durationMs: rawEntry.durationMs ?? 0,
      error: rawEntry.error ?? null,
    });
  }

  const p0Projects = results.filter((r) => r.priority === "P0");
  const p1Projects = results.filter((r) => r.priority === "P1");

  let p0Gate = "FAILED";
  if (
    provenanceValidation.valid &&
    p0Projects.length > 0 &&
    p0Projects.every((r) => r.projectGate === "PASSED")
  ) {
    p0Gate = "PASSED";
  }

  let p1Gate = "FAILED";
  if (!provenanceValidation.valid) {
    p1Gate = "FAILED";
  } else if (p1Projects.length > 0 && p1Projects.every((r) => r.projectGate === "PASSED")) {
    p1Gate = "PASSED";
  } else if (p1Projects.some((r) => r.projectGate === "FAILED")) {
    p1Gate = "FAILED";
  } else if (p1Projects.length > 0 && p1Projects.every((r) => r.projectGate === "NOT_RUN")) {
    p1Gate = requireP1 ? "FAILED" : "NOT_RUN";
  } else {
    // Partial P1 execution (e.g. one P1 project PASSED and one P1 project NOT_RUN)
    p1Gate = "FAILED";
    gateReasons.push("Partial P1 execution: some P1 projects ran while others were NOT_RUN");
  }

  const packageGate = pkgValidation.status;
  const provenanceGate = provenanceValidation.status;

  const overallGate =
    provenanceGate === "PASSED" &&
    packageGate === "PASSED" &&
    p0Gate === "PASSED" &&
    (requireP1 ? p1Gate === "PASSED" : p1Gate === "PASSED" || p1Gate === "NOT_RUN")
      ? "PASSED"
      : "FAILED";

  return {
    schemaVersion: "2.0",
    generatedAt: new Date().toISOString(),
    nodeVersion: process.versions.node,
    runId: lastRun?.runId ?? null,
    frameworkVersion: manifest?.packages?.agboss?.version ?? "0.1.0",
    cliVersion: manifest?.packages?.agbossCli?.version ?? "0.1.0",
    sourceCommit: manifest?.sourceCommit ?? "unknown",
    examplesSourceCommit:
      currentExamplesCommit ?? manifest?.examplesSourceCommit ?? lastRun?.examplesSourceCommit ?? "unknown",
    packageHashes: {
      agboss: manifest?.packages?.agboss?.integrity ?? null,
      agbossSha256: manifest?.packages?.agboss?.sha256 ?? null,
      agbossCli: manifest?.packages?.agbossCli?.integrity ?? null,
      agbossCliSha256: manifest?.packages?.agbossCli?.sha256 ?? null,
    },
    gates: {
      provenanceGate,
      packageGate,
      p0Gate,
      p1Gate,
      overallGate,
    },
    gateReasons,
    packageVerification: pkgVerify?.checks ?? null,
    results,
    allP0Passed: p0Gate === "PASSED",
    allP1Passed: p1Gate === "PASSED",
  };
}

export function renderProofMarkdown(report) {
  const mdLines = [
    "# AGBoss Examples — Executable Architecture & Reliability Proof Report",
    "",
    `- **Generated at:** \`${report.generatedAt}\``,
    `- **Run ID:** \`${report.runId ?? "n/a"}\``,
    `- **Node.js:** \`${report.nodeVersion}\``,
    `- **AGBoss version:** \`${report.frameworkVersion}\` (pre-release candidate)`,
    `- **AGBoss CLI version:** \`${report.cliVersion}\` (pre-release candidate)`,
    `- **Framework source commit (\`agbossjs/agboss\`):** \`${report.sourceCommit}\``,
    `- **Examples source commit (\`agbossjs/agboss-examples\`):** \`${report.examplesSourceCommit}\``,
    `- **agboss integrity:** \`${report.packageHashes.agboss ?? "n/a"}\` (\`sha256:${report.packageHashes.agbossSha256 ?? "n/a"}\`)`,
    `- **agboss-cli integrity:** \`${report.packageHashes.agbossCli ?? "n/a"}\` (\`sha256:${report.packageHashes.agbossCliSha256 ?? "n/a"}\`)`,
    `- **Provenance Gate:** **${report.gates.provenanceGate}**`,
    `- **Isolated Package & Scaffold Gate:** **${report.gates.packageGate}**`,
    `- **P0 Release Gate:** **${report.gates.p0Gate}**`,
    `- **P1 Extended Gate:** **${report.gates.p1Gate}**`,
    `- **Overall Release Readiness Gate:** **${report.gates.overallGate}**`,
    "",
  ];

  if (report.gateReasons.length > 0) {
    mdLines.push("## Gate Diagnostics", "");
    for (const reason of report.gateReasons) {
      mdLines.push(`- ${reason}`);
    }
    mdLines.push("");
  }

  mdLines.push(
    "## Project Matrix",
    "",
    "| Project | Priority | Mode | `npm run check` | `npm test` | `npm run demo` | Project Gate | Duration (ms) | Primary Proof |",
    "| :--- | :---: | :--- | :---: | :---: | :---: | :---: | ---: | :--- |",
    ...report.results.map(
      (r) =>
        `| \`${r.project}\` | **${r.priority}** | \`${r.mode}\` | ${r.checkStatus} | ${r.testStatus} | ${r.demoStatus} | **${r.projectGate}** | ${String(r.durationMs)} | ${r.primaryProof} |`,
    ),
    "",
  );

  return mdLines.join("\n");
}

function runMain() {
  const args = process.argv.slice(2);
  const requireP1 = args.includes("--require-p1");

  const manifestPath = join(ROOT, ".packed", "manifest.json");
  const pkgVerifyPath = join(ROOT, ".packed", "package-verification.json");
  const lastRunPath = join(ROOT, ".packed", "last-run.json");

  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : undefined;
  const pkgVerify = existsSync(pkgVerifyPath)
    ? JSON.parse(readFileSync(pkgVerifyPath, "utf8"))
    : undefined;
  const lastRun = existsSync(lastRunPath)
    ? JSON.parse(readFileSync(lastRunPath, "utf8"))
    : undefined;

  let currentExamplesCommit = "unknown";
  try {
    currentExamplesCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    currentExamplesCommit = "unknown";
  }

  const report = evaluateProofReport({
    lastRun,
    manifest,
    pkgVerify,
    currentExamplesCommit,
    projectsCatalog: PROJECTS,
    projectExistsFn: (projectName) => existsSync(join(ROOT, projectName, "package.json")),
    requireP1,
  });

  writeFileSync(join(ROOT, "proof-results.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  writeFileSync(join(ROOT, "proof-report.md"), renderProofMarkdown(report), "utf8");
  console.log(
    `[collect-results] Wrote proof-results.json and proof-report.md (Overall Gate: ${report.gates.overallGate}, P0: ${report.gates.p0Gate}, P1: ${report.gates.p1Gate}, Package: ${report.gates.packageGate})`,
  );

  if (report.gates.overallGate !== "PASSED") {
    console.error("[collect-results] Release proof gate FAILED:", report.gateReasons);
    process.exit(1);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  runMain();
}

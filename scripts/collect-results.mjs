#!/usr/bin/env node
/**
 * Section 13, Round 2 P0-1 & Final Audit P0-3: Strict, fail-closed release proof collector
 * with separated provenance modes (`--provenance rc` vs `--provenance published`).
 *
 * Mode 1 — Release-Candidate Evidence (`--provenance rc`, default):
 *   Reads `.packed/manifest.json`, `.packed/package-verification.json`, `.packed/last-run.json`.
 *   Writes `proof-results.json` and `proof-report.md`.
 *
 * Mode 2 — Published-Package Evidence (`--provenance published`):
 *   Reads `.packed/published-manifest.json`, `.packed/published-verification.json`,
 *   `.packed/last-run-published.json`.
 *   Writes `published-proof-results.json` and `published-proof-report.md`.
 *   Rejects any RC artifacts, local tarball installations, or mixed tarball/registry states.
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

  if (!manifest.sourceCommit || pkgVerify.sourceCommit !== manifest.sourceCommit) {
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

  if (lastRun.provenanceType && lastRun.provenanceType !== "RELEASE_CANDIDATE") {
    reasons.push(
      `last-run provenanceType '${lastRun.provenanceType}' is not RELEASE_CANDIDATE`,
    );
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

export function validatePublishedManifest(
  publishedManifest,
  currentExamplesCommit,
  projectsCatalog = PROJECTS,
) {
  if (!publishedManifest || typeof publishedManifest !== "object") {
    return {
      status: "BLOCKED",
      valid: false,
      reasons: ["Missing .packed/published-manifest.json"],
    };
  }

  const reasons = [];
  if (
    publishedManifest.provenanceType !== "PUBLIC_NPM_REGISTRY" ||
    publishedManifest.source !== "PUBLIC_NPM_REGISTRY"
  ) {
    reasons.push(
      `published-manifest provenanceType/source ('${publishedManifest.provenanceType ?? "none"}' / '${publishedManifest.source ?? "none"}') is not PUBLIC_NPM_REGISTRY`,
    );
  }

  if (
    currentExamplesCommit &&
    currentExamplesCommit !== "unknown" &&
    publishedManifest.examplesSourceCommit !== currentExamplesCommit
  ) {
    reasons.push(
      `published-manifest examplesSourceCommit (${publishedManifest.examplesSourceCommit ?? "none"}) does not match current HEAD (${currentExamplesCommit})`,
    );
  }

  const agbossPkg = publishedManifest.packages?.agboss;
  const cliPkg = publishedManifest.packages?.agbossCli;
  if (!agbossPkg?.version || !agbossPkg?.integrity) {
    reasons.push("published-manifest is missing agboss version or dist.integrity");
  }
  if (!cliPkg?.version || !cliPkg?.integrity) {
    reasons.push("published-manifest is missing agboss-cli version or dist.integrity");
  }
  if (
    !agbossPkg?.tarball ||
    !String(agbossPkg.tarball).startsWith("https://") ||
    String(agbossPkg.tarball).startsWith("file:")
  ) {
    reasons.push(
      `published-manifest agboss tarball URL is not a remote https registry URL: '${agbossPkg?.tarball ?? "none"}'`,
    );
  }
  if (
    !cliPkg?.tarball ||
    !String(cliPkg.tarball).startsWith("https://") ||
    String(cliPkg.tarball).startsWith("file:")
  ) {
    reasons.push(
      `published-manifest agboss-cli tarball URL is not a remote https registry URL: '${cliPkg?.tarball ?? "none"}'`,
    );
  }

  const projectRecords = publishedManifest.projects ?? {};
  for (const meta of projectsCatalog) {
    const rec = projectRecords[meta.name];
    if (!rec) {
      reasons.push(`Project '${meta.name}' is missing from published-manifest.json`);
      continue;
    }
    if (rec.isRegistryInstall !== true || rec.hasLocalLinks === true) {
      reasons.push(
        `Project '${meta.name}' has non-registry or mixed tarball/symlink installation in published-manifest.json`,
      );
    }
    if (agbossPkg?.version && rec.agbossVersion !== agbossPkg.version) {
      reasons.push(
        `Project '${meta.name}' installed agboss@${rec.agbossVersion ?? "none"} (expected ${agbossPkg.version})`,
      );
    }
    if (cliPkg?.version && rec.agbossCliVersion !== cliPkg.version) {
      reasons.push(
        `Project '${meta.name}' installed agboss-cli@${rec.agbossCliVersion ?? "none"} (expected ${cliPkg.version})`,
      );
    }
    if (agbossPkg?.integrity && rec.agbossIntegrity !== agbossPkg.integrity) {
      reasons.push(
        `Project '${meta.name}' agboss integrity '${rec.agbossIntegrity ?? "none"}' does not match registry '${agbossPkg.integrity}'`,
      );
    }
    if (cliPkg?.integrity && rec.agbossCliIntegrity !== cliPkg.integrity) {
      reasons.push(
        `Project '${meta.name}' agboss-cli integrity '${rec.agbossCliIntegrity ?? "none"}' does not match registry '${cliPkg.integrity}'`,
      );
    }
    const agbossResolved = String(rec.agbossResolved ?? "");
    const cliResolved = String(rec.agbossCliResolved ?? "");
    if (
      !agbossResolved.startsWith("https://") ||
      agbossResolved.startsWith("file:") ||
      !cliResolved.startsWith("https://") ||
      cliResolved.startsWith("file:")
    ) {
      reasons.push(
        `Project '${meta.name}' resolved URLs are not remote https registry URLs (${agbossResolved}, ${cliResolved})`,
      );
    }
  }

  if (reasons.length > 0) {
    return { status: "FAILED", valid: false, reasons };
  }
  return { status: "PASSED", valid: true, reasons: [] };
}

export function validatePublishedVerification(pubVerify, publishedManifest) {
  if (!publishedManifest || typeof publishedManifest !== "object") {
    return {
      status: "BLOCKED",
      valid: false,
      reasons: ["Missing .packed/published-manifest.json"],
    };
  }
  if (!pubVerify || typeof pubVerify !== "object") {
    return {
      status: "NOT_RUN",
      valid: false,
      reasons: ["Missing .packed/published-verification.json"],
    };
  }

  const reasons = [];
  if (
    pubVerify.source !== "PUBLIC_NPM_REGISTRY" ||
    pubVerify.verificationMode !== "live-registry" ||
    pubVerify.registryVerified !== true
  ) {
    reasons.push(
      `published-verification.json was not executed in --live-registry mode against PUBLIC_NPM_REGISTRY (source=${pubVerify.source ?? "none"}, mode=${pubVerify.verificationMode ?? "none"})`,
    );
  }

  if (pubVerify.status !== "PASSED") {
    reasons.push(
      `published-verification.json status is '${pubVerify.status ?? "none"}' (expected 'PASSED')`,
    );
  }

  const expectedVersion = publishedManifest.packages?.agboss?.version;
  if (expectedVersion && pubVerify.requestedVersion !== expectedVersion) {
    reasons.push(
      `published-verification requestedVersion '${pubVerify.requestedVersion ?? "none"}' does not match published-manifest version '${expectedVersion}'`,
    );
  }

  const verifyRegAgboss = pubVerify.npmRegistryMetadata?.agboss;
  const verifyRegCli = pubVerify.npmRegistryMetadata?.agbossCli;
  const manifestAgboss = publishedManifest.packages?.agboss;
  const manifestCli = publishedManifest.packages?.agbossCli;

  if (!verifyRegAgboss?.integrity || verifyRegAgboss.integrity !== manifestAgboss?.integrity) {
    reasons.push(
      "published-verification npmRegistryMetadata.agboss.integrity does not match published-manifest",
    );
  }
  if (!verifyRegCli?.integrity || verifyRegCli.integrity !== manifestCli?.integrity) {
    reasons.push(
      "published-verification npmRegistryMetadata.agbossCli.integrity does not match published-manifest",
    );
  }

  const checks = pubVerify.checks;
  if (!checks || typeof checks !== "object") {
    reasons.push("Missing checks object in published-verification.json");
  } else {
    const requiredPassedFields = [
      "registryMetadata",
      "isolatedConsumerInstall",
      "cliBinVersion",
      "cliBinHelp",
      "cliExplicitBinHelp",
      "cleanScaffoldCreate",
      "scaffoldCheck",
      "scaffoldTypecheck",
      "scaffoldUnitTests",
      "scaffoldDescribe",
    ];
    for (const field of requiredPassedFields) {
      if (String(checks[field]).toLowerCase() !== "passed") {
        reasons.push(
          `Published verification check '${field}' is '${checks[field] ?? "missing"}' (expected 'passed')`,
        );
      }
    }
    if (checks.generatedTypesVerified !== true) {
      reasons.push("Published verification check 'generatedTypesVerified' is not true");
    }
    if (!Number.isInteger(checks.syncedAiSkillsCount) || checks.syncedAiSkillsCount < 13) {
      reasons.push(
        `Published verification check 'syncedAiSkillsCount' is '${checks.syncedAiSkillsCount ?? "missing"}' (expected >= 13)`,
      );
    }
    if (
      !Array.isArray(checks.subpathExportsVerified) ||
      checks.subpathExportsVerified.length < 11
    ) {
      reasons.push(
        "Published verification check 'subpathExportsVerified' did not verify all 11 required subpath exports",
      );
    }
  }

  if (reasons.length > 0) {
    return { status: "FAILED", valid: false, reasons };
  }
  return { status: "PASSED", valid: true, reasons: [] };
}

export function validatePublishedRunProvenance({
  lastRun,
  publishedManifest,
  currentExamplesCommit,
}) {
  const manifestCheck = validatePublishedManifest(publishedManifest, currentExamplesCommit);
  if (!manifestCheck.valid) {
    return manifestCheck;
  }

  if (!lastRun || typeof lastRun !== "object" || !lastRun.projects) {
    return {
      status: "NOT_RUN",
      valid: false,
      reasons: ["Missing .packed/last-run-published.json"],
    };
  }

  const reasons = [];
  if (lastRun.provenanceType !== "PUBLIC_NPM_REGISTRY") {
    reasons.push(
      `last-run provenanceType is '${lastRun.provenanceType ?? "RELEASE_CANDIDATE"}' (expected 'PUBLIC_NPM_REGISTRY'). Stale RC run results cannot satisfy the published-package gate.`,
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

  const manifestAgboss = publishedManifest.packages?.agboss;
  const manifestCli = publishedManifest.packages?.agbossCli;
  if (lastRun.frameworkVersion !== manifestAgboss?.version) {
    reasons.push(
      `last-run frameworkVersion (${lastRun.frameworkVersion ?? "none"}) does not match published-manifest (${manifestAgboss?.version ?? "none"})`,
    );
  }
  if (lastRun.cliVersion !== manifestCli?.version) {
    reasons.push(
      `last-run cliVersion (${lastRun.cliVersion ?? "none"}) does not match published-manifest (${manifestCli?.version ?? "none"})`,
    );
  }

  const runHashes = lastRun.packageHashes ?? {};
  if (!manifestAgboss?.integrity || runHashes.agboss !== manifestAgboss.integrity) {
    reasons.push("last-run agboss registry integrity does not match published-manifest.json");
  }
  if (!manifestCli?.integrity || runHashes.agbossCli !== manifestCli.integrity) {
    reasons.push("last-run agboss-cli registry integrity does not match published-manifest.json");
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
  publishedManifest,
  pubVerify,
  provenanceMode = "rc",
  currentExamplesCommit,
  projectsCatalog = PROJECTS,
  projectExistsFn = () => true,
  requireP1 = false,
}) {
  const isPublishedMode = provenanceMode === "published";

  const pkgValidation = isPublishedMode
    ? validatePublishedVerification(pubVerify, publishedManifest)
    : validatePackageVerification(pkgVerify, manifest);

  const provenanceValidation = isPublishedMode
    ? validatePublishedRunProvenance({
        lastRun,
        publishedManifest,
        currentExamplesCommit,
      })
    : validateRunProvenance({
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
        gateReasons.push(
          `Project '${meta.name}' (${meta.priority}) is missing from ${isPublishedMode ? "last-run-published.json" : "last-run.json"}`,
        );
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
        error: "Project missing from run state",
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

  const activeManifest = isPublishedMode ? publishedManifest : manifest;

  return {
    schemaVersion: "2.0",
    provenanceType: isPublishedMode ? "PUBLIC_NPM_REGISTRY" : "RELEASE_CANDIDATE",
    generatedAt: new Date().toISOString(),
    nodeVersion: process.versions.node,
    runId: lastRun?.runId ?? null,
    frameworkVersion: activeManifest?.packages?.agboss?.version ?? "0.1.0",
    cliVersion: activeManifest?.packages?.agbossCli?.version ?? "0.1.0",
    sourceCommit: isPublishedMode
      ? "PUBLIC_NPM_REGISTRY"
      : (manifest?.sourceCommit ?? "unknown"),
    examplesSourceCommit:
      currentExamplesCommit ??
      activeManifest?.examplesSourceCommit ??
      lastRun?.examplesSourceCommit ??
      "unknown",
    packageHashes: {
      agboss: activeManifest?.packages?.agboss?.integrity ?? null,
      agbossSha256:
        (isPublishedMode
          ? activeManifest?.packages?.agboss?.shasum
          : activeManifest?.packages?.agboss?.sha256) ?? null,
      agbossCli: activeManifest?.packages?.agbossCli?.integrity ?? null,
      agbossCliSha256:
        (isPublishedMode
          ? activeManifest?.packages?.agbossCli?.shasum
          : activeManifest?.packages?.agbossCli?.sha256) ?? null,
    },
    gates: {
      provenanceGate,
      packageGate,
      p0Gate,
      p1Gate,
      overallGate,
    },
    gateReasons,
    packageVerification: isPublishedMode ? (pubVerify?.checks ?? null) : (pkgVerify?.checks ?? null),
    results,
    allP0Passed: p0Gate === "PASSED",
    allP1Passed: p1Gate === "PASSED",
  };
}

export function renderProofMarkdown(report) {
  const isPublished = report.provenanceType === "PUBLIC_NPM_REGISTRY";
  const channelSuffix = isPublished
    ? "public npm registry"
    : "pre-release candidate";
  const mdLines = [
    isPublished
      ? "# AGBoss Examples — Post-Publication Public Registry Proof Report"
      : "# AGBoss Examples — Executable Architecture & Reliability Proof Report",
    "",
    `- **Provenance Type:** \`${report.provenanceType ?? "RELEASE_CANDIDATE"}\``,
    `- **Generated at:** \`${report.generatedAt}\``,
    `- **Run ID:** \`${report.runId ?? "n/a"}\``,
    `- **Node.js:** \`${report.nodeVersion}\``,
    `- **AGBoss version:** \`${report.frameworkVersion}\` (${channelSuffix})`,
    `- **AGBoss CLI version:** \`${report.cliVersion}\` (${channelSuffix})`,
    `- **Framework source (\`agbossjs/agboss\`):** \`${report.sourceCommit}\``,
    `- **Examples source commit (\`agbossjs/agboss-examples\`):** \`${report.examplesSourceCommit}\``,
    `- **agboss integrity:** \`${report.packageHashes.agboss ?? "n/a"}\` (\`${report.packageHashes.agbossSha256 ?? "n/a"}\`)`,
    `- **agboss-cli integrity:** \`${report.packageHashes.agbossCli ?? "n/a"}\` (\`${report.packageHashes.agbossCliSha256 ?? "n/a"}\`)`,
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
  const provIdx = args.indexOf("--provenance");
  const provenanceMode = provIdx >= 0 ? (args[provIdx + 1] ?? "") : "rc";
  if (provenanceMode !== "rc" && provenanceMode !== "published") {
    console.error(
      `[collect-results] Invalid --provenance '${provenanceMode}'. Expected 'rc' or 'published'.`,
    );
    process.exit(1);
  }

  let currentExamplesCommit = "unknown";
  try {
    currentExamplesCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    currentExamplesCommit = "unknown";
  }

  if (provenanceMode === "published") {
    const pubManifestPath = join(ROOT, ".packed", "published-manifest.json");
    const pubVerifyPath = join(ROOT, ".packed", "published-verification.json");
    const lastRunPubPath = join(ROOT, ".packed", "last-run-published.json");

    const publishedManifest = existsSync(pubManifestPath)
      ? JSON.parse(readFileSync(pubManifestPath, "utf8"))
      : undefined;
    const pubVerify = existsSync(pubVerifyPath)
      ? JSON.parse(readFileSync(pubVerifyPath, "utf8"))
      : undefined;
    const lastRun = existsSync(lastRunPubPath)
      ? JSON.parse(readFileSync(lastRunPubPath, "utf8"))
      : undefined;

    const report = evaluateProofReport({
      lastRun,
      publishedManifest,
      pubVerify,
      provenanceMode: "published",
      currentExamplesCommit,
      projectsCatalog: PROJECTS,
      projectExistsFn: (projectName) => existsSync(join(ROOT, projectName, "package.json")),
      requireP1,
    });

    writeFileSync(
      join(ROOT, "published-proof-results.json"),
      JSON.stringify(report, null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(ROOT, "published-proof-report.md"),
      renderProofMarkdown(report),
      "utf8",
    );
    console.log(
      `[collect-results] Wrote published-proof-results.json and published-proof-report.md (Overall Gate: ${report.gates.overallGate}, P0: ${report.gates.p0Gate}, P1: ${report.gates.p1Gate}, Package: ${report.gates.packageGate})`,
    );

    if (report.gates.overallGate !== "PASSED") {
      console.error("[collect-results] Published proof gate FAILED:", report.gateReasons);
      process.exit(1);
    }
    return;
  }

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

  const report = evaluateProofReport({
    lastRun,
    manifest,
    pkgVerify,
    provenanceMode: "rc",
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

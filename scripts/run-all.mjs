#!/usr/bin/env node
/**
 * Orchestrates `npm run check`, `npm test`, or `npm run demo` (or `--mode all`) across independent
 * example projects and writes provenance-bound per-project status into:
 *   - `.packed/last-run.json` (when `--provenance rc`, default)
 *   - `.packed/last-run-published.json` (when `--provenance published`)
 *
 * Status model (P0-1 & P0-3):
 *   - PASSED: check executed and exited with 0
 *   - FAILED: check executed and exited non-zero, or required project/package.json is missing,
 *             or installed package provenance fails validation
 *   - SKIPPED: explicitly skipped
 *   - NOT_RUN: has not been executed in the current provenance-bound run
 *   - BLOCKED: prerequisite missing
 */
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  SHA1_HEX_RE,
  SHA256_HEX_RE,
  SHA512_SRI_RE,
  validateInstalledPackageResolution,
} from "./verify-published.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.env.npm_config_cache = join(ROOT, ".packed", ".npm-cache");

export const PROJECTS = [
  {
    name: "01-hello-agboss",
    priority: "P0",
    mode: "offline-deterministic",
    primaryProof: "Independent installation, DI, workflow assembly, first execution",
  },
  {
    name: "02-path-scope-proof",
    priority: "P0",
    mode: "offline-deterministic",
    primaryProof: "Static graph safety, data availability, freshness, parallel dataflow",
  },
  {
    name: "03-support-refund-desk",
    priority: "P0",
    mode: "offline-deterministic",
    primaryProof: "Guardrails, PII, tool interception, memory, evals",
  },
  {
    name: "04-travel-booking-saga",
    priority: "P0",
    mode: "fault-injection",
    primaryProof: "Transaction compensation, interruption, recovery, quorum, HITL",
  },
  {
    name: "05-cluster-work-stealing",
    priority: "P1",
    mode: "fault-injection",
    primaryProof: "Distributed scheduling, leases, failure recovery, backpressure",
  },
  {
    name: "06-enterprise-agent-mesh",
    priority: "P1",
    mode: "multi-service",
    primaryProof: "A2A, MCP, federation, cross-service tracing",
  },
  {
    name: "07-langgraph-migration",
    priority: "P0",
    mode: "deterministic-reference",
    primaryProof:
      "Deterministic before/after reference migration from raw LangGraph God State to AGBoss narrow DTOs & Flow DSL",
  },
  {
    name: "08-job-scout",
    priority: "P1",
    mode: "offline-deterministic",
    primaryProof:
      "A real multi-step agent: model router, tools, per-job Jev judge, MCP approval, guardrails, budgets",
  },
];

export function parseRunAllArgs(args) {
  const modeIdx = args.indexOf("--mode");
  const mode = modeIdx >= 0 ? (args[modeIdx + 1] ?? "test") : "test";
  const includeP1 = args.includes("--include-p1");
  const projectFilterIdx = args.indexOf("--project");
  const projectFilter = projectFilterIdx >= 0 ? args[projectFilterIdx + 1] : undefined;
  const resetState = args.includes("--reset");
  const provIdx = args.indexOf("--provenance");
  const provenance = provIdx >= 0 ? (args[provIdx + 1] ?? "") : "rc";
  if (provenance !== "rc" && provenance !== "published") {
    throw new Error(
      `Invalid --provenance '${provenance}'. Expected 'rc' or 'published'.`,
    );
  }
  return { mode, includeP1, projectFilter, resetState, provenance };
}

export function selectProjects(args, projects = PROJECTS) {
  const { includeP1, projectFilter } = parseRunAllArgs(args);
  if (projectFilter !== undefined) {
    return projects.filter((meta) => meta.name === projectFilter);
  }
  return projects.filter((meta) => includeP1 || meta.priority === "P0");
}

export function createInitialProjectEntry(meta) {
  return {
    project: meta.name,
    priority: meta.priority,
    primaryProof: meta.primaryProof,
    mode: meta.mode,
    checkStatus: "NOT_RUN",
    checkExitCode: null,
    checkExecutedAt: null,
    testStatus: "NOT_RUN",
    testExitCode: null,
    testExecutedAt: null,
    demoStatus: "NOT_RUN",
    demoExitCode: null,
    demoExecutedAt: null,
    durationMs: 0,
    error: null,
  };
}

export function isProvenanceMatching(existingState, currentProvenance) {
  if (!existingState || typeof existingState !== "object") return false;
  if (!currentProvenance || typeof currentProvenance !== "object") return false;
  const existingType = existingState.provenanceType ?? "RELEASE_CANDIDATE";
  const currentType = currentProvenance.provenanceType ?? "RELEASE_CANDIDATE";
  if (existingType !== currentType) return false;
  if (existingState.frameworkSourceCommit !== currentProvenance.frameworkSourceCommit) return false;
  if (existingState.examplesSourceCommit !== currentProvenance.examplesSourceCommit) return false;
  if (
    currentProvenance.frameworkVersion &&
    existingState.frameworkVersion &&
    existingState.frameworkVersion !== currentProvenance.frameworkVersion
  ) {
    return false;
  }
  if (
    currentProvenance.cliVersion &&
    existingState.cliVersion &&
    existingState.cliVersion !== currentProvenance.cliVersion
  ) {
    return false;
  }
  const prevHashes = existingState.packageHashes ?? {};
  const currHashes = currentProvenance.packageHashes ?? {};
  if (prevHashes.agboss !== currHashes.agboss) return false;
  if (prevHashes.agbossCli !== currHashes.agbossCli) return false;
  if (currHashes.agbossSha256 && prevHashes.agbossSha256 !== currHashes.agbossSha256) return false;
  if (currHashes.agbossCliSha256 && prevHashes.agbossCliSha256 !== currHashes.agbossCliSha256) {
    return false;
  }
  if (currHashes.agbossShasum && prevHashes.agbossShasum !== currHashes.agbossShasum) return false;
  if (currHashes.agbossCliShasum && prevHashes.agbossCliShasum !== currHashes.agbossCliShasum) {
    return false;
  }
  return true;
}

export function initializeOrLoadRunState({
  existingState,
  resetState,
  provenance,
  projectsCatalog = PROJECTS,
}) {
  const canReuse =
    !resetState && existingState && isProvenanceMatching(existingState, provenance);
  const now = new Date().toISOString();
  const provenanceType = provenance.provenanceType ?? "RELEASE_CANDIDATE";
  const base = canReuse
    ? {
        ...existingState,
        provenanceType,
        updatedAt: now,
        projects: { ...(existingState.projects ?? {}) },
      }
    : {
        runId: randomUUID(),
        provenanceType,
        startedAt: now,
        updatedAt: now,
        nodeVersion: provenance.nodeVersion,
        frameworkSourceCommit: provenance.frameworkSourceCommit,
        examplesSourceCommit: provenance.examplesSourceCommit,
        frameworkVersion: provenance.frameworkVersion,
        cliVersion: provenance.cliVersion,
        packageHashes: { ...provenance.packageHashes },
        projects: {},
      };

  for (const meta of projectsCatalog) {
    if (!base.projects[meta.name]) {
      base.projects[meta.name] = createInitialProjectEntry(meta);
    } else {
      base.projects[meta.name] = {
        ...createInitialProjectEntry(meta),
        ...base.projects[meta.name],
        project: meta.name,
        priority: meta.priority,
        primaryProof: meta.primaryProof,
        mode: meta.mode,
      };
    }
  }
  return base;
}

function isLocalTarballUrl(url) {
  return typeof url === "string" && url.startsWith("file:") && url.endsWith(".tgz");
}

function isOfficialRegistryTarballUrl(url, packageName) {
  const unscopedName = String(packageName).replace(/^@[^/]+\//, "");
  return (
    typeof url === "string" &&
    url.startsWith(`https://registry.npmjs.org/${packageName}/-/${unscopedName}-`) &&
    url.endsWith(".tgz") &&
    !url.includes(".packed")
  );
}

export function resolvePortablePackedTarballPath(repoRoot, filename, packageLabel = "package") {
  if (
    typeof filename !== "string" ||
    filename.trim() === "" ||
    !filename.endsWith(".tgz") ||
    basename(filename) !== filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..")
  ) {
    throw new Error(
      `Invalid or unsafe tarball filename '${String(filename)}' for ${packageLabel} in .packed/manifest.json`,
    );
  }
  const fullPath = join(repoRoot, ".packed", filename);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing canonical tarball for ${packageLabel} at ${fullPath}`);
  }
  return fullPath;
}

export function resolveScaffoldTestConfig({ projectRoot, repoRoot, env = process.env }) {
  if (!projectRoot || !existsSync(projectRoot)) {
    throw new Error(`Missing projectRoot directory: ${String(projectRoot)}`);
  }
  if (!repoRoot || !existsSync(repoRoot)) {
    throw new Error(`Missing repoRoot directory: ${String(repoRoot)}`);
  }

  const realProjectRoot = realpathSync(projectRoot);
  const nodeModulesDir = join(realProjectRoot, "node_modules");
  const agbossDir = join(nodeModulesDir, "@agboss", "core");
  const cliDir = join(nodeModulesDir, "@agboss", "cli");

  if (!existsSync(join(agbossDir, "package.json")) || !existsSync(join(cliDir, "package.json"))) {
    throw new Error(
      `Missing installed @agboss/core or @agboss/cli in ${projectRoot}/node_modules`,
    );
  }

  const realAgbossDir = realpathSync(agbossDir);
  const realCliDir = realpathSync(cliDir);
  if (
    !realAgbossDir.startsWith(nodeModulesDir + sep) ||
    !realCliDir.startsWith(nodeModulesDir + sep)
  ) {
    throw new Error(
      `Installed @agboss/core or @agboss/cli resolves outside node_modules (symlink/workspace leak): @agboss/core=${realAgbossDir}, @agboss/cli=${realCliDir}`,
    );
  }

  const lockPath = existsSync(join(realProjectRoot, "package-lock.json"))
    ? join(realProjectRoot, "package-lock.json")
    : existsSync(join(nodeModulesDir, ".package-lock.json"))
      ? join(nodeModulesDir, ".package-lock.json")
      : null;

  if (!lockPath) {
    throw new Error(
      `Missing package-lock.json or node_modules/.package-lock.json in ${projectRoot}; cannot verify installed package provenance`,
    );
  }

  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const agbossLock = lock.packages?.["node_modules/@agboss/core"];
  const cliLock = lock.packages?.["node_modules/@agboss/cli"];
  if (!agbossLock || !cliLock) {
    throw new Error(
      `Missing lockfile entries for node_modules/@agboss/core or node_modules/@agboss/cli in ${lockPath}`,
    );
  }
  if (agbossLock.link === true || cliLock.link === true) {
    throw new Error(`Lockfile in ${projectRoot} contains symlink/workspace link`);
  }

  const agbossResolved = String(agbossLock.resolved ?? "");
  const cliResolved = String(cliLock.resolved ?? "");

  let installedProvenance;
  if (isLocalTarballUrl(agbossResolved) && isLocalTarballUrl(cliResolved)) {
    installedProvenance = "rc";
  } else if (
    isOfficialRegistryTarballUrl(agbossResolved, "@agboss/core") &&
    isOfficialRegistryTarballUrl(cliResolved, "@agboss/cli")
  ) {
    installedProvenance = "published";
  } else {
    throw new Error(
      `Unknown or mixed installed package provenance in ${projectRoot}: @agboss/core='${agbossResolved}', @agboss/cli='${cliResolved}'`,
    );
  }

  const rawExplicitMode = env?.AGBOSS_PROVENANCE_MODE;
  if (rawExplicitMode !== undefined && rawExplicitMode !== "") {
    if (rawExplicitMode !== "rc" && rawExplicitMode !== "published") {
      throw new Error(
        `Invalid AGBOSS_PROVENANCE_MODE '${rawExplicitMode}'. Expected 'rc' or 'published'.`,
      );
    }
    if (rawExplicitMode !== installedProvenance) {
      throw new Error(
        `Provenance mismatch: AGBOSS_PROVENANCE_MODE is '${rawExplicitMode}' but installed packages in ${projectRoot} have '${installedProvenance}' provenance (@agboss/core='${agbossResolved}', @agboss/cli='${cliResolved}')`,
      );
    }
  }

  if (installedProvenance === "rc") {
    const manifestPath = join(repoRoot, ".packed", "manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`Missing .packed/manifest.json at ${manifestPath}`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const agbossMeta = manifest.packages?.agboss;
    const cliMeta = manifest.packages?.agbossCli;
    if (
      !agbossMeta?.version ||
      !agbossMeta?.integrity ||
      !cliMeta?.version ||
      !cliMeta?.integrity
    ) {
      throw new Error("Missing agboss or agbossCli version/integrity in .packed/manifest.json");
    }

    const agbossTarballPath = resolvePortablePackedTarballPath(
      repoRoot,
      agbossMeta.filename,
      "@agboss/core",
    );
    const cliTarballPath = resolvePortablePackedTarballPath(
      repoRoot,
      cliMeta.filename,
      "@agboss/cli",
    );

    if (
      agbossLock.integrity !== agbossMeta.integrity ||
      cliLock.integrity !== cliMeta.integrity
    ) {
      throw new Error(
        `Installed RC lockfile integrity in ${projectRoot} does not match .packed/manifest.json`,
      );
    }

    return {
      provenance: "rc",
      agbossSpec: `file:${agbossTarballPath}`,
      cliSpec: `file:${cliTarballPath}`,
      useOverrides: true,
      expectedVersion: {
        agboss: String(agbossMeta.version),
        agbossCli: String(cliMeta.version),
      },
      expectedIntegrity: {
        agboss: String(agbossMeta.integrity),
        agbossCli: String(cliMeta.integrity),
      },
      expectedResolved: {
        agboss: `file:${agbossTarballPath}`,
        agbossCli: `file:${cliTarballPath}`,
      },
    };
  }

  const pubManifestPath = join(repoRoot, ".packed", "published-manifest.json");
  if (!existsSync(pubManifestPath)) {
    throw new Error(`Missing .packed/published-manifest.json at ${pubManifestPath}`);
  }
  const pubManifest = JSON.parse(readFileSync(pubManifestPath, "utf8"));
  if (
    pubManifest.provenanceType !== "PUBLIC_NPM_REGISTRY" ||
    pubManifest.source !== "PUBLIC_NPM_REGISTRY"
  ) {
    throw new Error(
      `Invalid provenanceType/source in .packed/published-manifest.json: '${String(pubManifest.provenanceType)}' / '${String(pubManifest.source)}'`,
    );
  }

  const agbossPub = pubManifest.packages?.agboss;
  const cliPub = pubManifest.packages?.agbossCli;
  if (
    !agbossPub?.version ||
    !agbossPub?.integrity ||
    !isOfficialRegistryTarballUrl(agbossPub.tarball, "@agboss/core") ||
    !cliPub?.version ||
    !cliPub?.integrity ||
    !isOfficialRegistryTarballUrl(cliPub.tarball, "@agboss/cli")
  ) {
    throw new Error(
      "Missing or invalid public registry metadata for @agboss/core or @agboss/cli in .packed/published-manifest.json",
    );
  }

  if (
    agbossLock.integrity !== agbossPub.integrity ||
    cliLock.integrity !== cliPub.integrity
  ) {
    throw new Error(
      `Installed published lockfile integrity in ${projectRoot} does not match .packed/published-manifest.json`,
    );
  }

  return {
    provenance: "published",
    agbossSpec: String(agbossPub.version),
    cliSpec: String(cliPub.version),
    useOverrides: false,
    expectedVersion: {
      agboss: String(agbossPub.version),
      agbossCli: String(cliPub.version),
    },
    expectedIntegrity: {
      agboss: String(agbossPub.integrity),
      agbossCli: String(cliPub.integrity),
    },
    expectedResolved: {
      agboss: String(agbossPub.tarball),
      agbossCli: String(cliPub.tarball),
    },
  };
}

export function verifyScaffoldInstalledPackages({ appDir, config }) {
  if (!appDir || !existsSync(appDir)) {
    throw new Error(`Missing scaffold appDir: ${String(appDir)}`);
  }
  const realAppDir = realpathSync(appDir);
  const nodeModulesDir = join(realAppDir, "node_modules");
  const agbossDir = join(nodeModulesDir, "@agboss", "core");
  const cliDir = join(nodeModulesDir, "@agboss", "cli");

  if (!existsSync(join(agbossDir, "package.json")) || !existsSync(join(cliDir, "package.json"))) {
    throw new Error(`Scaffold at ${appDir} is missing node_modules/@agboss/core or node_modules/@agboss/cli`);
  }

  const realAgbossDir = realpathSync(agbossDir);
  const realCliDir = realpathSync(cliDir);
  if (
    !realAgbossDir.startsWith(nodeModulesDir + sep) ||
    !realCliDir.startsWith(nodeModulesDir + sep)
  ) {
    throw new Error(
      `Scaffold packages resolved outside node_modules (symlink leak): @agboss/core=${realAgbossDir}, @agboss/cli=${realCliDir}`,
    );
  }

  const agbossPkg = JSON.parse(readFileSync(join(agbossDir, "package.json"), "utf8"));
  const cliPkg = JSON.parse(readFileSync(join(cliDir, "package.json"), "utf8"));
  if (agbossPkg.version !== config.expectedVersion.agboss) {
    throw new Error(
      `Scaffold installed @agboss/core@${String(agbossPkg.version)} (expected ${config.expectedVersion.agboss})`,
    );
  }
  if (cliPkg.version !== config.expectedVersion.agbossCli) {
    throw new Error(
      `Scaffold installed @agboss/cli@${String(cliPkg.version)} (expected ${config.expectedVersion.agbossCli})`,
    );
  }

  const lockPath = existsSync(join(realAppDir, "package-lock.json"))
    ? join(realAppDir, "package-lock.json")
    : existsSync(join(nodeModulesDir, ".package-lock.json"))
      ? join(nodeModulesDir, ".package-lock.json")
      : null;
  if (!lockPath) {
    throw new Error(`Scaffold at ${appDir} is missing package-lock.json`);
  }

  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const agbossLock = lock.packages?.["node_modules/@agboss/core"];
  const cliLock = lock.packages?.["node_modules/@agboss/cli"];
  if (!agbossLock || !cliLock) {
    throw new Error(`Scaffold lockfile at ${lockPath} is missing @agboss/core or @agboss/cli entries`);
  }
  if (agbossLock.link === true || cliLock.link === true) {
    throw new Error(`Scaffold lockfile at ${lockPath} contains symlink/workspace link`);
  }
  if (agbossLock.version !== config.expectedVersion.agboss) {
    throw new Error(
      `Scaffold lockfile @agboss/core version '${String(agbossLock.version)}' does not match '${config.expectedVersion.agboss}'`,
    );
  }
  if (cliLock.version !== config.expectedVersion.agbossCli) {
    throw new Error(
      `Scaffold lockfile @agboss/cli version '${String(cliLock.version)}' does not match '${config.expectedVersion.agbossCli}'`,
    );
  }
  if (agbossLock.integrity !== config.expectedIntegrity.agboss) {
    throw new Error(
      `Scaffold lockfile @agboss/core integrity '${String(agbossLock.integrity)}' does not match '${config.expectedIntegrity.agboss}'`,
    );
  }
  if (cliLock.integrity !== config.expectedIntegrity.agbossCli) {
    throw new Error(
      `Scaffold lockfile @agboss/cli integrity '${String(cliLock.integrity)}' does not match '${config.expectedIntegrity.agbossCli}'`,
    );
  }

  const agbossResolved = String(agbossLock.resolved ?? "");
  const cliResolved = String(cliLock.resolved ?? "");
  if (config.provenance === "published") {
    if (
      !isOfficialRegistryTarballUrl(agbossResolved, "@agboss/core") ||
      agbossResolved !== config.expectedResolved.agboss
    ) {
      throw new Error(
        `Scaffold lockfile @agboss/core resolved URL '${agbossResolved}' does not match registry tarball '${config.expectedResolved.agboss}'`,
      );
    }
    if (
      !isOfficialRegistryTarballUrl(cliResolved, "@agboss/cli") ||
      cliResolved !== config.expectedResolved.agbossCli
    ) {
      throw new Error(
        `Scaffold lockfile @agboss/cli resolved URL '${cliResolved}' does not match registry tarball '${config.expectedResolved.agbossCli}'`,
      );
    }
  } else {
    if (!isLocalTarballUrl(agbossResolved) || !isLocalTarballUrl(cliResolved)) {
      throw new Error(
        `Scaffold lockfile in RC mode did not resolve from local tarballs: @agboss/core='${agbossResolved}', @agboss/cli='${cliResolved}'`,
      );
    }
  }

  return {
    agboss: {
      version: String(agbossPkg.version),
      resolved: agbossResolved,
      integrity: String(agbossLock.integrity),
      realpath: realAgbossDir,
    },
    agbossCli: {
      version: String(cliPkg.version),
      resolved: cliResolved,
      integrity: String(cliLock.integrity),
      realpath: realCliDir,
    },
  };
}

function readCurrentProvenance(provenanceMode = "rc") {
  let examplesSourceCommit = "unknown";
  try {
    examplesSourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    examplesSourceCommit = "unknown";
  }

  if (provenanceMode === "published") {
    const pubManifestPath = join(ROOT, ".packed", "published-manifest.json");
    if (!existsSync(pubManifestPath)) {
      throw new Error(
        "Missing .packed/published-manifest.json required for `--provenance published`. Run `npm run install:published -- --live-registry --version <ver>` first.",
      );
    }
    const pubManifest = JSON.parse(readFileSync(pubManifestPath, "utf8"));
    if (pubManifest.provenanceType !== "PUBLIC_NPM_REGISTRY") {
      throw new Error(
        `Invalid provenanceType '${pubManifest.provenanceType ?? "none"}' in .packed/published-manifest.json (expected 'PUBLIC_NPM_REGISTRY'). Cannot use RC or local tarball manifests for published provenance.`,
      );
    }
    const agbossPkg = pubManifest.packages?.agboss;
    const cliPkg = pubManifest.packages?.agbossCli;
    if (!agbossPkg?.sha256 || !SHA256_HEX_RE.test(String(agbossPkg.sha256))) {
      throw new Error(
        `Invalid or missing 64-character SHA-256 digest for agboss in .packed/published-manifest.json: '${agbossPkg?.sha256 ?? "none"}'`,
      );
    }
    if (!cliPkg?.sha256 || !SHA256_HEX_RE.test(String(cliPkg.sha256))) {
      throw new Error(
        `Invalid or missing 64-character SHA-256 digest for agboss-cli in .packed/published-manifest.json: '${cliPkg?.sha256 ?? "none"}'`,
      );
    }
    if (!agbossPkg?.shasum || !SHA1_HEX_RE.test(String(agbossPkg.shasum))) {
      throw new Error(
        `Invalid or missing 40-character SHA-1 shasum for agboss in .packed/published-manifest.json: '${agbossPkg?.shasum ?? "none"}'`,
      );
    }
    if (!cliPkg?.shasum || !SHA1_HEX_RE.test(String(cliPkg.shasum))) {
      throw new Error(
        `Invalid or missing 40-character SHA-1 shasum for agboss-cli in .packed/published-manifest.json: '${cliPkg?.shasum ?? "none"}'`,
      );
    }
    if (!agbossPkg?.integrity || !SHA512_SRI_RE.test(String(agbossPkg.integrity))) {
      throw new Error(
        `Invalid or missing SHA-512 integrity for agboss in .packed/published-manifest.json: '${agbossPkg?.integrity ?? "none"}'`,
      );
    }
    if (!cliPkg?.integrity || !SHA512_SRI_RE.test(String(cliPkg.integrity))) {
      throw new Error(
        `Invalid or missing SHA-512 integrity for agboss-cli in .packed/published-manifest.json: '${cliPkg?.integrity ?? "none"}'`,
      );
    }
    return {
      provenanceType: "PUBLIC_NPM_REGISTRY",
      nodeVersion: process.versions.node,
      frameworkSourceCommit: "PUBLIC_NPM_REGISTRY",
      examplesSourceCommit,
      frameworkVersion: agbossPkg.version ?? "unknown",
      cliVersion: cliPkg.version ?? "unknown",
      packageHashes: {
        agboss: agbossPkg.integrity,
        agbossSha256: agbossPkg.sha256,
        agbossShasum: agbossPkg.shasum,
        agbossCli: cliPkg.integrity,
        agbossCliSha256: cliPkg.sha256,
        agbossCliShasum: cliPkg.shasum,
      },
    };
  }

  const manifestPath = join(ROOT, ".packed", "manifest.json");
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : undefined;
  return {
    provenanceType: "RELEASE_CANDIDATE",
    nodeVersion: process.versions.node,
    frameworkSourceCommit: manifest?.sourceCommit ?? "unknown",
    examplesSourceCommit,
    frameworkVersion: manifest?.packages?.agboss?.version ?? "0.1.0",
    cliVersion: manifest?.packages?.agbossCli?.version ?? "0.1.0",
    packageHashes: {
      agboss: manifest?.packages?.agboss?.integrity ?? null,
      agbossSha256: manifest?.packages?.agboss?.sha256 ?? null,
      agbossShasum: manifest?.packages?.agboss?.shasum ?? null,
      agbossCli: manifest?.packages?.agbossCli?.integrity ?? null,
      agbossCliSha256: manifest?.packages?.agbossCli?.sha256 ?? null,
      agbossCliShasum: manifest?.packages?.agbossCli?.shasum ?? null,
    },
  };
}

function runMain() {
  const args = process.argv.slice(2);
  let parsed;
  try {
    parsed = parseRunAllArgs(args);
  } catch (err) {
    console.error(`[run-all] ARGUMENT ERROR: ${err.message}`);
    process.exit(1);
  }
  const { mode, resetState, provenance: provenanceMode } = parsed;
  const modesToRun = mode === "all" ? ["check", "test", "demo"] : [mode];
  const selected = selectProjects(args);
  const selectedNames = new Set(selected.map((p) => p.name));

  const stateDir = join(ROOT, ".packed");
  mkdirSync(stateDir, { recursive: true });
  const stateFilename =
    provenanceMode === "published" ? "last-run-published.json" : "last-run.json";
  const statePath = join(stateDir, stateFilename);
  const rawExisting = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : undefined;

  let provenance;
  try {
    provenance = readCurrentProvenance(provenanceMode);
  } catch (err) {
    console.error(`[run-all] PROVENANCE ERROR: ${err.message}`);
    process.exit(1);
  }

  const state = initializeOrLoadRunState({
    existingState: rawExisting,
    resetState,
    provenance,
    projectsCatalog: PROJECTS,
  });

  let hasFailure = false;

  for (const meta of PROJECTS) {
    if (!selectedNames.has(meta.name)) continue;

    const projectDir = join(ROOT, meta.name);
    const pkgPath = join(projectDir, "package.json");
    if (!existsSync(pkgPath)) {
      console.error(
        `[run-all] ERROR: Required project ${meta.name} is missing package.json at ${pkgPath}`,
      );
      hasFailure = true;
      const prev = state.projects[meta.name];
      const now = new Date().toISOString();
      for (const m of modesToRun) {
        if (m === "check") {
          prev.checkStatus = "FAILED";
          prev.checkExitCode = 1;
          prev.checkExecutedAt = now;
        } else if (m === "test") {
          prev.testStatus = "FAILED";
          prev.testExitCode = 1;
          prev.testExecutedAt = now;
        } else if (m === "demo") {
          prev.demoStatus = "FAILED";
          prev.demoExitCode = 1;
          prev.demoExecutedAt = now;
        }
      }
      prev.error = `Missing project directory or package.json at ${pkgPath}`;
      continue;
    }

    if (provenanceMode === "published") {
      const resCheck = validateInstalledPackageResolution({
        projectDir,
        expectedVersion: provenance.frameworkVersion,
        mode: "live-registry",
        expectedIntegrity: {
          agboss: provenance.packageHashes.agboss,
          agbossCli: provenance.packageHashes.agbossCli,
        },
      });
      if (!resCheck.valid) {
        console.error(
          `[run-all] PUBLISHED PROVENANCE ERROR in ${meta.name}: ${resCheck.reasons.join("; ")}`,
        );
        hasFailure = true;
        const prev = state.projects[meta.name];
        const now = new Date().toISOString();
        for (const m of modesToRun) {
          if (m === "check") {
            prev.checkStatus = "FAILED";
            prev.checkExitCode = 1;
            prev.checkExecutedAt = now;
          } else if (m === "test") {
            prev.testStatus = "FAILED";
            prev.testExitCode = 1;
            prev.testExecutedAt = now;
          } else if (m === "demo") {
            prev.demoStatus = "FAILED";
            prev.demoExitCode = 1;
            prev.demoExecutedAt = now;
          }
        }
        prev.error = `Published package provenance check failed: ${resCheck.reasons.join("; ")}`;
        continue;
      }
    }

    for (const currentMode of modesToRun) {
      console.log(`\n============================================================`);
      console.log(
        `[run-all] ${meta.name} (${meta.priority}) — mode: ${currentMode} [provenance: ${provenanceMode}]`,
      );
      console.log(`============================================================`);

      const start = Date.now();
      const cmdArgs = currentMode === "test" ? ["test"] : ["run", currentMode];
      const res = spawnSync("npm", cmdArgs, {
        cwd: projectDir,
        stdio: "inherit",
        env: {
          ...process.env,
          NO_COLOR: "1",
          AGBOSS_OFFLINE_VERIFY: process.env.AGBOSS_OFFLINE_VERIFY ?? "1",
          AGBOSS_PROVENANCE_MODE: provenanceMode,
        },
      });
      const durationMs = Date.now() - start;
      const exitCode = res.status ?? 1;
      const passed = exitCode === 0;
      const executedAt = new Date().toISOString();
      if (!passed) hasFailure = true;

      const prev = state.projects[meta.name];
      if (currentMode === "check") {
        prev.checkStatus = passed ? "PASSED" : "FAILED";
        prev.checkExitCode = exitCode;
        prev.checkExecutedAt = executedAt;
      } else if (currentMode === "test") {
        prev.testStatus = passed ? "PASSED" : "FAILED";
        prev.testExitCode = exitCode;
        prev.testExecutedAt = executedAt;
      } else if (currentMode === "demo") {
        prev.demoStatus = passed ? "PASSED" : "FAILED";
        prev.demoExitCode = exitCode;
        prev.demoExecutedAt = executedAt;
      }
      prev.durationMs = (prev.durationMs ?? 0) + durationMs;
      prev.error = passed ? prev.error : `Mode '${currentMode}' exited with code ${exitCode}`;
    }
  }

  state.updatedAt = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");

  if (hasFailure) {
    process.exit(1);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  runMain();
}

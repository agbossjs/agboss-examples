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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateInstalledPackageResolution } from "./verify-published.mjs";

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
    return {
      provenanceType: "PUBLIC_NPM_REGISTRY",
      nodeVersion: process.versions.node,
      frameworkSourceCommit: "PUBLIC_NPM_REGISTRY",
      examplesSourceCommit,
      frameworkVersion: pubManifest.packages?.agboss?.version ?? "unknown",
      cliVersion: pubManifest.packages?.agbossCli?.version ?? "unknown",
      packageHashes: {
        agboss: pubManifest.packages?.agboss?.integrity ?? null,
        agbossSha256: pubManifest.packages?.agboss?.shasum ?? null,
        agbossCli: pubManifest.packages?.agbossCli?.integrity ?? null,
        agbossCliSha256: pubManifest.packages?.agbossCli?.shasum ?? null,
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
      agbossCli: manifest?.packages?.agbossCli?.integrity ?? null,
      agbossCliSha256: manifest?.packages?.agbossCli?.sha256 ?? null,
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

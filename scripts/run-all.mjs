#!/usr/bin/env node
/**
 * Orchestrates `npm run check`, `npm test`, or `npm run demo` across independent example projects
 * and writes per-project status into `.packed/last-run.json` for `collect-results.mjs`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
    name: "07-langgraph-migration-smoke",
    priority: "P0",
    mode: "model-assisted",
    primaryProof: "AI coding agents can migrate and validate an application",
  },
];

const args = process.argv.slice(2);
const modeIdx = args.indexOf("--mode");
const mode = modeIdx >= 0 ? (args[modeIdx + 1] ?? "test") : "test";
const includeP1 = args.includes("--include-p1") || true; // Run all available projects
const projectFilterIdx = args.indexOf("--project");
const projectFilter = projectFilterIdx >= 0 ? args[projectFilterIdx + 1] : undefined;

const stateDir = join(ROOT, ".packed");
mkdirSync(stateDir, { recursive: true });
const statePath = join(stateDir, "last-run.json");
const existing = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { projects: {} };

let hasFailure = false;

for (const meta of PROJECTS) {
  if (!includeP1 && meta.priority === "P1") continue;
  if (projectFilter && meta.name !== projectFilter) continue;

  const projectDir = join(ROOT, meta.name);
  const pkgPath = join(projectDir, "package.json");
  if (!existsSync(pkgPath)) {
    console.log(`[run-all] Skipping ${meta.name} (no package.json yet)`);
    continue;
  }

  console.log(`\n============================================================`);
  console.log(`[run-all] ${meta.name} (${meta.priority}) — npm run ${mode}`);
  console.log(`============================================================`);

  const start = Date.now();
  const cmdArgs = mode === "test" ? ["test"] : ["run", mode];
  const res = spawnSync("npm", cmdArgs, {
    cwd: projectDir,
    stdio: "inherit",
    env: { ...process.env, NO_COLOR: "1" },
  });
  const durationMs = Date.now() - start;
  const passed = res.status === 0;
  if (!passed) hasFailure = true;

  const prev = existing.projects[meta.name] ?? {
    project: meta.name,
    priority: meta.priority,
    primaryProof: meta.primaryProof,
    mode: meta.mode,
    checkStatus: "skipped",
    testStatus: "skipped",
    durationMs: 0,
  };

  existing.projects[meta.name] = {
    ...prev,
    checkStatus: mode === "check" ? (passed ? "passed" : "failed") : prev.checkStatus,
    testStatus: mode === "test" ? (passed ? "passed" : "failed") : prev.testStatus,
    durationMs: prev.durationMs + durationMs,
  };
}

writeFileSync(statePath, JSON.stringify(existing, null, 2) + "\n", "utf8");

if (hasFailure) {
  process.exit(1);
}

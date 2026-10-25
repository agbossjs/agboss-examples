#!/usr/bin/env node
/**
 * Section 4.3 (EX-02): Installs packed `agboss` and `agboss-cli` tarballs into example projects.
 * Records the tarball substitution in `.packed/install-record.json`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, ".packed", "manifest.json");
process.env.npm_config_cache = join(ROOT, ".packed", ".npm-cache");

if (!existsSync(MANIFEST_PATH)) {
  console.error("[install-packed] .packed/manifest.json not found. Run `npm run pack:framework` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const { agboss, agbossCli } = manifest.packages;

const TARGET_DIRS = [
  "hello-agboss",
  "path-scope-proof",
  "travel-booking-saga",
  "support-refund-desk",
  "langgraph-migration-smoke",
  "enterprise-agent-mesh",
  "cluster-work-stealing",
];

const args = process.argv.slice(2);
const filterProject = args.find((a) => !a.startsWith("--"));

const records = [];

for (const relDir of TARGET_DIRS) {
  if (filterProject && relDir !== filterProject) continue;
  const projectDir = join(ROOT, relDir);
  const pkgPath = join(projectDir, "package.json");
  if (!existsSync(pkgPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const relAgboss = `file:${relative(projectDir, agboss.tarballPath)}`;
  const relCli = `file:${relative(projectDir, agbossCli.tarballPath)}`;

  if (pkg.dependencies?.["agboss"] !== undefined) {
    pkg.dependencies["agboss"] = relAgboss;
  }
  if (pkg.devDependencies?.["agboss-cli"] !== undefined) {
    pkg.devDependencies["agboss-cli"] = relCli;
  }
  pkg.overrides = {
    ...(pkg.overrides ?? {}),
    agboss: relAgboss,
    "agboss-cli": relCli,
  };

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log(`[install-packed] Installing dependencies in ${relDir}...`);
  rmSync(join(projectDir, "package-lock.json"), { force: true });
  rmSync(join(projectDir, "node_modules", "agboss"), { recursive: true, force: true });
  rmSync(join(projectDir, "node_modules", "agboss-cli"), { recursive: true, force: true });
  rmSync(join(projectDir, "node_modules", "@opentelemetry"), { recursive: true, force: true });
  rmSync(join(projectDir, "node_modules", "@langfuse"), { recursive: true, force: true });
  execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: projectDir,
    stdio: "inherit",
  });

  records.push({
    project: relDir,
    agbossTarball: relAgboss,
    agbossCliTarball: relCli,
    installedAt: new Date().toISOString(),
  });
}

writeFileSync(
  join(ROOT, ".packed", "install-record.json"),
  JSON.stringify({ sourceCommit: manifest.sourceCommit, records }, null, 2) + "\n",
  "utf8",
);
console.log(`[install-packed] Completed installation across ${records.length} project(s).`);

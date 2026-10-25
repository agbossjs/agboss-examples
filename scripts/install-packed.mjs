#!/usr/bin/env node
/**
 * Section 4.1 & 4.3 (EX-02): Release-Candidate vs Public Consumer Workflow.
 * Temporarily substitutes packed `agboss` and `agboss-cli` tarballs during `npm install`
 * so `node_modules` resolves the release candidate, then restores each `package.json`
 * to clean public registry specifications (`^0.1.0`) so local tarball paths are never
 * committed to git. Also supports `--restore` to clean manifests without installing.
 * Records the tarball substitution in `.packed/install-record.json`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, ".packed", "manifest.json");
process.env.npm_config_cache = join(ROOT, ".packed", ".npm-cache");

const TARGET_DIRS = [
  "01-hello-agboss",
  "02-path-scope-proof",
  "03-support-refund-desk",
  "04-travel-booking-saga",
  "05-cluster-work-stealing",
  "06-enterprise-agent-mesh",
  "07-langgraph-migration",
];

function restorePublicPkg(pkg, frameworkVersion = "0.1.0", cliVersion = "0.1.0") {
  const copy = structuredClone(pkg);
  if (copy.dependencies?.["agboss"] !== undefined) {
    copy.dependencies["agboss"] = `^${frameworkVersion}`;
  }
  if (copy.devDependencies?.["agboss-cli"] !== undefined) {
    copy.devDependencies["agboss-cli"] = `^${cliVersion}`;
  }
  if (copy.overrides && typeof copy.overrides === "object") {
    delete copy.overrides["agboss"];
    delete copy.overrides["agboss-cli"];
    if (Object.keys(copy.overrides).length === 0) {
      delete copy.overrides;
    }
  }
  return copy;
}

const args = process.argv.slice(2);
const restoreOnly = args.includes("--restore");
const keepPackedSpecs = args.includes("--keep-packed-specs");
const filterProject = args.find((a) => !a.startsWith("--"));

if (restoreOnly) {
  for (const relDir of TARGET_DIRS) {
    if (filterProject && relDir !== filterProject) continue;
    const pkgPath = join(ROOT, relDir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const restored = restorePublicPkg(pkg);
    writeFileSync(pkgPath, JSON.stringify(restored, null, 2) + "\n", "utf8");
  }
  console.log("[install-packed] Restored clean public dependency specs (^0.1.0) across example manifests.");
  process.exit(0);
}

if (!existsSync(MANIFEST_PATH)) {
  console.error("[install-packed] .packed/manifest.json not found. Run `npm run pack:framework` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const { agboss, agbossCli } = manifest.packages;

const records = [];

for (const relDir of TARGET_DIRS) {
  if (filterProject && relDir !== filterProject) continue;
  const projectDir = join(ROOT, relDir);
  const pkgPath = join(projectDir, "package.json");
  if (!existsSync(pkgPath)) continue;

  const originalPkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const publicPkg = restorePublicPkg(originalPkg, agboss.version, agbossCli.version);
  const packedPkg = structuredClone(publicPkg);

  const relAgboss = `file:${relative(projectDir, agboss.tarballPath)}`;
  const relCli = `file:${relative(projectDir, agbossCli.tarballPath)}`;

  if (packedPkg.dependencies?.["agboss"] !== undefined) {
    packedPkg.dependencies["agboss"] = relAgboss;
  }
  if (packedPkg.devDependencies?.["agboss-cli"] !== undefined) {
    packedPkg.devDependencies["agboss-cli"] = relCli;
  }
  packedPkg.overrides = {
    ...(packedPkg.overrides ?? {}),
    agboss: relAgboss,
    "agboss-cli": relCli,
  };

  try {
    writeFileSync(pkgPath, JSON.stringify(packedPkg, null, 2) + "\n", "utf8");
    console.log(`[install-packed] Installing packed RC dependencies in ${relDir}...`);
    rmSync(join(projectDir, "package-lock.json"), { force: true });
    rmSync(join(projectDir, "node_modules", "agboss"), { recursive: true, force: true });
    rmSync(join(projectDir, "node_modules", "agboss-cli"), { recursive: true, force: true });
    rmSync(join(projectDir, "node_modules", "@opentelemetry"), { recursive: true, force: true });
    rmSync(join(projectDir, "node_modules", "@langfuse"), { recursive: true, force: true });
    execFileSync("npm", ["install", "--no-package-lock", "--no-audit", "--no-fund"], {
      cwd: projectDir,
      stdio: "inherit",
    });
  } finally {
    if (!keepPackedSpecs) {
      writeFileSync(pkgPath, JSON.stringify(publicPkg, null, 2) + "\n", "utf8");
    }
  }

  records.push({
    project: relDir,
    agbossTarball: relAgboss,
    agbossCliTarball: relCli,
    publicSpecRestored: !keepPackedSpecs,
    installedAt: new Date().toISOString(),
  });
}

writeFileSync(
  join(ROOT, ".packed", "install-record.json"),
  JSON.stringify({ sourceCommit: manifest.sourceCommit, records }, null, 2) + "\n",
  "utf8",
);
console.log(`[install-packed] Completed installation across ${records.length} project(s).`);

#!/usr/bin/env node
/**
 * Section 4.1 & 4.3 (EX-02): Release-Candidate vs Public Consumer Workflow.
 * Temporarily substitutes packed `agboss` and `agboss-cli` tarballs during `npm install`
 * so `node_modules` resolves the release candidate, then restores each `package.json`
 * to clean public registry specifications (`^<pinned version>`) so local tarball paths are never
 * committed to git. Also supports `--restore` to clean manifests without installing.
 * Records the tarball substitution in `.packed/install-record.json`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rangeInstallArguments } from "./npm-before.mjs";
import { resolvePortablePackedTarballPath } from "./run-all.mjs";
import { STORE_PACKAGES } from "./store-packages.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The pinned core's version (`.agboss-version.json`): the public range each manifest is restored to. */
const PINNED_VERSION = JSON.parse(readFileSync(join(ROOT, ".agboss-version.json"), "utf8")).version;
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
  "08-job-scout",
  "09-review-loop-and-routing",
  "10-quorum-groups-and-replies",
  "11-safe-payments",
  "12-payment-gateways",
  "13-rag-reranking",
  "14-kubernetes-postgres-scaling",
  "15-mongo-redis",
];

function restorePublicPkg(pkg, frameworkVersion = PINNED_VERSION, cliVersion = PINNED_VERSION) {
  const copy = structuredClone(pkg);
  if (copy.dependencies?.["@agboss/core"] !== undefined) {
    copy.dependencies["@agboss/core"] = `^${frameworkVersion}`;
  }
  if (copy.devDependencies?.["@agboss/cli"] !== undefined) {
    copy.devDependencies["@agboss/cli"] = `^${cliVersion}`;
  }
  if (copy.overrides && typeof copy.overrides === "object") {
    delete copy.overrides["@agboss/core"];
    delete copy.overrides["@agboss/cli"];
    delete copy.overrides["agboss"];
    delete copy.overrides["agboss-cli"];
    for (const store of STORE_PACKAGES) delete copy.overrides[store.name];
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
  console.log(`[install-packed] Restored clean public dependency specs (^${PINNED_VERSION}) across example manifests.`);
  process.exit(0);
}

if (!existsSync(MANIFEST_PATH)) {
  console.error("[install-packed] .packed/manifest.json not found. Run `npm run pack:framework` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const { agboss, agbossCli } = manifest.packages;
const agbossTarballPath = resolvePortablePackedTarballPath(ROOT, agboss.filename, "@agboss/core");
const cliTarballPath = resolvePortablePackedTarballPath(ROOT, agbossCli.filename, "@agboss/cli");

const records = [];

for (const relDir of TARGET_DIRS) {
  if (filterProject && relDir !== filterProject) continue;
  const projectDir = join(ROOT, relDir);
  const pkgPath = join(projectDir, "package.json");
  if (!existsSync(pkgPath)) continue;

  const originalPkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const publicPkg = restorePublicPkg(originalPkg, agboss.version, agbossCli.version);
  const packedPkg = structuredClone(publicPkg);

  const relAgboss = `file:${relative(projectDir, agbossTarballPath)}`;
  const relCli = `file:${relative(projectDir, cliTarballPath)}`;

  if (packedPkg.dependencies?.["@agboss/core"] !== undefined) {
    packedPkg.dependencies["@agboss/core"] = relAgboss;
  }
  if (packedPkg.devDependencies?.["@agboss/cli"] !== undefined) {
    packedPkg.devDependencies["@agboss/cli"] = relCli;
  }
  packedPkg.overrides = {
    ...(packedPkg.overrides ?? {}),
    "@agboss/core": relAgboss,
    "@agboss/cli": relCli,
  };
  // the store packages (agbossjs/agboss#487, #891), packed until they are on npm: the project's
  // own range stays in git (the published one), the tarball is installed in its place
  for (const store of STORE_PACKAGES) {
    if (packedPkg.dependencies?.[store.name] === undefined) continue;
    const packed = manifest.packages[store.key];
    if (packed === undefined) {
      throw new Error(
        `[install-packed] ${relDir} needs ${store.name}: pin it in .agboss-version.json (${store.key}.sha) and run npm run pack:framework`,
      );
    }
    const relStore = `file:${relative(projectDir, resolvePortablePackedTarballPath(ROOT, packed.filename, store.name))}`;
    packedPkg.dependencies[store.name] = relStore;
    packedPkg.overrides[store.name] = relStore;
  }

  try {
    writeFileSync(pkgPath, JSON.stringify(packedPkg, null, 2) + "\n", "utf8");
    console.log(`[install-packed] Installing packed RC dependencies in ${relDir}...`);
    rmSync(join(projectDir, "package-lock.json"), { force: true });
    rmSync(join(projectDir, "node_modules", "@agboss"), { recursive: true, force: true });
    rmSync(join(projectDir, "node_modules", "agboss"), { recursive: true, force: true });
    rmSync(join(projectDir, "node_modules", "agboss-cli"), { recursive: true, force: true });
    rmSync(join(projectDir, "node_modules", "@opentelemetry"), { recursive: true, force: true });
    rmSync(join(projectDir, "node_modules", "@langfuse"), { recursive: true, force: true });
    execFileSync("npm", rangeInstallArguments(["--no-package-lock", "--no-audit", "--no-fund"]), {
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

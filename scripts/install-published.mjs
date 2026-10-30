#!/usr/bin/env node
/**
 * P0-1 (Problem A) & P0-3: Post-Publication Example Installation & Provenance Recorder.
 *
 * Installs exact versions of `agboss` and `agboss-cli` across all 8 standalone example projects
 * (`01-hello-agboss` .. `08-job-scout`), verifies that every installed package resolves
 * from the expected source (with zero local tarballs, symlinks, or workspace links in `--live-registry`
 * mode), restores clean `^0.1.0` specs in `package.json`, and writes `.packed/published-manifest.json`.
 *
 * Usage:
 *   npm run install:published -- --live-registry --version 0.1.0
 *   npm run install:published -- --restore
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  fetchLiveRegistryMetadata,
  parseVerifyPublishedArgs,
  validateInstalledPackageResolution,
  validateRegistryMetadata,
} from "./verify-published.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.env.npm_config_cache = join(ROOT, ".packed", ".npm-cache");

export const TARGET_DIRS = [
  "01-hello-agboss",
  "02-path-scope-proof",
  "03-support-refund-desk",
  "04-travel-booking-saga",
  "05-cluster-work-stealing",
  "06-enterprise-agent-mesh",
  "07-langgraph-migration",
  "08-job-scout",
];

function restorePublicPkg(pkg, frameworkVersion = "0.1.0", cliVersion = "0.1.0") {
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
    delete copy.overrides.agboss;
    delete copy.overrides["agboss-cli"];
    if (Object.keys(copy.overrides).length === 0) {
      delete copy.overrides;
    }
  }
  return copy;
}

function getExamplesCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function runMain() {
  const args = process.argv.slice(2);
  if (args.includes("--restore")) {
    for (const relDir of TARGET_DIRS) {
      const pkgPath = join(ROOT, relDir, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      writeFileSync(pkgPath, JSON.stringify(restorePublicPkg(pkg), null, 2) + "\n", "utf8");
    }
    console.log(
      "[install-published] Restored clean public dependency specs (^0.1.0) across all 8 example manifests.",
    );
    return;
  }

  let parsed;
  try {
    parsed = parseVerifyPublishedArgs(args);
  } catch (err) {
    console.error(`[install-published] ARGUMENT ERROR: ${err.message}`);
    process.exit(1);
  }

  const { mode, sourceLabel, version, tag } = parsed;
  console.log(`SOURCE: ${sourceLabel}`);
  console.log(
    `[install-published] Mode: --${mode}, target version: ${version}, dist-tag: ${tag}`,
  );

  let expectedIntegrity = { agboss: null, agbossCli: null };
  let packagesSummary = null;
  let packedManifest = null;

  if (mode === "live-registry") {
    let rawMeta;
    try {
      rawMeta = fetchLiveRegistryMetadata(version);
    } catch (err) {
      console.error(
        `[install-published] FAILED to query public npm registry for agboss@${version} / agboss-cli@${version}: ${err.message}`,
      );
      process.exit(1);
    }
    const canonicalManifestPath = join(ROOT, ".packed", "manifest.json");
    const canonicalManifest = existsSync(canonicalManifestPath)
      ? JSON.parse(readFileSync(canonicalManifestPath, "utf8"))
      : undefined;
    const validation = validateRegistryMetadata({
      ...rawMeta,
      canonicalManifest,
      expectedVersion: version,
      expectedTag: tag,
      requireMeasuredTarballs: true,
    });
    if (!validation.valid) {
      console.error(
        `[install-published] REGISTRY VALIDATION FAILED:\n  - ${validation.reasons.join("\n  - ")}`,
      );
      process.exit(1);
    }
    expectedIntegrity = {
      agboss: validation.summary.agboss.integrity,
      agbossCli: validation.summary.agbossCli.integrity,
    };
    packagesSummary = {
      agboss: validation.summary.agboss,
      agbossCli: validation.summary.agbossCli,
    };
  } else {
    const manifestPath = join(ROOT, ".packed", "manifest.json");
    if (!existsSync(manifestPath)) {
      console.error(
        "[install-published] Missing .packed/manifest.json for --from-packed mode. Run `npm run pack:framework` first.",
      );
      process.exit(1);
    }
    packedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const { agboss, agbossCli } = packedManifest.packages ?? {};
    if (!agboss || !agbossCli || agboss.version !== version || agbossCli.version !== version) {
      console.error(
        `[install-published] Packed tarball versions (${agboss?.version}, ${agbossCli?.version}) do not match --version ${version}`,
      );
      process.exit(1);
    }
    expectedIntegrity = {
      agboss: agboss.integrity,
      agbossCli: agbossCli.integrity,
    };
    const resolvePackedPath = (pkg) => {
      if (pkg?.tarballPath && existsSync(pkg.tarballPath)) return pkg.tarballPath;
      const fname = pkg?.filename || (pkg?.tarballPath ? basename(pkg.tarballPath) : null);
      if (fname) {
        const candidate = join(ROOT, ".packed", basename(fname));
        if (existsSync(candidate)) return candidate;
      }
      return pkg?.tarballPath;
    };
    const agbossTarballPath = resolvePackedPath(agboss);
    const cliTarballPath = resolvePackedPath(agbossCli);
    packagesSummary = {
      agboss: {
        name: agboss.name,
        version: agboss.version,
        integrity: agboss.integrity,
        sha256: agboss.sha256,
        shasum: agboss.shasum,
        tarball: `file:${agbossTarballPath}`,
      },
      agbossCli: {
        name: agbossCli.name,
        version: agbossCli.version,
        integrity: agbossCli.integrity,
        sha256: agbossCli.sha256,
        shasum: agbossCli.shasum,
        tarball: `file:${cliTarballPath}`,
      },
    };
  }

  const projectRecords = {};

  for (const relDir of TARGET_DIRS) {
    const projectDir = join(ROOT, relDir);
    const pkgPath = join(projectDir, "package.json");
    if (!existsSync(pkgPath)) {
      console.error(`[install-published] Missing required example project at ${pkgPath}`);
      process.exit(1);
    }

    const originalPkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const publicPkg = restorePublicPkg(originalPkg, version, version);
    const installPkg = structuredClone(publicPkg);

    if (mode === "live-registry") {
      installPkg.dependencies["@agboss/core"] = version;
      installPkg.devDependencies["@agboss/cli"] = version;
    } else {
      const relAgboss = `file:${relative(projectDir, packagesSummary.agboss.tarball.replace(/^file:/, ""))}`;
      const relCli = `file:${relative(projectDir, packagesSummary.agbossCli.tarball.replace(/^file:/, ""))}`;
      installPkg.dependencies["@agboss/core"] = relAgboss;
      installPkg.devDependencies["@agboss/cli"] = relCli;
      installPkg.overrides = {
        ...(installPkg.overrides ?? {}),
        "@agboss/core": relAgboss,
        "@agboss/cli": relCli,
      };
    }

    try {
      writeFileSync(pkgPath, JSON.stringify(installPkg, null, 2) + "\n", "utf8");
      console.log(
        `[install-published] Installing ${mode === "live-registry" ? "public npm registry" : "packed"} packages (${version}) in ${relDir}...`,
      );
      rmSync(join(projectDir, "package-lock.json"), { force: true });
      rmSync(join(projectDir, "node_modules", "@agboss"), { recursive: true, force: true });
      rmSync(join(projectDir, "node_modules", "agboss"), { recursive: true, force: true });
      rmSync(join(projectDir, "node_modules", "agboss-cli"), { recursive: true, force: true });

      execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
        cwd: projectDir,
        stdio: "inherit",
      });

      const resCheck = validateInstalledPackageResolution({
        projectDir,
        expectedVersion: version,
        mode,
        expectedIntegrity,
      });

      if (!resCheck.valid) {
        throw new Error(
          `Resolution validation failed in ${relDir}: ${resCheck.reasons.join("; ")}`,
        );
      }

      projectRecords[relDir] = {
        project: relDir,
        installedAt: new Date().toISOString(),
        agbossVersion: resCheck.details.agboss.version,
        agbossCliVersion: resCheck.details.agbossCli.version,
        agbossIntegrity: resCheck.details.agboss.integrity,
        agbossCliIntegrity: resCheck.details.agbossCli.integrity,
        agbossResolved: resCheck.details.agboss.resolved,
        agbossCliResolved: resCheck.details.agbossCli.resolved,
        isRegistryInstall:
          mode === "live-registry" &&
          !resCheck.details.agboss.isLocalTarball &&
          !resCheck.details.agbossCli.isLocalTarball,
        hasLocalLinks:
          resCheck.details.agboss.isLocalTarball ||
          resCheck.details.agbossCli.isLocalTarball ||
          resCheck.details.agboss.isSymlinkOutsideNodeModules ||
          resCheck.details.agbossCli.isSymlinkOutsideNodeModules,
      };
    } finally {
      rmSync(join(projectDir, "package-lock.json"), { force: true });
      writeFileSync(pkgPath, JSON.stringify(publicPkg, null, 2) + "\n", "utf8");
    }
  }

  const outDir = join(ROOT, ".packed");
  mkdirSync(outDir, { recursive: true });
  const publishedManifest = {
    schemaVersion: "2.0",
    provenanceType:
      mode === "live-registry" ? "PUBLIC_NPM_REGISTRY" : "LOCAL_PACKED_RELEASE_CANDIDATE",
    source: sourceLabel,
    installedAt: new Date().toISOString(),
    examplesSourceCommit: getExamplesCommit(),
    requestedVersion: version,
    requestedDistTag: tag,
    packages: packagesSummary,
    projects: projectRecords,
  };

  writeFileSync(
    join(outDir, "published-manifest.json"),
    JSON.stringify(publishedManifest, null, 2) + "\n",
    "utf8",
  );
  console.log(
    `[install-published] Installed and verified ${Object.keys(projectRecords).length} example projects (wrote .packed/published-manifest.json, SOURCE: ${sourceLabel}).`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  runMain();
}

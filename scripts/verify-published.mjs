#!/usr/bin/env node
/**
 * P0-2 & Section 4.4 (EX-15): Real Registry & Pre-Release Published-Package Verification.
 *
 * Requires an explicit mode flag:
 *   --from-packed    Pre-release verification using locally packed tarballs (.packed/*.tgz)
 *   --live-registry  Post-publication verification using the public npm registry (https://registry.npmjs.org)
 * and an explicit version flag:
 *   --version <semver>
 *
 * Never silently falls back from --live-registry to local tarballs.
 * Writes `.packed/published-verification.json` with explicit PASSED / FAILED / NOT_RUN / BLOCKED statuses.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.env.npm_config_cache = join(ROOT, ".packed", ".npm-cache");

export const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
export const SHA1_HEX_RE = /^[0-9a-f]{40}$/;
export const SHA512_SRI_RE = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
export const MAX_REGISTRY_TARBALL_BYTES = 25 * 1024 * 1024;
export const REGISTRY_TARBALL_TIMEOUT_MS = 30_000;

const MEASURED_TARBALL_CACHE = new Map();

export function computeTarballDigests(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Cannot compute tarball digests from empty or non-Buffer input");
  }
  return {
    sha256: createHash("sha256").update(buffer).digest("hex"),
    shasum: createHash("sha1").update(buffer).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(buffer).digest("base64")}`,
    size: buffer.length,
  };
}

export function validateOfficialRegistryTarballUrl(
  tarballUrl,
  packageName,
  expectedVersion,
) {
  if (
    typeof tarballUrl !== "string" ||
    !tarballUrl.startsWith("https://registry.npmjs.org/") ||
    tarballUrl.startsWith("file:") ||
    tarballUrl.includes("..") ||
    tarballUrl.includes(".packed") ||
    !tarballUrl.endsWith(".tgz")
  ) {
    return false;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(tarballUrl);
  } catch {
    return false;
  }
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "registry.npmjs.org" ||
    parsedUrl.port !== "" ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.search !== "" ||
    parsedUrl.hash !== ""
  ) {
    return false;
  }
  if (packageName && expectedVersion) {
    const unscopedName = packageName.replace(/^@[^/]+\//, "");
    const expectedUrl = `https://registry.npmjs.org/${packageName}/-/${unscopedName}-${expectedVersion}.tgz`;
    return tarballUrl === expectedUrl;
  }
  return true;
}

export function measureRegistryTarball(
  tarballUrl,
  {
    packageName,
    expectedVersion,
    timeoutMs = REGISTRY_TARBALL_TIMEOUT_MS,
    maxBytes = MAX_REGISTRY_TARBALL_BYTES,
  } = {},
) {
  if (!validateOfficialRegistryTarballUrl(tarballUrl, packageName, expectedVersion)) {
    throw new Error(
      `Invalid or untrusted registry tarball URL '${String(tarballUrl)}' for ${packageName ?? "package"}@${expectedVersion ?? "*"}`,
    );
  }
  const cached = MEASURED_TARBALL_CACHE.get(tarballUrl);
  if (cached) {
    return { ...cached };
  }

  const downloadScript = `
    import crypto from "node:crypto";
    const url = process.argv[1];
    const timeoutMs = Number(process.argv[2]);
    const maxBytes = Number(process.argv[3]);
    const res = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok || !res.body) {
      throw new Error(\`HTTP \${res.status} fetching \${url}\`);
    }
    const chunks = [];
    let total = 0;
    for await (const chunk of res.body) {
      const buf = Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        throw new Error(\`Registry tarball exceeded maxBytes limit (\${maxBytes}) for \${url}\`);
      }
      chunks.push(buf);
    }
    if (total === 0) {
      throw new Error(\`Empty registry tarball response for \${url}\`);
    }
    const full = Buffer.concat(chunks, total);
    const out = {
      sha256: crypto.createHash("sha256").update(full).digest("hex"),
      shasum: crypto.createHash("sha1").update(full).digest("hex"),
      integrity: "sha512-" + crypto.createHash("sha512").update(full).digest("base64"),
      size: total,
    };
    process.stdout.write(JSON.stringify(out));
  `;

  const rawOut = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      downloadScript,
      tarballUrl,
      String(timeoutMs),
      String(maxBytes),
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const parsed = JSON.parse(rawOut);
  if (
    !SHA256_HEX_RE.test(parsed.sha256) ||
    !SHA1_HEX_RE.test(parsed.shasum) ||
    !SHA512_SRI_RE.test(parsed.integrity)
  ) {
    throw new Error(`Invalid measured digest format returned for ${tarballUrl}`);
  }
  MEASURED_TARBALL_CACHE.set(tarballUrl, parsed);
  return { ...parsed };
}

export const REQUIRED_SUBPATH_EXPORTS = [
  "@agboss/core",
  "@agboss/core/dto",
  "@agboss/core/units",
  "@agboss/core/models",
  "@agboss/core/testing",
  "@agboss/core/testing/setup",
  "@agboss/core/eval",
  "@agboss/core/mcp",
  "@agboss/core/rag",
  "@agboss/core/a2a",
  "@agboss/core/eslint",
];

export const REQUIRED_SKILL_REFERENCES = [
  "01-composition-and-architecture.md",
  "02-flow-dsl-all-combinations.md",
  "03-components-di-and-lifecycle.md",
  "04-mcp-and-a2a.md",
  "05-channels-and-human-in-the-loop.md",
  "06-finops-providers-and-queues.md",
  "07-guardrails-pii-and-security.md",
  "08-observability-and-tracing.md",
  "09-persistence-k8s-and-deploy.md",
  "10-testing-vcr-and-evals.md",
  "11-cli-studio-and-error-catalog.md",
  "12-end-to-end-recipes.md",
  "13-migrating-from-langgraph.md",
];

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function parseVerifyPublishedArgs(args) {
  let hasFromPacked = false;
  let hasLiveRegistry = false;
  let version;
  let tag = "latest";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--from-packed") {
      hasFromPacked = true;
    } else if (arg === "--live-registry") {
      hasLiveRegistry = true;
    } else if (arg === "--version") {
      version = args[i + 1];
      i += 1;
    } else if (arg === "--tag") {
      tag = args[i + 1];
      i += 1;
    } else {
      throw new Error(
        `Unknown or ambiguous argument '${arg}'. Usage: node scripts/verify-published.mjs (--from-packed | --live-registry) --version <semver> [--tag <dist-tag>]`,
      );
    }
  }

  if (hasFromPacked && hasLiveRegistry) {
    throw new Error(
      "Conflicting mode flags: cannot specify both --from-packed and --live-registry.",
    );
  }
  if (!hasFromPacked && !hasLiveRegistry) {
    throw new Error(
      "Missing required mode flag: must explicitly pass either --from-packed or --live-registry.",
    );
  }
  if (!version || !SEMVER_RE.test(version)) {
    throw new Error(
      `Missing or invalid --version '${version ?? ""}'. Expected explicit semver (e.g. --version 0.1.0).`,
    );
  }
  if (!tag || typeof tag !== "string" || tag.startsWith("-")) {
    throw new Error(`Invalid --tag '${tag ?? ""}'.`);
  }

  return {
    mode: hasLiveRegistry ? "live-registry" : "from-packed",
    sourceLabel: hasLiveRegistry ? "PUBLIC_NPM_REGISTRY" : "LOCAL_PACKED_RELEASE_CANDIDATE",
    version,
    tag,
  };
}

export function validateRegistryMetadata({
  agbossMeta,
  agbossCliMeta,
  agbossDistTags,
  agbossCliDistTags,
  measuredTarballs,
  canonicalManifest,
  expectedVersion,
  expectedTag = "latest",
  requireMeasuredTarballs = false,
}) {
  const reasons = [];

  if (!agbossMeta || typeof agbossMeta !== "object" || agbossMeta.name !== "@agboss/core") {
    reasons.push("Registry metadata for '@agboss/core' is missing or invalid");
  } else {
    if (agbossMeta.version !== expectedVersion) {
      reasons.push(
        `Registry @agboss/core version '${agbossMeta.version ?? "none"}' does not match requested '${expectedVersion}'`,
      );
    }
    if (agbossMeta.deprecated) {
      reasons.push(
        `Registry @agboss/core@${expectedVersion} is marked deprecated: ${agbossMeta.deprecated}`,
      );
    }
    if (!agbossMeta.dist?.integrity || !SHA512_SRI_RE.test(String(agbossMeta.dist.integrity))) {
      reasons.push(
        `Registry @agboss/core@${expectedVersion} is missing or has invalid SHA-512 dist.integrity '${agbossMeta.dist?.integrity ?? "none"}'`,
      );
    }
    if (!agbossMeta.dist?.shasum || !SHA1_HEX_RE.test(String(agbossMeta.dist.shasum))) {
      reasons.push(
        `Registry @agboss/core@${expectedVersion} is missing or has invalid 40-char SHA-1 dist.shasum '${agbossMeta.dist?.shasum ?? "none"}'`,
      );
    }
    if (
      !validateOfficialRegistryTarballUrl(
        agbossMeta.dist?.tarball,
        "@agboss/core",
        expectedVersion,
      )
    ) {
      reasons.push(
        `Registry @agboss/core@${expectedVersion} has non-registry dist.tarball '${agbossMeta.dist?.tarball ?? "none"}'`,
      );
    }
  }

  if (!agbossCliMeta || typeof agbossCliMeta !== "object" || agbossCliMeta.name !== "@agboss/cli") {
    reasons.push("Registry metadata for '@agboss/cli' is missing or invalid");
  } else {
    if (agbossCliMeta.version !== expectedVersion) {
      reasons.push(
        `Registry @agboss/cli version '${agbossCliMeta.version ?? "none"}' does not match requested '${expectedVersion}'`,
      );
    }
    if (agbossCliMeta.deprecated) {
      reasons.push(
        `Registry @agboss/cli@${expectedVersion} is marked deprecated: ${agbossCliMeta.deprecated}`,
      );
    }
    if (
      agbossCliMeta.dependencies &&
      agbossCliMeta.dependencies["@agboss/core"] !== expectedVersion
    ) {
      reasons.push(
        `Registry @agboss/cli@${expectedVersion} dependency on '@agboss/core' is '${agbossCliMeta.dependencies["@agboss/core"] ?? "none"}' (expected '${expectedVersion}')`,
      );
    }
    if (agbossCliMeta.dependencies?.agboss) {
      reasons.push(
        `Registry @agboss/cli@${expectedVersion} still depends on unscoped 'agboss'`,
      );
    }
    if (
      !agbossCliMeta.dist?.integrity ||
      !SHA512_SRI_RE.test(String(agbossCliMeta.dist.integrity))
    ) {
      reasons.push(
        `Registry @agboss/cli@${expectedVersion} is missing or has invalid SHA-512 dist.integrity '${agbossCliMeta.dist?.integrity ?? "none"}'`,
      );
    }
    if (!agbossCliMeta.dist?.shasum || !SHA1_HEX_RE.test(String(agbossCliMeta.dist.shasum))) {
      reasons.push(
        `Registry @agboss/cli@${expectedVersion} is missing or has invalid 40-char SHA-1 dist.shasum '${agbossCliMeta.dist?.shasum ?? "none"}'`,
      );
    }
    if (
      !validateOfficialRegistryTarballUrl(
        agbossCliMeta.dist?.tarball,
        "@agboss/cli",
        expectedVersion,
      )
    ) {
      reasons.push(
        `Registry @agboss/cli@${expectedVersion} has non-registry dist.tarball '${agbossCliMeta.dist?.tarball ?? "none"}'`,
      );
    }
  }

  if (!agbossDistTags || agbossDistTags[expectedTag] !== expectedVersion) {
    reasons.push(
      `@agboss/core dist-tag '${expectedTag}' resolves to '${agbossDistTags?.[expectedTag] ?? "none"}' (expected '${expectedVersion}')`,
    );
  }
  if (!agbossCliDistTags || agbossCliDistTags[expectedTag] !== expectedVersion) {
    reasons.push(
      `@agboss/cli dist-tag '${expectedTag}' resolves to '${agbossCliDistTags?.[expectedTag] ?? "none"}' (expected '${expectedVersion}')`,
    );
  }

  if (requireMeasuredTarballs || measuredTarballs !== undefined) {
    const mAgboss = measuredTarballs?.agboss;
    const mCli = measuredTarballs?.agbossCli;
    if (!mAgboss || !SHA256_HEX_RE.test(String(mAgboss.sha256 ?? ""))) {
      reasons.push(
        `Missing or invalid measured 64-char SHA-256 for @agboss/core registry tarball ('${mAgboss?.sha256 ?? "none"}')`,
      );
    } else {
      if (agbossMeta?.dist?.shasum && mAgboss.shasum !== agbossMeta.dist.shasum) {
        reasons.push(
          `Measured @agboss/core tarball SHA-1 (${mAgboss.shasum}) does not match registry dist.shasum (${agbossMeta.dist.shasum})`,
        );
      }
      if (agbossMeta?.dist?.integrity && mAgboss.integrity !== agbossMeta.dist.integrity) {
        reasons.push(
          `Measured @agboss/core tarball SHA-512 (${mAgboss.integrity}) does not match registry dist.integrity (${agbossMeta.dist.integrity})`,
        );
      }
    }

    if (!mCli || !SHA256_HEX_RE.test(String(mCli.sha256 ?? ""))) {
      reasons.push(
        `Missing or invalid measured 64-char SHA-256 for @agboss/cli registry tarball ('${mCli?.sha256 ?? "none"}')`,
      );
    } else {
      if (agbossCliMeta?.dist?.shasum && mCli.shasum !== agbossCliMeta.dist.shasum) {
        reasons.push(
          `Measured @agboss/cli tarball SHA-1 (${mCli.shasum}) does not match registry dist.shasum (${agbossCliMeta.dist.shasum})`,
        );
      }
      if (agbossCliMeta?.dist?.integrity && mCli.integrity !== agbossCliMeta.dist.integrity) {
        reasons.push(
          `Measured @agboss/cli tarball SHA-512 (${mCli.integrity}) does not match registry dist.integrity (${agbossCliMeta.dist.integrity})`,
        );
      }
    }
  }

  if (
    canonicalManifest &&
    typeof canonicalManifest === "object" &&
    canonicalManifest.packages?.agboss?.version === expectedVersion &&
    canonicalManifest.packages?.agbossCli?.version === expectedVersion
  ) {
    const cAgboss = canonicalManifest.packages.agboss;
    const cCli = canonicalManifest.packages.agbossCli;
    if (cAgboss.integrity && agbossMeta?.dist?.integrity !== cAgboss.integrity) {
      reasons.push(
        `Registry @agboss/core dist.integrity (${agbossMeta?.dist?.integrity ?? "none"}) does not match canonical CI manifest (${cAgboss.integrity})`,
      );
    }
    if (cAgboss.shasum && agbossMeta?.dist?.shasum !== cAgboss.shasum) {
      reasons.push(
        `Registry @agboss/core dist.shasum (${agbossMeta?.dist?.shasum ?? "none"}) does not match canonical CI manifest (${cAgboss.shasum})`,
      );
    }
    if (
      measuredTarballs?.agboss?.sha256 &&
      cAgboss.sha256 &&
      measuredTarballs.agboss.sha256 !== cAgboss.sha256
    ) {
      reasons.push(
        `Measured registry @agboss/core SHA-256 (${measuredTarballs.agboss.sha256}) does not match canonical CI manifest (${cAgboss.sha256})`,
      );
    }
    if (cCli.integrity && agbossCliMeta?.dist?.integrity !== cCli.integrity) {
      reasons.push(
        `Registry @agboss/cli dist.integrity (${agbossCliMeta?.dist?.integrity ?? "none"}) does not match canonical CI manifest (${cCli.integrity})`,
      );
    }
    if (cCli.shasum && agbossCliMeta?.dist?.shasum !== cCli.shasum) {
      reasons.push(
        `Registry @agboss/cli dist.shasum (${agbossCliMeta?.dist?.shasum ?? "none"}) does not match canonical CI manifest (${cCli.shasum})`,
      );
    }
    if (
      measuredTarballs?.agbossCli?.sha256 &&
      cCli.sha256 &&
      measuredTarballs.agbossCli.sha256 !== cCli.sha256
    ) {
      reasons.push(
        `Measured registry @agboss/cli SHA-256 (${measuredTarballs.agbossCli.sha256}) does not match canonical CI manifest (${cCli.sha256})`,
      );
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
    summary: {
      agboss: agbossMeta
        ? {
            name: agbossMeta.name,
            version: agbossMeta.version,
            deprecated: agbossMeta.deprecated ?? null,
            integrity: agbossMeta.dist?.integrity ?? null,
            sha256: measuredTarballs?.agboss?.sha256 ?? null,
            sha256Source: measuredTarballs?.agboss?.sha256
              ? "MEASURED_FROM_REGISTRY_TARBALL"
              : null,
            shasum: agbossMeta.dist?.shasum ?? null,
            tarball: agbossMeta.dist?.tarball ?? null,
            distTagVersion: agbossDistTags?.[expectedTag] ?? null,
          }
        : null,
      agbossCli: agbossCliMeta
        ? {
            name: agbossCliMeta.name,
            version: agbossCliMeta.version,
            deprecated: agbossCliMeta.deprecated ?? null,
            integrity: agbossCliMeta.dist?.integrity ?? null,
            sha256: measuredTarballs?.agbossCli?.sha256 ?? null,
            sha256Source: measuredTarballs?.agbossCli?.sha256
              ? "MEASURED_FROM_REGISTRY_TARBALL"
              : null,
            shasum: agbossCliMeta.dist?.shasum ?? null,
            tarball: agbossCliMeta.dist?.tarball ?? null,
            distTagVersion: agbossCliDistTags?.[expectedTag] ?? null,
          }
        : null,
    },
  };
}

export function validateInstalledPackageResolution({
  projectDir,
  expectedVersion,
  mode,
  expectedIntegrity,
}) {
  const reasons = [];
  const realProjectDir = realpathSync(projectDir);
  const nodeModulesDir = join(realProjectDir, "node_modules");
  const agbossDir = join(nodeModulesDir, "@agboss", "core");
  const cliDir = join(nodeModulesDir, "@agboss", "cli");

  if (existsSync(join(nodeModulesDir, "agboss"))) {
    reasons.push(`Unscoped node_modules/agboss must not be installed in ${projectDir}`);
  }
  if (existsSync(join(nodeModulesDir, "agboss-cli"))) {
    reasons.push(`Unscoped node_modules/agboss-cli must not be installed in ${projectDir}`);
  }

  if (!existsSync(join(agbossDir, "package.json"))) {
    reasons.push(`Missing node_modules/@agboss/core/package.json in ${projectDir}`);
  }
  if (!existsSync(join(cliDir, "package.json"))) {
    reasons.push(`Missing node_modules/@agboss/cli/package.json in ${projectDir}`);
  }
  if (reasons.length > 0) {
    return { valid: false, reasons, details: null };
  }

  const realAgbossDir = realpathSync(agbossDir);
  const realCliDir = realpathSync(cliDir);
  const agbossPkg = JSON.parse(readFileSync(join(agbossDir, "package.json"), "utf8"));
  const cliPkg = JSON.parse(readFileSync(join(cliDir, "package.json"), "utf8"));

  if (agbossPkg.name !== "@agboss/core") {
    reasons.push(`Installed core package name '${agbossPkg.name}' is not '@agboss/core'`);
  }
  if (cliPkg.name !== "@agboss/cli") {
    reasons.push(`Installed CLI package name '${cliPkg.name}' is not '@agboss/cli'`);
  }
  if (agbossPkg.version !== expectedVersion) {
    reasons.push(
      `Installed @agboss/core version '${agbossPkg.version}' does not match expected '${expectedVersion}'`,
    );
  }
  if (cliPkg.version !== expectedVersion) {
    reasons.push(
      `Installed @agboss/cli version '${cliPkg.version}' does not match expected '${expectedVersion}'`,
    );
  }

  const agbossInNodeModules = realAgbossDir.startsWith(nodeModulesDir);
  const cliInNodeModules = realCliDir.startsWith(nodeModulesDir);
  if (!agbossInNodeModules) {
    reasons.push(
      `@agboss/core resolved outside project node_modules (symlink/workspace leak): ${realAgbossDir}`,
    );
  }
  if (!cliInNodeModules) {
    reasons.push(
      `@agboss/cli resolved outside project node_modules (symlink/workspace leak): ${realCliDir}`,
    );
  }

  const lockPath = existsSync(join(projectDir, "package-lock.json"))
    ? join(projectDir, "package-lock.json")
    : existsSync(join(nodeModulesDir, ".package-lock.json"))
      ? join(nodeModulesDir, ".package-lock.json")
      : null;

  let agbossLockEntry = null;
  let cliLockEntry = null;
  if (lockPath) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    agbossLockEntry = lock.packages?.["node_modules/@agboss/core"] ?? null;
    cliLockEntry = lock.packages?.["node_modules/@agboss/cli"] ?? null;
    if (lock.packages?.["node_modules/agboss"] || lock.packages?.["node_modules/agboss-cli"]) {
      reasons.push(`Lockfile in ${projectDir} contains forbidden unscoped agboss/agboss-cli entries`);
    }
  }

  const pkgJsonPath = join(projectDir, "package.json");
  const pkgJson = existsSync(pkgJsonPath)
    ? JSON.parse(readFileSync(pkgJsonPath, "utf8"))
    : {};

  if (mode === "live-registry") {
    const depSpec = pkgJson.dependencies?.["@agboss/core"] ?? "";
    const devDepSpec = pkgJson.devDependencies?.["@agboss/cli"] ?? "";
    if (
      String(depSpec).startsWith("file:") ||
      String(depSpec).endsWith(".tgz") ||
      String(devDepSpec).startsWith("file:") ||
      String(devDepSpec).endsWith(".tgz")
    ) {
      reasons.push(
        `package.json in ${projectDir} contains local tarball/file: spec in live-registry mode (${depSpec}, ${devDepSpec})`,
      );
    }

    if (!agbossLockEntry || !cliLockEntry) {
      reasons.push(`Missing lockfile entries for @agboss/core / @agboss/cli in ${projectDir}`);
    } else {
      if (agbossLockEntry.link === true || cliLockEntry.link === true) {
        reasons.push("Lockfile indicates symlink/workspace link in live-registry mode");
      }
      const agbossResolved = String(agbossLockEntry.resolved ?? "");
      const cliResolved = String(cliLockEntry.resolved ?? "");
      if (
        !agbossResolved.startsWith("https://") ||
        agbossResolved.startsWith("file:") ||
        agbossResolved.includes(".packed")
      ) {
        reasons.push(
          `@agboss/core lockfile resolved URL is not a remote https registry tarball: '${agbossResolved}'`,
        );
      }
      if (
        !cliResolved.startsWith("https://") ||
        cliResolved.startsWith("file:") ||
        cliResolved.includes(".packed")
      ) {
        reasons.push(
          `@agboss/cli lockfile resolved URL is not a remote https registry tarball: '${cliResolved}'`,
        );
      }
      if (
        expectedIntegrity?.agboss &&
        agbossLockEntry.integrity !== expectedIntegrity.agboss
      ) {
        reasons.push(
          `@agboss/core lockfile integrity '${agbossLockEntry.integrity ?? "none"}' does not match registry integrity '${expectedIntegrity.agboss}'`,
        );
      }
      if (
        expectedIntegrity?.agbossCli &&
        cliLockEntry.integrity !== expectedIntegrity.agbossCli
      ) {
        reasons.push(
          `@agboss/cli lockfile integrity '${cliLockEntry.integrity ?? "none"}' does not match registry integrity '${expectedIntegrity.agbossCli}'`,
        );
      }
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
    details: {
      agboss: {
        version: agbossPkg.version,
        realpath: realAgbossDir,
        resolved: agbossLockEntry?.resolved ?? null,
        integrity: agbossLockEntry?.integrity ?? null,
        isSymlinkOutsideNodeModules: !agbossInNodeModules,
        isLocalTarball: String(agbossLockEntry?.resolved ?? "").startsWith("file:"),
      },
      agbossCli: {
        version: cliPkg.version,
        realpath: realCliDir,
        resolved: cliLockEntry?.resolved ?? null,
        integrity: cliLockEntry?.integrity ?? null,
        isSymlinkOutsideNodeModules: !cliInNodeModules,
        isLocalTarball: String(cliLockEntry?.resolved ?? "").startsWith("file:"),
      },
    },
  };
}

export function fetchLiveRegistryMetadata(version) {
  const fetchJson = (args) => {
    const out = execFileSync("npm", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(out);
  };

  const agbossMeta = fetchJson(["view", `@agboss/core@${version}`, "--json"]);
  const agbossCliMeta = fetchJson(["view", `@agboss/cli@${version}`, "--json"]);
  const agbossDistTags = fetchJson(["view", "@agboss/core", "dist-tags", "--json"]);
  const agbossCliDistTags = fetchJson(["view", "@agboss/cli", "dist-tags", "--json"]);

  const measuredTarballs = {
    agboss: agbossMeta?.dist?.tarball
      ? measureRegistryTarball(agbossMeta.dist.tarball, {
          packageName: "@agboss/core",
          expectedVersion: version,
        })
      : null,
    agbossCli: agbossCliMeta?.dist?.tarball
      ? measureRegistryTarball(agbossCliMeta.dist.tarball, {
          packageName: "@agboss/cli",
          expectedVersion: version,
        })
      : null,
  };

  return {
    agbossMeta,
    agbossCliMeta,
    agbossDistTags,
    agbossCliDistTags,
    measuredTarballs,
  };
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

function writeVerificationOutput(report) {
  const outDir = join(ROOT, ".packed");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "published-verification.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );
}

function runMain() {
  let parsedArgs;
  try {
    parsedArgs = parseVerifyPublishedArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[verify-published] ARGUMENT ERROR: ${err.message}`);
    process.exit(1);
  }

  const { mode, sourceLabel, version, tag } = parsedArgs;
  console.log(`SOURCE: ${sourceLabel}`);
  console.log(
    `[verify-published] Mode: --${mode}, target version: ${version}, dist-tag: ${tag}`,
  );

  const examplesSourceCommit = getExamplesCommit();
  const baseReport = {
    schemaVersion: "2.0",
    status: "NOT_RUN",
    source: sourceLabel,
    verificationMode: mode,
    registryVerified: false,
    requestedVersion: version,
    requestedDistTag: tag,
    verifiedAt: new Date().toISOString(),
    nodeVersion: process.versions.node,
    sourceCommit: null,
    examplesSourceCommit,
    npmRegistryMetadata: null,
    installedPackages: null,
    checks: {
      registryMetadata: mode === "live-registry" ? "not_run" : "not_applicable",
      isolatedConsumerInstall: "not_run",
      subpathExportsVerified: [],
      cliBinVersion: "not_run",
      cliBinHelp: "not_run",
      cliExplicitBinHelp: "not_run",
      cleanScaffoldCreate: "not_run",
      scaffoldFilesVerified: [],
      generatedTypesVerified: false,
      syncedAiSkillsCount: 0,
      scaffoldCheck: "not_run",
      scaffoldTypecheck: "not_run",
      scaffoldUnitTests: "not_run",
      scaffoldDescribe: "not_run",
    },
    reasons: [],
  };

  let agbossSpec;
  let cliSpec;
  let expectedIntegrity = { agboss: null, agbossCli: null };

  if (mode === "from-packed") {
    const manifestPath = join(ROOT, ".packed", "manifest.json");
    if (!existsSync(manifestPath)) {
      baseReport.status = "BLOCKED";
      baseReport.reasons.push(
        "Missing .packed/manifest.json required for --from-packed mode. Run `npm run pack:framework` first.",
      );
      writeVerificationOutput(baseReport);
      console.error(`[verify-published] BLOCKED: ${baseReport.reasons.join("; ")}`);
      process.exit(1);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    baseReport.sourceCommit = manifest.sourceCommit ?? null;
    const packedAgboss = manifest.packages?.agboss;
    const packedCli = manifest.packages?.agbossCli;
    const resolvePackedTarball = (pkg) => {
      if (pkg?.tarballPath && existsSync(pkg.tarballPath)) return pkg.tarballPath;
      const fname = pkg?.filename || (pkg?.tarballPath ? basename(pkg.tarballPath) : null);
      if (fname) {
        const candidate = join(ROOT, ".packed", basename(fname));
        if (existsSync(candidate)) return candidate;
      }
      return null;
    };
    const agbossTarballPath = resolvePackedTarball(packedAgboss);
    const cliTarballPath = resolvePackedTarball(packedCli);
    if (!agbossTarballPath || !cliTarballPath) {
      baseReport.status = "BLOCKED";
      baseReport.reasons.push("Packed tarball files listed in .packed/manifest.json do not exist on disk.");
      writeVerificationOutput(baseReport);
      console.error(`[verify-published] BLOCKED: ${baseReport.reasons.join("; ")}`);
      process.exit(1);
    }
    if (packedAgboss.version !== version || packedCli.version !== version) {
      baseReport.status = "FAILED";
      baseReport.reasons.push(
        `Packed tarball versions (${packedAgboss.version}, ${packedCli.version}) do not match requested --version ${version}`,
      );
      writeVerificationOutput(baseReport);
      console.error(`[verify-published] FAILED: ${baseReport.reasons.join("; ")}`);
      process.exit(1);
    }
    agbossSpec = `file:${agbossTarballPath}`;
    cliSpec = `file:${cliTarballPath}`;
    expectedIntegrity = {
      agboss: packedAgboss.integrity,
      agbossCli: packedCli.integrity,
    };
  } else {
    // --live-registry mode: NEVER fall back to packed tarballs
    try {
      const canonicalManifestPath = join(ROOT, ".packed", "manifest.json");
      const canonicalManifest = existsSync(canonicalManifestPath)
        ? JSON.parse(readFileSync(canonicalManifestPath, "utf8"))
        : undefined;
      const rawMeta = fetchLiveRegistryMetadata(version);
      const validation = validateRegistryMetadata({
        ...rawMeta,
        canonicalManifest,
        expectedVersion: version,
        expectedTag: tag,
        requireMeasuredTarballs: true,
      });
      baseReport.npmRegistryMetadata = validation.summary;
      if (!validation.valid) {
        baseReport.status = "FAILED";
        baseReport.checks.registryMetadata = "failed";
        baseReport.reasons.push(...validation.reasons);
        writeVerificationOutput(baseReport);
        console.error(
          `[verify-published] LIVE REGISTRY METADATA VALIDATION FAILED:\n  - ${validation.reasons.join("\n  - ")}`,
        );
        process.exit(1);
      }
      baseReport.checks.registryMetadata = "passed";
      expectedIntegrity = {
        agboss: validation.summary.agboss.integrity,
        agbossCli: validation.summary.agbossCli.integrity,
      };
      agbossSpec = version;
      cliSpec = version;
    } catch (err) {
      baseReport.status = "FAILED";
      baseReport.checks.registryMetadata = "failed";
      baseReport.reasons.push(
        `Failed to query live npm registry for @agboss/core@${version} / @agboss/cli@${version}: ${err.message}`,
      );
      writeVerificationOutput(baseReport);
      console.error(`[verify-published] LIVE REGISTRY QUERY FAILED: ${err.message}`);
      process.exit(1);
    }
  }

  const tempWorkspace = realpathSync(mkdtempSync(join(tmpdir(), "agboss-published-verify-")));
  const scaffoldParentDir = realpathSync(mkdtempSync(join(tmpdir(), "agboss-published-scaffold-")));

  try {
    console.log(
      `[verify-published] 1/5 Installing @agboss/core (${agbossSpec}) & @agboss/cli (${cliSpec}) in isolated consumer ${tempWorkspace}...`,
    );

    const consumerPkg = {
      name: "published-verify-consumer",
      version: "0.0.1",
      private: true,
      type: "module",
      dependencies: { "@agboss/core": agbossSpec },
      devDependencies: {
        "@agboss/cli": cliSpec,
        eslint: "^9.39.0",
        "typescript-eslint": "^8.40.0",
        vitest: "^3.2.0",
      },
      ...(mode === "from-packed"
        ? { overrides: { "@agboss/core": agbossSpec, "@agboss/cli": cliSpec } }
        : {}),
    };
    writeFileSync(
      join(tempWorkspace, "package.json"),
      JSON.stringify(consumerPkg, null, 2) + "\n",
      "utf8",
    );

    execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: tempWorkspace,
      stdio: "pipe",
    });

    const consumerResValidation = validateInstalledPackageResolution({
      projectDir: tempWorkspace,
      expectedVersion: version,
      mode,
      expectedIntegrity,
    });
    baseReport.installedPackages = {
      consumer: consumerResValidation.details,
    };
    if (!consumerResValidation.valid) {
      baseReport.checks.isolatedConsumerInstall = "failed";
      throw new Error(
        `Isolated consumer resolution check failed: ${consumerResValidation.reasons.join("; ")}`,
      );
    }
    baseReport.checks.isolatedConsumerInstall = "passed";

    console.log("[verify-published] 2/5 Verifying all public subpath exports...");
    const probeScript = `
      import { fileURLToPath } from "node:url";
      import { existsSync, realpathSync } from "node:fs";

      const expectedPrefix = realpathSync(${JSON.stringify(join(tempWorkspace, "node_modules"))});
      const subpaths = ${JSON.stringify(REQUIRED_SUBPATH_EXPORTS)};
      const vitestPeerSubpaths = new Set(["@agboss/core/testing", "@agboss/core/testing/setup"]);
      const verified = [];

      for (const spec of subpaths) {
        const resolvedPath = realpathSync(fileURLToPath(import.meta.resolve(spec)));
        if (!resolvedPath.startsWith(expectedPrefix) || !existsSync(resolvedPath)) {
          throw new Error(\`Subpath '\${spec}' resolved outside isolated node_modules: \${resolvedPath}\`);
        }
        if (!vitestPeerSubpaths.has(spec)) {
          const mod = await import(spec);
          if (!mod || typeof mod !== "object") {
            throw new Error(\`Subpath '\${spec}' did not export an object\`);
          }
        }
        verified.push(spec);
      }

      const root = await import("@agboss/core");
      const dto = await import("@agboss/core/dto");
      const units = await import("@agboss/core/units");
      const models = await import("@agboss/core/models");
      const evalMod = await import("@agboss/core/eval");
      const mcp = await import("@agboss/core/mcp");
      const rag = await import("@agboss/core/rag");
      const a2a = await import("@agboss/core/a2a");
      const eslintMod = await import("@agboss/core/eslint");

      if (typeof root.Application !== "function" || typeof root.Workflow !== "function") {
        throw new Error("Missing Application/Workflow on @agboss/core");
      }
      if (typeof dto.Text !== "function" || typeof units.usd !== "function") {
        throw new Error("Missing Text/usd on @agboss/core/dto or @agboss/core/units");
      }
      if (typeof models.ModelProvider !== "function") {
        throw new Error("Missing ModelProvider on @agboss/core/models");
      }
      if (typeof evalMod.EvalSuite !== "function") {
        throw new Error("Missing EvalSuite on @agboss/core/eval");
      }
      if (typeof mcp.McpServer !== "function" || typeof rag.Rag !== "function" || typeof a2a.A2AAgent !== "function") {
        throw new Error("Missing McpServer/Rag/A2AAgent exports");
      }
      if (typeof eslintMod.agbossPlugin !== "object") {
        throw new Error("Missing agbossPlugin on @agboss/core/eslint");
      }

      console.log(JSON.stringify({ verified }));
    `;
    writeFileSync(join(tempWorkspace, "probe-exports.mjs"), probeScript, "utf8");
    const probeOut = execFileSync("node", ["probe-exports.mjs"], {
      cwd: tempWorkspace,
      encoding: "utf8",
    }).trim();
    const probeJsonLine = probeOut.split("\n").pop();
    const parsedProbe = JSON.parse(probeJsonLine);
    baseReport.checks.subpathExportsVerified = parsedProbe.verified;

    console.log("[verify-published] 3/5 Verifying CLI binary resolution (--help, help --json, agboss-cli --help)...");
    const cliBin = join(tempWorkspace, "node_modules", ".bin", "agboss");
    const cliExplicitBin = join(tempWorkspace, "node_modules", ".bin", "agboss-cli");
    const proxyBin = join(tempWorkspace, "node_modules", "@agboss", "core", "bin", "agboss.js");

    if (
      consumerResValidation.details.agboss.version !== version ||
      consumerResValidation.details.agbossCli.version !== version
    ) {
      baseReport.checks.cliBinVersion = "failed";
      throw new Error(
        `Resolved package versions (${consumerResValidation.details.agboss.version}, ${consumerResValidation.details.agbossCli.version}) do not match '${version}'`,
      );
    }
    const helpJsonOut = execFileSync(cliBin, ["help", "--json"], {
      cwd: tempWorkspace,
      encoding: "utf8",
    }).trim();
    const parsedHelpJson = JSON.parse(helpJsonOut);
    if (parsedHelpJson.command !== "help" || !Array.isArray(parsedHelpJson.result)) {
      baseReport.checks.cliBinVersion = "failed";
      throw new Error(`'agboss help --json' did not return valid CLI command envelope`);
    }
    baseReport.checks.cliBinVersion = "passed";

    const helpOut = execFileSync(cliBin, ["--help"], {
      cwd: tempWorkspace,
      encoding: "utf8",
    });
    if (!helpOut.includes("agboss") || !helpOut.includes("create") || !helpOut.includes("check")) {
      baseReport.checks.cliBinHelp = "failed";
      throw new Error("'agboss --help' output missing expected command descriptions");
    }
    const proxyHelpOut = execFileSync(process.execPath, [proxyBin, "--help"], {
      cwd: tempWorkspace,
      encoding: "utf8",
    });
    if (!proxyHelpOut.includes("agboss") || !proxyHelpOut.includes("create")) {
      baseReport.checks.cliBinHelp = "failed";
      throw new Error("'@agboss/core/bin/agboss.js --help' delegation output missing expected command descriptions");
    }
    baseReport.checks.cliBinHelp = "passed";

    const explicitHelpOut = execFileSync(cliExplicitBin, ["--help"], {
      cwd: tempWorkspace,
      encoding: "utf8",
    });
    if (!explicitHelpOut.includes("agboss") || !explicitHelpOut.includes("create")) {
      baseReport.checks.cliExplicitBinHelp = "failed";
      throw new Error("'agboss-cli --help' output missing expected command descriptions");
    }
    baseReport.checks.cliExplicitBinHelp = "passed";

    console.log(
      "[verify-published] 4/5 Running `agboss create published-smoke-app --yes --skip-install`...",
    );
    if (mode === "live-registry") {
      execFileSync(
        "npm",
        [
          "exec",
          "--yes",
          `--package=@agboss/cli@${version}`,
          "--",
          "agboss",
          "create",
          "published-smoke-app",
          "--yes",
          "--skip-install",
        ],
        {
          cwd: scaffoldParentDir,
          stdio: "pipe",
        },
      );
    } else {
      execFileSync(cliBin, ["create", "published-smoke-app", "--yes", "--skip-install"], {
        cwd: scaffoldParentDir,
        stdio: "pipe",
      });
    }

    const appDir = join(scaffoldParentDir, "published-smoke-app");
    const expectedScaffoldFiles = [
      "package.json",
      "tsconfig.json",
      "eslint.config.js",
      "AGENTS.md",
      "CLAUDE.md",
    ];
    const verifiedScaffoldFiles = [];
    for (const relFile of expectedScaffoldFiles) {
      if (!existsSync(join(appDir, relFile))) {
        baseReport.checks.cleanScaffoldCreate = "failed";
        throw new Error(`Scaffolded project is missing required file '${relFile}'`);
      }
      verifiedScaffoldFiles.push(relFile);
    }
    baseReport.checks.scaffoldFilesVerified = verifiedScaffoldFiles;
    baseReport.checks.cleanScaffoldCreate = "passed";

    const appPkgPath = join(appDir, "package.json");
    const appPkg = JSON.parse(readFileSync(appPkgPath, "utf8"));
    if (!appPkg.dependencies?.["@agboss/core"] || !appPkg.devDependencies?.["@agboss/cli"]) {
      throw new Error(
        "Scaffolded package.json missing @agboss/core in dependencies or @agboss/cli in devDependencies",
      );
    }

    if (mode === "from-packed") {
      appPkg.dependencies["@agboss/core"] = agbossSpec;
      appPkg.devDependencies["@agboss/cli"] = cliSpec;
      if (appPkg.devDependencies["typescript-eslint"]) {
        appPkg.devDependencies["typescript-eslint"] = "^8.0.0";
      }
      appPkg.overrides = { "@agboss/core": agbossSpec, "@agboss/cli": cliSpec };
    } else {
      appPkg.dependencies["@agboss/core"] = version;
      appPkg.devDependencies["@agboss/cli"] = version;
      if (appPkg.devDependencies["typescript-eslint"]) {
        appPkg.devDependencies["typescript-eslint"] = "^8.0.0";
      }
    }
    writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2) + "\n", "utf8");

    console.log(
      "[verify-published] 5/5 Installing dependencies in scaffolded app & running check, tsc, test, describe...",
    );
    execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: appDir,
      stdio: "pipe",
    });

    const scaffoldResValidation = validateInstalledPackageResolution({
      projectDir: appDir,
      expectedVersion: version,
      mode,
      expectedIntegrity,
    });
    baseReport.installedPackages.scaffold = scaffoldResValidation.details;
    if (!scaffoldResValidation.valid) {
      throw new Error(
        `Scaffolded app package resolution failed: ${scaffoldResValidation.reasons.join("; ")}`,
      );
    }

    // 1. npx agboss check
    const checkOut = execFileSync("npx", ["agboss", "check"], {
      cwd: appDir,
      encoding: "utf8",
    });
    if (!checkOut.includes("ok:")) {
      baseReport.checks.scaffoldCheck = "failed";
      throw new Error(`'npx agboss check' did not report 'ok:': ${checkOut}`);
    }

    const generatedTypesPath = join(appDir, ".agboss", "types.d.ts");
    if (!existsSync(generatedTypesPath) || statSync(generatedTypesPath).size === 0) {
      baseReport.checks.scaffoldCheck = "failed";
      throw new Error("Missing or empty .agboss/types.d.ts after `npx agboss check`");
    }
    baseReport.checks.generatedTypesVerified = true;

    const skillMdPath = join(appDir, ".claude", "skills", "agboss", "SKILL.md");
    const skillRefsDir = join(appDir, ".claude", "skills", "agboss", "references");
    if (!existsSync(skillMdPath) || !existsSync(skillRefsDir)) {
      baseReport.checks.scaffoldCheck = "failed";
      throw new Error("Missing .claude/skills/agboss/SKILL.md or references/ directory");
    }
    const syncedRefFiles = readdirSync(skillRefsDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    for (const reqRef of REQUIRED_SKILL_REFERENCES) {
      if (!syncedRefFiles.includes(reqRef)) {
        baseReport.checks.scaffoldCheck = "failed";
        throw new Error(`Missing required AI skill reference file '${reqRef}'`);
      }
    }
    baseReport.checks.syncedAiSkillsCount = syncedRefFiles.length;
    baseReport.checks.scaffoldCheck = "passed";

    // 2. npx tsc --noEmit
    execFileSync("npx", ["tsc", "--noEmit"], {
      cwd: appDir,
      stdio: "pipe",
    });
    baseReport.checks.scaffoldTypecheck = "passed";

    // 3. npm test
    const testOut = execFileSync("npm", ["test"], {
      cwd: appDir,
      encoding: "utf8",
    });
    if (!testOut.toLowerCase().includes("passed")) {
      baseReport.checks.scaffoldUnitTests = "failed";
      throw new Error(`'npm test' output did not confirm passed tests: ${testOut}`);
    }
    baseReport.checks.scaffoldUnitTests = "passed";

    // 4. npx agboss describe --json
    const describeJson = execFileSync("npx", ["agboss", "describe", "--json"], {
      cwd: appDir,
      encoding: "utf8",
    });
    const parsedDescribe = JSON.parse(describeJson);
    const appName = parsedDescribe.result?.application?.name ?? parsedDescribe.application?.name;
    if (appName !== "published-smoke-app-application") {
      baseReport.checks.scaffoldDescribe = "failed";
      throw new Error(`Unexpected application name in describe --json: ${describeJson}`);
    }
    baseReport.checks.scaffoldDescribe = "passed";

    baseReport.status = "PASSED";
    baseReport.registryVerified = mode === "live-registry";
    writeVerificationOutput(baseReport);

    console.log(
      `[verify-published] Verified resolved versions: @agboss/core@${scaffoldResValidation.details.agboss.version}, @agboss/cli@${scaffoldResValidation.details.agbossCli.version} (SOURCE: ${sourceLabel})`,
    );
    console.log(
      `[verify-published] Clean environment verification PASSED (wrote .packed/published-verification.json).`,
    );
  } catch (err) {
    baseReport.status = "FAILED";
    baseReport.reasons.push(err.message);
    writeVerificationOutput(baseReport);
    console.error(`[verify-published] FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    rmSync(tempWorkspace, { recursive: true, force: true });
    rmSync(scaffoldParentDir, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  runMain();
}

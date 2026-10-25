#!/usr/bin/env node
/**
 * Section 4.1 (EX-02): Build and pack the `agboss` and `agboss-cli` release tarballs from the main
 * AGBoss repository (`AGBOSS_REPO_DIR` or `../agboss`), reading actual package metadata, computing
 * SHA-256 digests, and recording both framework and examples source commits.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKED_DIR = join(ROOT, ".packed");
const AGBOSS_REPO = resolve(process.env["AGBOSS_REPO_DIR"] ?? join(ROOT, "..", "agboss"));
const VERSION_PIN_PATH = join(ROOT, ".agboss-version.json");

if (!existsSync(join(AGBOSS_REPO, "package.json"))) {
  console.error(
    `[pack-framework] AGBoss source repository not found at ${AGBOSS_REPO}. Set AGBOSS_REPO_DIR.`,
  );
  process.exit(1);
}

console.log(`[pack-framework] Using AGBoss source repository: ${AGBOSS_REPO}`);

const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: AGBOSS_REPO,
  encoding: "utf8",
}).trim();

const examplesSourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: ROOT,
  encoding: "utf8",
}).trim();

if (process.env["VERIFY_PINNED_FRAMEWORK_SHA"] === "1" && existsSync(VERSION_PIN_PATH)) {
  const pinned = JSON.parse(readFileSync(VERSION_PIN_PATH, "utf8"));
  if (pinned.frameworkSha && pinned.frameworkSha !== sourceCommit) {
    console.error(
      `[pack-framework] Framework commit mismatch: expected pinned SHA ${pinned.frameworkSha} from .agboss-version.json, got ${sourceCommit}.`,
    );
    process.exit(1);
  }
}

console.log(`[pack-framework] Building release artifacts at framework commit ${sourceCommit}...`);
execFileSync("npm", ["run", "build"], {
  cwd: AGBOSS_REPO,
  stdio: "inherit",
});

mkdirSync(PACKED_DIR, { recursive: true });
for (const entry of readdirSync(PACKED_DIR)) {
  if (entry !== ".npm-cache") {
    rmSync(join(PACKED_DIR, entry), { recursive: true, force: true });
  }
}

function packPackage(pkgSubdir) {
  const pkgDir = join(AGBOSS_REPO, pkgSubdir);
  const pkgJson = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  const rawOut = execFileSync("npm", ["pack", "--json", "--pack-destination", PACKED_DIR], {
    cwd: pkgDir,
    encoding: "utf8",
  });
  const parsed = JSON.parse(rawOut);
  const info = Array.isArray(parsed)
    ? parsed[0]
    : typeof parsed?.filename === "string"
      ? parsed
      : (parsed?.[pkgJson.name] ?? Object.values(parsed ?? {})[0]);
  if (!info || typeof info.filename !== "string") {
    throw new Error(`Unexpected npm pack --json output for ${pkgSubdir}: ${rawOut}`);
  }
  const tarballPath = join(PACKED_DIR, info.filename);
  if (!existsSync(tarballPath)) {
    throw new Error(`Expected packed tarball at ${tarballPath}`);
  }
  const tarballBuffer = readFileSync(tarballPath);
  const sha256 = createHash("sha256").update(tarballBuffer).digest("hex");
  const size = statSync(tarballPath).size;

  return {
    name: pkgJson.name,
    version: pkgJson.version,
    engines: pkgJson.engines,
    filename: info.filename,
    tarballPath,
    sha256,
    shasum: info.shasum,
    integrity: info.integrity,
    size,
    entryCount: info.entryCount,
    files: Array.isArray(info.files) ? info.files.map((f) => f.path) : [],
  };
}

const agboss = packPackage("packages/agboss");
const agbossCli = packPackage("packages/agboss-cli");

const manifest = {
  createdAt: new Date().toISOString(),
  packedAt: new Date().toISOString(),
  sourceCommit,
  examplesSourceCommit,
  agbossRepo: AGBOSS_REPO,
  packages: {
    agboss,
    agbossCli,
  },
};

const manifestPath = join(PACKED_DIR, "manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(
  `[pack-framework] Packed ${agboss.name}@${agboss.version} -> ${agboss.filename} (${agboss.integrity}, sha256:${agboss.sha256})`,
);
console.log(
  `[pack-framework] Packed ${agbossCli.name}@${agbossCli.version} -> ${agbossCli.filename} (${agbossCli.integrity}, sha256:${agbossCli.sha256})`,
);
console.log(`[pack-framework] Wrote manifest to ${manifestPath}`);

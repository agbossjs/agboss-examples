#!/usr/bin/env node
/**
 * Section 4.1 (EX-02): Build and pack the `agboss` and `agboss-cli` release tarballs from the main
 * AGBoss repository (`AGBOSS_REPO_DIR` or `../agboss`), reading actual package metadata and
 * `npm pack --json` output rather than inferring filenames.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKED_DIR = join(ROOT, ".packed");
const AGBOSS_REPO = resolve(process.env["AGBOSS_REPO_DIR"] ?? join(ROOT, "..", "agboss"));

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

console.log(`[pack-framework] Building release artifacts at commit ${sourceCommit}...`);
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
  const rawOut = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", PACKED_DIR],
    { cwd: pkgDir, encoding: "utf8" },
  );
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
  return {
    name: pkgJson.name,
    version: pkgJson.version,
    engines: pkgJson.engines,
    filename: info.filename,
    tarballPath,
    shasum: info.shasum,
    integrity: info.integrity,
    entryCount: info.entryCount,
    files: Array.isArray(info.files) ? info.files.map((f) => f.path) : [],
  };
}

const agboss = packPackage("packages/agboss");
const agbossCli = packPackage("packages/agboss-cli");

const manifest = {
  createdAt: new Date().toISOString(),
  sourceCommit,
  agbossRepo: AGBOSS_REPO,
  packages: {
    agboss,
    agbossCli,
  },
};

const manifestPath = join(PACKED_DIR, "manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(`[pack-framework] Packed ${agboss.name}@${agboss.version} -> ${agboss.filename} (${agboss.integrity})`);
console.log(`[pack-framework] Packed ${agbossCli.name}@${agbossCli.version} -> ${agbossCli.filename} (${agbossCli.integrity})`);
console.log(`[pack-framework] Wrote manifest to ${manifestPath}`);

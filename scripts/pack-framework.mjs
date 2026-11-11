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
import { rangeInstallArguments } from "./npm-before.mjs";
import { storesToPack } from "./store-packages.mjs";

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
  const pkgDir = resolve(AGBOSS_REPO, pkgSubdir);
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

/**
 * The store packages packed like the core until they are on npm (agbossjs/agboss#487, #891): each
 * from its own checkout — `AGBOSS_<NAME>_DIR` (default `../<repo>`), whose HEAD must be the SHA
 * `.agboss-version.json` pins under its key — built against the core packed above, so the stores
 * are compiled and tested on the same core the examples install. A key the pin leaves out is not
 * packed; `AGBOSS_PACK_STORES` narrows it to the stores it names.
 */

function packStore(store, pin) {
  const dir = resolve(process.env[store.env] ?? join(ROOT, "..", store.repo));
  if (!existsSync(join(dir, "package.json"))) {
    throw new Error(
      `[pack-framework] agbossjs/${store.repo} not found at ${dir}: clone it there or set ${store.env}.`,
    );
  }
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  if (head !== pin.sha) {
    throw new Error(
      `[pack-framework] agbossjs/${store.repo} at ${dir} is at ${head}; .agboss-version.json pins ${pin.sha}.`,
    );
  }
  console.log(`[pack-framework] Building ${store.name} at ${head} on the packed core...`);
  const env = { ...process.env, npm_config_cache: join(PACKED_DIR, ".npm-cache") };
  const npm = (args) => execFileSync("npm", args, { cwd: dir, stdio: "inherit", env });
  // as each store's own install:packed does: the core tarball as its devDependency for the install
  // only, no lockfile written, package.json restored after
  const packagePath = join(dir, "package.json");
  const original = readFileSync(packagePath, "utf8");
  const withTarball = JSON.parse(original);
  withTarball.devDependencies = { ...withTarball.devDependencies, "@agboss/core": `file:${agboss.tarballPath}` };
  try {
    writeFileSync(packagePath, `${JSON.stringify(withTarball, null, 2)}\n`);
    npm(rangeInstallArguments(["--no-package-lock", "--no-audit", "--no-fund"]));
  } finally {
    writeFileSync(packagePath, original);
  }
  npm(["run", "build"]);
  return { ...packPackage(dir), sourceCommit: pin.sha };
}

const pin = existsSync(VERSION_PIN_PATH) ? JSON.parse(readFileSync(VERSION_PIN_PATH, "utf8")) : {};
// `AGBOSS_PACK_STORES=postgres` packs only the stores it names (a job that installs one example)
const stores = Object.fromEntries(
  storesToPack(pin, process.env["AGBOSS_PACK_STORES"]).map((store) => [store.key, packStore(store, pin[store.key])]),
);

const manifest = {
  createdAt: new Date().toISOString(),
  packedAt: new Date().toISOString(),
  sourceCommit,
  examplesSourceCommit,
  agbossRepo: AGBOSS_REPO,
  packages: {
    agboss,
    agbossCli,
    ...stores,
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
for (const store of Object.values(stores)) {
  console.log(
    `[pack-framework] Packed ${store.name}@${store.version} -> ${store.filename} (${store.integrity}, sha256:${store.sha256})`,
  );
}
console.log(`[pack-framework] Wrote manifest to ${manifestPath}`);

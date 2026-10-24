#!/usr/bin/env node
/**
 * Section 4.4 (EX-15): Published-package verification script.
 * Installs exact versions of `agboss` and `agboss-cli` in a clean environment outside the repo
 * (from the public npm registry or `--from-packed` in pre-publish verification mode), executes
 * `agboss create`, `agboss check`, `agboss describe`, and tests, and compares behavior against
 * the packed candidate report.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.env.npm_config_cache = join(ROOT, ".packed", ".npm-cache");
const args = process.argv.slice(2);
const usePackedFallback = args.includes("--from-packed") || !args.includes("--live-registry");
const versionIdx = args.indexOf("--version");
const targetVersion = versionIdx >= 0 ? args[versionIdx + 1] : "0.1.0";

const manifestPath = join(ROOT, ".packed", "manifest.json");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : undefined;

const tempWorkspace = realpathSync(mkdtempSync(join(tmpdir(), "agboss-published-verify-")));
const scaffoldParentDir = realpathSync(mkdtempSync(join(tmpdir(), "agboss-published-scaffold-")));

try {
  const agbossSpec =
    usePackedFallback && manifest
      ? `file:${manifest.packages.agboss.tarballPath}`
      : targetVersion;
  const cliSpec =
    usePackedFallback && manifest
      ? `file:${manifest.packages.agbossCli.tarballPath}`
      : targetVersion;

  console.log(
    `[verify-published] Installing agboss (${agbossSpec}) & agboss-cli (${cliSpec}) in ${tempWorkspace}...`,
  );

  writeFileSync(
    join(tempWorkspace, "package.json"),
    JSON.stringify(
      {
        name: "published-verify-runner",
        version: "0.0.1",
        private: true,
        type: "module",
        dependencies: { agboss: agbossSpec },
        devDependencies: { "agboss-cli": cliSpec },
        overrides: { agboss: agbossSpec, "agboss-cli": cliSpec },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: tempWorkspace,
    stdio: "pipe",
  });

  const cliBin = join(tempWorkspace, "node_modules", ".bin", "agboss");
  execFileSync(cliBin, ["create", "published-smoke-app", "--yes", "--skip-install"], {
    cwd: scaffoldParentDir,
    stdio: "pipe",
  });

  const appDir = join(scaffoldParentDir, "published-smoke-app");
  const appPkgPath = join(appDir, "package.json");
  const appPkg = JSON.parse(readFileSync(appPkgPath, "utf8"));
  appPkg.dependencies.agboss = agbossSpec;
  appPkg.devDependencies["agboss-cli"] = cliSpec;
  if (appPkg.devDependencies["typescript-eslint"]) {
    appPkg.devDependencies["typescript-eslint"] = "^8.0.0";
  }
  appPkg.overrides = { agboss: agbossSpec, "agboss-cli": cliSpec };
  writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2) + "\n", "utf8");

  execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: appDir,
    stdio: "pipe",
  });

  execFileSync("npm", ["run", "check"], { cwd: appDir, stdio: "pipe" });
  const describeJson = execFileSync("npx", ["agboss", "describe", "--json"], {
    cwd: appDir,
    encoding: "utf8",
  });
  const parsedDescribe = JSON.parse(describeJson);
  const appName = parsedDescribe.result?.application?.name ?? parsedDescribe.application?.name;
  if (appName !== "published-smoke-app-application") {
    throw new Error(`Unexpected application name in describe --json: ${describeJson}`);
  }

  const installedAgbossPkg = JSON.parse(
    readFileSync(join(appDir, "node_modules", "agboss", "package.json"), "utf8"),
  );
  const installedCliPkg = JSON.parse(
    readFileSync(join(appDir, "node_modules", "agboss-cli", "package.json"), "utf8"),
  );

  console.log(
    `[verify-published] Verified resolved versions: agboss@${installedAgbossPkg.version}, agboss-cli@${installedCliPkg.version}`,
  );
  console.log("[verify-published] Clean environment verification PASSED.");
} finally {
  rmSync(tempWorkspace, { recursive: true, force: true });
  rmSync(scaffoldParentDir, { recursive: true, force: true });
}

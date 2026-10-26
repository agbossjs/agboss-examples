#!/usr/bin/env node
/**
 * Section 4.2 & 4.3 (EX-02): Validate packed `agboss` and `agboss-cli` tarballs and verify
 * isolated installation, exports resolution, CLI `bin`, templates, JSON schema, and all 13 bundled
 * skills in a clean temporary directory outside both repositories.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, ".packed", "manifest.json");
process.env.npm_config_cache = join(ROOT, ".packed", ".npm-cache");

if (!existsSync(MANIFEST_PATH)) {
  console.error(
    "[verify-package] .packed/manifest.json not found. Run `npm run pack:framework` first.",
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const { agboss, agbossCli } = manifest.packages;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[verify-package] Assertion failed: ${message}`);
  }
}

console.log("[verify-package] 1/4 Checking tarball file inventories...");

// Required files in agboss tarball
const agbossFiles = new Set(agboss.files);
assert(agbossFiles.has("bin/agboss.js"), "agboss missing bin/agboss.js");
assert(agbossFiles.has("dist/index.js"), "agboss missing dist/index.js");
assert(agbossFiles.has("dist/index.d.ts"), "agboss missing dist/index.d.ts");
assert(agbossFiles.has("dist/dto/index.js"), "agboss missing dist/dto/index.js");
assert(agbossFiles.has("dist/testing/index.js"), "agboss missing dist/testing/index.js");
assert(agbossFiles.has("dist/eval/index.js"), "agboss missing dist/eval/index.js");
assert(agbossFiles.has("dist/a2a/index.js"), "agboss missing dist/a2a/index.js");
assert(agbossFiles.has("dist/mcp/index.js"), "agboss missing dist/mcp/index.js");
assert(agbossFiles.has("dist/rag/index.js"), "agboss missing dist/rag/index.js");
assert(agbossFiles.has("dist/eslint/index.js"), "agboss missing dist/eslint/index.js");
assert(agbossFiles.has("schema/profile.schema.json"), "agboss missing schema/profile.schema.json");
assert(agbossFiles.has("skills/agboss/SKILL.md"), "agboss missing skills/agboss/SKILL.md");
assert(
  agbossFiles.has("skills/agboss/references/13-migrating-from-langgraph.md"),
  "agboss missing skills/agboss/references/13-migrating-from-langgraph.md",
);
assert(agbossFiles.has("LICENSE"), "agboss missing LICENSE");
assert(agbossFiles.has("NOTICE"), "agboss missing NOTICE");

// Required files in agboss-cli tarball
const cliFiles = new Set(agbossCli.files);
assert(cliFiles.has("bin/agboss.js"), "agboss-cli missing bin/agboss.js");
assert(cliFiles.has("dist/cli.js"), "agboss-cli missing dist/cli.js");
assert(cliFiles.has("templates/project/package.json.tmpl"), "agboss-cli missing project templates");
assert(cliFiles.has("LICENSE"), "agboss-cli missing LICENSE");
assert(cliFiles.has("NOTICE"), "agboss-cli missing NOTICE");

// Node version check
const [major, minor] = process.versions.node.split(".").map(Number);
assert(
  major > 22 || (major === 22 && minor >= 13),
  `Node.js >= 22.13 required, running ${process.versions.node}`,
);

console.log("[verify-package] 2/4 Testing isolated installation outside both repositories...");
const isolatedDir = realpathSync(mkdtempSync(join(tmpdir(), "agboss-pkg-verify-")));
const scaffoldParentDir = realpathSync(mkdtempSync(join(tmpdir(), "agboss-scaffold-verify-")));

try {
  const pkgJson = {
    name: "isolated-consumer-smoke",
    version: "0.0.1",
    private: true,
    type: "module",
    dependencies: {
      "@agboss/core": `file:${agboss.tarballPath}`,
    },
    devDependencies: {
      "@agboss/cli": `file:${agbossCli.tarballPath}`,
      eslint: "^9.39.0",
      "typescript-eslint": "^8.40.0",
      vitest: "^3.2.0",
    },
    overrides: {
      "@agboss/core": `file:${agboss.tarballPath}`,
      "@agboss/cli": `file:${agbossCli.tarballPath}`,
    },
  };
  writeFileSync(join(isolatedDir, "package.json"), JSON.stringify(pkgJson, null, 2) + "\n", "utf8");

  execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: isolatedDir,
    stdio: "pipe",
  });

  assert(
    !existsSync(join(isolatedDir, "node_modules", "agboss")),
    "Unscoped node_modules/agboss must not be installed",
  );
  assert(
    !existsSync(join(isolatedDir, "node_modules", "agboss-cli")),
    "Unscoped node_modules/agboss-cli must not be installed",
  );

  // Verify clean OpenTelemetry / Langfuse / LangGraph dependency tree with zero peer conflicts
  execFileSync(
    "npm",
    [
      "ls",
      "@opentelemetry/api",
      "@opentelemetry/exporter-trace-otlp-http",
      "@langfuse/otel",
      "@langfuse/langchain",
      "@langchain/langgraph",
    ],
    {
      cwd: isolatedDir,
      stdio: "pipe",
    },
  );

  console.log(
    "[verify-package] 3/4 Verifying runtime subpath exports and zero monorepo leakage...",
  );
  const probeScript = `
    import * as root from "@agboss/core";
    import * as dto from "@agboss/core/dto";
    import * as units from "@agboss/core/units";
    import * as models from "@agboss/core/models";
    import * as mcp from "@agboss/core/mcp";
    import * as rag from "@agboss/core/rag";
    import * as a2a from "@agboss/core/a2a";
    import * as evalMod from "@agboss/core/eval";
    import * as eslintMod from "@agboss/core/eslint";
    import { fileURLToPath } from "node:url";
    import { realpathSync } from "node:fs";

    const expectedPrefix = realpathSync(${JSON.stringify(isolatedDir)});
    const resolvedRoot = realpathSync(fileURLToPath(import.meta.resolve("@agboss/core")));
    const resolvedTesting = realpathSync(fileURLToPath(import.meta.resolve("@agboss/core/testing")));
    const resolvedTestingSetup = realpathSync(fileURLToPath(import.meta.resolve("@agboss/core/testing/setup")));
    if (!resolvedRoot.startsWith(expectedPrefix) || !resolvedTesting.startsWith(expectedPrefix) || !resolvedTestingSetup.startsWith(expectedPrefix)) {
      throw new Error("@agboss/core resolved outside isolated dir: " + resolvedRoot);
    }
    if (typeof root.Application !== "function" || typeof root.Workflow !== "function") {
      throw new Error("Missing core decorators on @agboss/core root export");
    }
    if (typeof dto.Text !== "function" || typeof units.usd !== "function") {
      throw new Error("Missing dto/units exports");
    }
    if (typeof evalMod.EvalSuite !== "function") {
      throw new Error("Missing eval exports");
    }
    if (typeof a2a.A2AAgent !== "function" || typeof mcp.McpServer !== "function" || typeof rag.Rag !== "function") {
      throw new Error("Missing a2a/mcp/rag exports");
    }
    if (typeof models.ModelProvider !== "function" || typeof eslintMod.agbossPlugin !== "object") {
      throw new Error("Missing models/eslint exports");
    }
  `;
  writeFileSync(join(isolatedDir, "probe.mjs"), probeScript, "utf8");
  execFileSync("node", ["probe.mjs"], { cwd: isolatedDir, stdio: "inherit" });

  console.log(
    "[verify-package] 4/4 Verifying packed CLI bin and `agboss create` in isolated workspace...",
  );
  const cliBin = join(isolatedDir, "node_modules", ".bin", "agboss");
  const cliExplicitBin = join(isolatedDir, "node_modules", ".bin", "agboss-cli");
  const proxyBin = join(isolatedDir, "node_modules", "@agboss", "core", "bin", "agboss.js");
  const helpOut = execFileSync(cliBin, ["--help"], { cwd: isolatedDir, encoding: "utf8" });
  assert(helpOut.includes("agboss"), "CLI --help did not print agboss usage");
  const explicitHelpOut = execFileSync(cliExplicitBin, ["--help"], {
    cwd: isolatedDir,
    encoding: "utf8",
  });
  assert(explicitHelpOut.includes("agboss"), "agboss-cli --help did not print agboss usage");
  const proxyHelpOut = execFileSync(process.execPath, [proxyBin, "--help"], {
    cwd: isolatedDir,
    encoding: "utf8",
  });
  assert(
    proxyHelpOut.includes("agboss"),
    "@agboss/core/bin/agboss.js local delegation did not print agboss usage",
  );

  // Verify empty-folder npx delegation from unpacked agboss-core-*.tgz using AGBOSS_CLI_PACKAGE_SPEC
  const unpackedAgbossDir = realpathSync(mkdtempSync(join(tmpdir(), "agboss-unpacked-bin-")));
  try {
    execFileSync("tar", ["-xzf", agboss.tarballPath, "-C", unpackedAgbossDir], { stdio: "pipe" });
    execFileSync(
      process.execPath,
      [
        join(unpackedAgbossDir, "package", "bin", "agboss.js"),
        "create",
        "scaffolded-app",
        "--yes",
        "--skip-install",
      ],
      {
        cwd: scaffoldParentDir,
        env: {
          ...process.env,
          AGBOSS_CLI_PACKAGE_SPEC: agbossCli.tarballPath,
        },
        stdio: "pipe",
      },
    );
  } finally {
    rmSync(unpackedAgbossDir, { recursive: true, force: true });
  }

  const scaffoldedDir = join(scaffoldParentDir, "scaffolded-app");
  assert(existsSync(join(scaffoldedDir, "package.json")), "scaffolded-app missing package.json");
  assert(existsSync(join(scaffoldedDir, "AGENTS.md")), "scaffolded-app missing AGENTS.md");
  assert(existsSync(join(scaffoldedDir, "CLAUDE.md")), "scaffolded-app missing CLAUDE.md");

  // Substitute packed tarballs into the scaffolded project (Section 4.3)
  const genPkgPath = join(scaffoldedDir, "package.json");
  const genPkg = JSON.parse(readFileSync(genPkgPath, "utf8"));
  assert(
    genPkg.dependencies?.["@agboss/core"] !== undefined,
    "scaffolded-app package.json must declare @agboss/core in dependencies",
  );
  assert(
    genPkg.devDependencies?.["@agboss/cli"] !== undefined,
    "scaffolded-app package.json must declare @agboss/cli in devDependencies",
  );
  genPkg.dependencies["@agboss/core"] = `file:${agboss.tarballPath}`;
  genPkg.devDependencies["@agboss/cli"] = `file:${agbossCli.tarballPath}`;
  if (genPkg.devDependencies["typescript-eslint"]) {
    genPkg.devDependencies["typescript-eslint"] = "^8.0.0";
  }
  genPkg.overrides = {
    "@agboss/core": `file:${agboss.tarballPath}`,
    "@agboss/cli": `file:${agbossCli.tarballPath}`,
  };
  writeFileSync(genPkgPath, JSON.stringify(genPkg, null, 2) + "\n", "utf8");

  execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: scaffoldedDir,
    stdio: "pipe",
  });

  // Verify synced skills (all 13 reference modules)
  const skillsRefsDir = join(scaffoldedDir, ".claude", "skills", "agboss", "references");
  assert(existsSync(skillsRefsDir), "Synced skills references directory missing after install/check");
  const skillFiles = readdirSync(skillsRefsDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  assert(
    skillFiles.length >= 13,
    `Expected at least 13 skill reference modules, found ${skillFiles.length}`,
  );
  assert(
    skillFiles.includes("13-migrating-from-langgraph.md"),
    "Missing 13-migrating-from-langgraph.md in synced skills",
  );

  // Run check, tsc, test, and describe on scaffolded project
  execFileSync("npm", ["run", "check"], { cwd: scaffoldedDir, stdio: "pipe" });
  execFileSync("npx", ["tsc", "--noEmit"], { cwd: scaffoldedDir, stdio: "pipe" });
  execFileSync("npm", ["test"], { cwd: scaffoldedDir, stdio: "pipe" });
  const describeOut = execFileSync("npm", ["run", "describe"], {
    cwd: scaffoldedDir,
    encoding: "utf8",
  });
  assert(describeOut.includes("scaffolded-app-workflow"), "describe output missing workflow");

  const verificationReport = {
    status: "PASSED",
    verifiedAt: new Date().toISOString(),
    nodeVersion: process.versions.node,
    sourceCommit: manifest.sourceCommit,
    examplesSourceCommit: manifest.examplesSourceCommit ?? null,
    packages: {
      agboss: {
        name: agboss.name,
        version: agboss.version,
        filename: agboss.filename,
        sha256: agboss.sha256,
        shasum: agboss.shasum,
        integrity: agboss.integrity,
        fileCount: agboss.files.length,
      },
      agbossCli: {
        name: agbossCli.name,
        version: agbossCli.version,
        filename: agbossCli.filename,
        sha256: agbossCli.sha256,
        shasum: agbossCli.shasum,
        integrity: agbossCli.integrity,
        fileCount: agbossCli.files.length,
      },
    },
    checks: {
      tarballInventories: "passed",
      isolatedConsumerInstall: "passed",
      subpathExportsVerified: [
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
      ],
      cliBinDelegation: "passed",
      cleanScaffoldCreate: "passed",
      syncedAiSkillsCount: skillFiles.length,
      scaffoldCheck: "passed",
      scaffoldTypecheck: "passed",
      scaffoldUnitTests: "passed",
      scaffoldDescribe: "passed",
      tarballSubstitutedForPreRelease: true,
    },
  };
  writeFileSync(
    join(ROOT, ".packed", "package-verification.json"),
    JSON.stringify(verificationReport, null, 2) + "\n",
    "utf8",
  );

  console.log(
    "[verify-package] All package verification checks PASSED (wrote .packed/package-verification.json).",
  );
} finally {
  rmSync(isolatedDir, { recursive: true, force: true });
  rmSync(scaffoldParentDir, { recursive: true, force: true });
}

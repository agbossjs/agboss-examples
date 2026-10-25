#!/usr/bin/env node
/**
 * Section 4.2 & 4.3 (EX-02): Validate packed `agboss` and `agboss-cli` tarballs and verify
 * isolated installation, exports resolution, CLI `bin`, templates, and all 13 bundled skills
 * in a clean temporary directory outside both repositories.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, ".packed", "manifest.json");
process.env.npm_config_cache = join(ROOT, ".packed", ".npm-cache");

if (!existsSync(MANIFEST_PATH)) {
  console.error("[verify-package] .packed/manifest.json not found. Run `npm run pack:framework` first.");
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
assert(agbossFiles.has("dist/index.js"), "agboss missing dist/index.js");
assert(agbossFiles.has("dist/index.d.ts"), "agboss missing dist/index.d.ts");
assert(agbossFiles.has("dist/dto/index.js"), "agboss missing dist/dto/index.js");
assert(agbossFiles.has("dist/testing/index.js"), "agboss missing dist/testing/index.js");
assert(agbossFiles.has("dist/eval/index.js"), "agboss missing dist/eval/index.js");
assert(agbossFiles.has("dist/a2a/index.js"), "agboss missing dist/a2a/index.js");
assert(agbossFiles.has("dist/mcp/index.js"), "agboss missing dist/mcp/index.js");
assert(agbossFiles.has("dist/rag/index.js"), "agboss missing dist/rag/index.js");
assert(agbossFiles.has("dist/eslint/index.js"), "agboss missing dist/eslint/index.js");
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
      agboss: `file:${agboss.tarballPath}`,
    },
    devDependencies: {
      "agboss-cli": `file:${agbossCli.tarballPath}`,
      eslint: "^9.39.0",
      "typescript-eslint": "^8.40.0",
      vitest: "^3.2.0",
    },
    overrides: {
      agboss: `file:${agboss.tarballPath}`,
      "agboss-cli": `file:${agbossCli.tarballPath}`,
    },
  };
  writeFileSync(join(isolatedDir, "package.json"), JSON.stringify(pkgJson, null, 2) + "\n", "utf8");

  execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: isolatedDir,
    stdio: "pipe",
  });

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

  console.log("[verify-package] 3/4 Verifying runtime subpath exports and zero monorepo leakage...");
  const probeScript = `
    import * as root from "agboss";
    import * as dto from "agboss/dto";
    import * as units from "agboss/units";
    import * as models from "agboss/models";
    import * as mcp from "agboss/mcp";
    import * as rag from "agboss/rag";
    import * as a2a from "agboss/a2a";
    import * as evalMod from "agboss/eval";
    import * as eslintMod from "agboss/eslint";
    import { fileURLToPath } from "node:url";
    import { realpathSync } from "node:fs";

    const expectedPrefix = realpathSync(${JSON.stringify(isolatedDir)});
    const resolvedRoot = realpathSync(fileURLToPath(import.meta.resolve("agboss")));
    const resolvedTesting = realpathSync(fileURLToPath(import.meta.resolve("agboss/testing")));
    const resolvedTestingSetup = realpathSync(fileURLToPath(import.meta.resolve("agboss/testing/setup")));
    if (!resolvedRoot.startsWith(expectedPrefix) || !resolvedTesting.startsWith(expectedPrefix) || !resolvedTestingSetup.startsWith(expectedPrefix)) {
      throw new Error("agboss resolved outside isolated dir: " + resolvedRoot);
    }
    if (typeof root.Application !== "function" || typeof root.Workflow !== "function") {
      throw new Error("Missing core decorators on agboss root export");
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

  console.log("[verify-package] 4/4 Verifying packed CLI bin and `agboss create` in isolated workspace...");
  const cliBin = join(isolatedDir, "node_modules", ".bin", "agboss");
  const helpOut = execFileSync(cliBin, ["--help"], { cwd: isolatedDir, encoding: "utf8" });
  assert(helpOut.includes("agboss"), "CLI --help did not print agboss usage");

  // Scaffold a new project in a clean directory without a parent node_modules
  execFileSync(cliBin, ["create", "scaffolded-app", "--yes", "--skip-install"], {
    cwd: scaffoldParentDir,
    stdio: "pipe",
  });

  const scaffoldedDir = join(scaffoldParentDir, "scaffolded-app");
  assert(existsSync(join(scaffoldedDir, "package.json")), "scaffolded-app missing package.json");
  assert(existsSync(join(scaffoldedDir, "AGENTS.md")), "scaffolded-app missing AGENTS.md");
  assert(existsSync(join(scaffoldedDir, "CLAUDE.md")), "scaffolded-app missing CLAUDE.md");

  // Substitute packed tarballs into the scaffolded project (Section 4.3)
  const genPkgPath = join(scaffoldedDir, "package.json");
  const genPkg = JSON.parse(readFileSync(genPkgPath, "utf8"));
  genPkg.dependencies.agboss = `file:${agboss.tarballPath}`;
  genPkg.devDependencies["agboss-cli"] = `file:${agbossCli.tarballPath}`;
  if (genPkg.devDependencies["typescript-eslint"]) {
    genPkg.devDependencies["typescript-eslint"] = "^8.0.0";
  }
  genPkg.overrides = {
    agboss: `file:${agboss.tarballPath}`,
    "agboss-cli": `file:${agbossCli.tarballPath}`,
  };
  writeFileSync(genPkgPath, JSON.stringify(genPkg, null, 2) + "\n", "utf8");

  execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: scaffoldedDir,
    stdio: "pipe",
  });

  // Verify synced skills (all 13 reference modules)
  const skillsRefsDir = join(scaffoldedDir, ".claude", "skills", "agboss", "references");
  assert(existsSync(skillsRefsDir), "Synced skills references directory missing after install/check");
  const skillFiles = readdirSync(skillsRefsDir).filter((f) => f.endsWith(".md")).sort();
  assert(skillFiles.length >= 13, `Expected at least 13 skill reference modules, found ${skillFiles.length}`);
  assert(
    skillFiles.includes("13-migrating-from-langgraph.md"),
    "Missing 13-migrating-from-langgraph.md in synced skills",
  );

  // Run check and describe on scaffolded project
  execFileSync("npm", ["run", "check"], { cwd: scaffoldedDir, stdio: "pipe" });
  const describeOut = execFileSync("npm", ["run", "describe"], {
    cwd: scaffoldedDir,
    encoding: "utf8",
  });
  assert(describeOut.includes("scaffolded-app-workflow"), "describe output missing workflow");

  console.log("[verify-package] All package verification checks PASSED.");
} finally {
  rmSync(isolatedDir, { recursive: true, force: true });
  rmSync(scaffoldParentDir, { recursive: true, force: true });
}

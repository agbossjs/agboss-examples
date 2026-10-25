import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(PROJECT_ROOT, "..");

describe("Isolated `agboss create` CLI smoke test (Section 4.3 & Section 6)", () => {
  it("scaffolds a clean project outside the repo, installs packed tarballs, syncs 13 skills, and passes check, describe, and test", () => {
    const manifestPath = join(REPO_ROOT, ".packed", "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      packages: {
        agboss: { tarballPath: string };
        agbossCli: { tarballPath: string };
      };
    };

    const isolatedWorkspace = realpathSync(mkdtempSync(join(tmpdir(), "hello-agboss-create-")));
    const cliBin = join(PROJECT_ROOT, "node_modules", ".bin", "agboss");
    const npmCache = join(REPO_ROOT, ".packed", ".npm-cache");

    try {
      execFileSync(cliBin, ["create", "clean-starter", "--yes", "--skip-install"], {
        cwd: isolatedWorkspace,
        stdio: "pipe",
        env: { ...process.env, npm_config_cache: npmCache }
      });

      const appDir = join(isolatedWorkspace, "clean-starter");
      expect(existsSync(join(appDir, "package.json"))).toBe(true);
      expect(existsSync(join(appDir, "AGENTS.md"))).toBe(true);
      expect(existsSync(join(appDir, "CLAUDE.md"))).toBe(true);

      // Substitute local packed tarballs (Section 4.3)
      const pkgPath = join(appDir, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
        overrides?: Record<string, string>;
      };
      const agbossTar = `file:${manifest.packages.agboss.tarballPath}`;
      const cliTar = `file:${manifest.packages.agbossCli.tarballPath}`;
      pkg.dependencies["agboss"] = agbossTar;
      pkg.devDependencies["agboss-cli"] = cliTar;
      if (pkg.devDependencies["typescript-eslint"] === "^8.70.0") {
        pkg.devDependencies["typescript-eslint"] = "^8.0.0";
      }
      pkg.overrides = { agboss: agbossTar, "agboss-cli": cliTar };
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

      execFileSync("npm", ["install", "--no-audit", "--no-fund"], {
        cwd: appDir,
        stdio: "pipe",
        env: { ...process.env, npm_config_cache: npmCache }
      });

      // Verify all 13 agent skills synced into .claude/skills/agboss/references/
      const refsDir = join(appDir, ".claude", "skills", "agboss", "references");
      expect(existsSync(refsDir)).toBe(true);
      const refFiles = readdirSync(refsDir).filter((f) => f.endsWith(".md")).sort();
      expect(refFiles.length).toBeGreaterThanOrEqual(13);
      expect(refFiles).toContain("13-migrating-from-langgraph.md");

      // Run agboss check, agboss describe, and npm test
      execFileSync("npx", ["agboss", "check"], {
        cwd: appDir,
        stdio: "pipe",
        env: { ...process.env, npm_config_cache: npmCache }
      });

      const describeOut = execFileSync("npx", ["agboss", "describe"], {
        cwd: appDir,
        encoding: "utf8",
        env: { ...process.env, npm_config_cache: npmCache }
      });
      expect(describeOut).toContain("clean-starter-workflow");

      execFileSync("npm", ["test"], {
        cwd: appDir,
        stdio: "pipe",
        env: { ...process.env, npm_config_cache: npmCache }
      });

      // Verify short CLI aliases (`agboss c`, `agboss g a|r|t|m|rag|w`) and Group A / Group B layout
      execFileSync(cliBin, ["c", "alias-starter", "--yes", "--skip-install"], {
        cwd: isolatedWorkspace,
        stdio: "pipe",
        env: { ...process.env, npm_config_cache: npmCache }
      });
      const aliasDir = join(isolatedWorkspace, "alias-starter");
      expect(existsSync(join(aliasDir, "src", "alias-starter.application.ts"))).toBe(true);
      expect(
        existsSync(
          join(
            aliasDir,
            "src",
            "alias-starter",
            "agents",
            "alias-starter-assistant",
            "alias-starter-assistant.agent.ts"
          )
        )
      ).toBe(true);
      expect(
        existsSync(
          join(
            aliasDir,
            "src",
            "alias-starter",
            "agents",
            "alias-starter-assistant",
            "alias-starter-assistant.prompt.md"
          )
        )
      ).toBe(true);
      expect(
        existsSync(join(aliasDir, "src", "alias-starter", "routers", "main", "main.router.ts"))
      ).toBe(true);
      expect(
        existsSync(
          join(aliasDir, "src", "guardrails", "prompt-injection", "prompt-injection.guardrail.ts")
        )
      ).toBe(true);
      expect(
        existsSync(join(aliasDir, "src", "model-providers", "openrouter.model-provider.ts"))
      ).toBe(true);
      expect(existsSync(join(aliasDir, "src", "services", "api.service.ts"))).toBe(true);

      execFileSync(
        "npx",
        ["agboss", "g", "a", "reviewer-agent", "--workflow", "clean-starter-workflow"],
        { cwd: appDir, stdio: "pipe", env: { ...process.env, npm_config_cache: npmCache } }
      );
      expect(
        existsSync(join(appDir, "src", "clean-starter", "agents", "reviewer", "reviewer.agent.ts"))
      ).toBe(true);
      expect(
        existsSync(join(appDir, "src", "clean-starter", "agents", "reviewer", "reviewer.prompt.md"))
      ).toBe(true);

      execFileSync(
        "npx",
        ["agboss", "g", "r", "triage-router", "--workflow", "clean-starter-workflow"],
        { cwd: appDir, stdio: "pipe", env: { ...process.env, npm_config_cache: npmCache } }
      );
      expect(
        existsSync(join(appDir, "src", "clean-starter", "routers", "triage", "triage.router.ts"))
      ).toBe(true);

      execFileSync(
        "npx",
        [
          "agboss",
          "g",
          "t",
          "lookup-order-tool",
          "--workflow",
          "clean-starter-workflow",
          "--agent",
          "clean-starter-assistant-agent"
        ],
        { cwd: appDir, stdio: "pipe", env: { ...process.env, npm_config_cache: npmCache } }
      );
      expect(
        existsSync(join(appDir, "src", "clean-starter", "tools", "lookup-order.tool.ts"))
      ).toBe(true);
      expect(
        existsSync(join(appDir, "src", "clean-starter", "dto", "lookup-order-query.dto.ts"))
      ).toBe(true);
      expect(
        existsSync(join(appDir, "src", "clean-starter", "dto", "lookup-order-result.dto.ts"))
      ).toBe(true);

      execFileSync(
        "npx",
        [
          "agboss",
          "g",
          "m",
          "catalog",
          "--workflow",
          "clean-starter-workflow",
          "--command",
          "npx -y @modelcontextprotocol/server-everything",
          "--tool",
          "echo",
          "--agent",
          "clean-starter-assistant-agent"
        ],
        { cwd: appDir, stdio: "pipe", env: { ...process.env, npm_config_cache: npmCache } }
      );
      expect(
        existsSync(join(appDir, "src", "clean-starter", "mcp", "catalog.mcp-server.ts"))
      ).toBe(true);
      expect(
        existsSync(join(appDir, "src", "clean-starter", "mcp", "catalog-echo.mcp-tool.ts"))
      ).toBe(true);

      execFileSync(
        "npx",
        [
          "agboss",
          "g",
          "rag",
          "docs-rag",
          "--workflow",
          "clean-starter-workflow",
          "--folder",
          "docs/kb",
          "--agent",
          "clean-starter-assistant-agent"
        ],
        { cwd: appDir, stdio: "pipe", env: { ...process.env, npm_config_cache: npmCache } }
      );
      expect(existsSync(join(appDir, "src", "clean-starter", "rag", "docs.rag.ts"))).toBe(true);

      execFileSync("npx", ["agboss", "g", "w", "billing-workflow"], {
        cwd: appDir,
        stdio: "pipe",
        env: { ...process.env, npm_config_cache: npmCache }
      });
      expect(existsSync(join(appDir, "src", "billing", "billing.workflow.ts"))).toBe(true);
      expect(
        existsSync(join(appDir, "src", "billing", "workflow-starts", "text.workflow-start.ts"))
      ).toBe(true);
      expect(
        existsSync(join(appDir, "src", "billing", "workflow-finishes", "text.workflow-finish.ts"))
      ).toBe(true);
      expect(
        existsSync(
          join(
            appDir,
            "src",
            "billing",
            "agents",
            "billing-assistant",
            "billing-assistant.agent.ts"
          )
        )
      ).toBe(true);
      expect(
        existsSync(
          join(
            appDir,
            "src",
            "billing",
            "agents",
            "billing-assistant",
            "billing-assistant.prompt.md"
          )
        )
      ).toBe(true);
      expect(
        existsSync(join(appDir, "src", "billing", "routers", "main", "main.router.ts"))
      ).toBe(true);
    } finally {
      rmSync(isolatedWorkspace, { recursive: true, force: true });
    }
  });
});

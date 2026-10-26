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
import { studioOf } from "@agboss/core/internal";
import { callTool, replyWith, routeTo, testWith } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import {
  resolveScaffoldTestConfig,
  verifyScaffoldInstalledPackages,
} from "../../../../scripts/run-all.mjs";
import { QuoteAdvisorAgent } from "../../../src/agents/quote-advisor/quote-advisor.agent.js";
import { SupportSpecialistAgent } from "../../../src/agents/support-specialist/support-specialist.agent.js";
import { SupportReplyDto } from "../../../src/dto/support-reply.dto.js";
import { HelloAgbossApplication } from "../../../src/hello-agboss.application.js";
import { IntakeTriageRouter } from "../../../src/routers/intake-triage/intake-triage.router.js";
import { PricingCatalogService } from "../../../src/services/pricing-catalog.service.js";
import { CalculateQuoteTool } from "../../../src/tools/calculate-quote.tool.js";
import { HelloWorkflowFinish as HelloFinish } from "../../../src/workflows/hello-agboss/hello.workflow-finish.js";
import { HelloWorkflowStart as HelloStart } from "../../../src/workflows/hello-agboss/hello.workflow-start.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const REPO_ROOT = resolve(PROJECT_ROOT, "..");
const test = testWith(HelloAgbossApplication);

const DEFAULT_EXEC_OPTIONS = {
  ownerId: "user-test-1",
  tenant: { tenantId: "tenant-acme", plan: "pro" as const },
  execution: { userId: "user-test-1" },
};

test("routes general product inquiries to SupportSpecialistAgent and finishes with SupportReplyDto", async ({
  app,
  mockLlm,
}) => {
  mockLlm(IntakeTriageRouter).thenReturn(routeTo(SupportSpecialistAgent));
  mockLlm(SupportSpecialistAgent).thenReturn(
    replyWith(SupportReplyDto, {
      handledBy: "support",
      answer: "AGBoss validates workflow graphs statically via `agboss check`.",
      quotedMonthlyUsd: 0,
    }),
  );

  const result = await app.execute(
    HelloStart,
    {
      customerId: "cust-001",
      question: "How does AGBoss validate workflows?",
      seats: 1,
    },
    DEFAULT_EXEC_OPTIONS,
  );

  expect(result).toFollowPath([
    HelloStart,
    IntakeTriageRouter,
    SupportSpecialistAgent,
    HelloFinish,
  ]);
  expect(result).toFinishWith(HelloFinish, {
    handledBy: "support",
    answer: "AGBoss validates workflow graphs statically via `agboss check`.",
    quotedMonthlyUsd: 0,
  });
});

test("routes pricing inquiries to QuoteAdvisorAgent and mocks PricingCatalogService via mockOf() with zero network", async ({
  app,
  mockLlm,
  mockOf,
}) => {
  mockOf(PricingCatalogService).fetchQuote.mockResolvedValue({
    tier: "pro",
    seats: 12,
    monthlyTotalUsd: 805.8,
    volumeDiscountApplied: true,
    currency: "USD",
  });

  mockLlm(IntakeTriageRouter).thenReturn(routeTo(QuoteAdvisorAgent));
  mockLlm(QuoteAdvisorAgent)
    .thenReturn(callTool(CalculateQuoteTool, { tier: "pro", seats: 12 }))
    .thenReturn(
      replyWith(SupportReplyDto, {
        handledBy: "pricing",
        answer: "12 Pro seats with 15% volume discount cost $805.80/month.",
        quotedMonthlyUsd: 805.8,
      }),
    );

  const result = await app.execute(
    HelloStart,
    {
      customerId: "cust-002",
      question: "What is the price for 12 seats on Pro?",
      seats: 12,
    },
    DEFAULT_EXEC_OPTIONS,
  );

  expect(result).toFollowPath([HelloStart, IntakeTriageRouter, QuoteAdvisorAgent, HelloFinish]);
  expect(result).toHaveCalledTools([CalculateQuoteTool]);
  expect(result).toHaveToolCallMatching(CalculateQuoteTool, { tier: "pro", seats: 12 });
  expect(mockOf(PricingCatalogService).fetchQuote.mock.calls).toEqual([["pro", 12]]);
  expect(result.toolCalls[0]?.output).toEqual({
    tier: "pro",
    seats: 12,
    monthlyTotalUsd: 805.8,
    volumeDiscountApplied: true,
    currency: "USD",
  });
  expect(result).toFinishWith(HelloFinish, {
    handledBy: "pricing",
    answer: "12 Pro seats with 15% volume discount cost $805.80/month.",
    quotedMonthlyUsd: 805.8,
  });
});

describe("LangGraph Studio (`studioOf` + `getGraphAsync({ xray: true })`) & Packaging", () => {
  it("renders the workflow topology for LangGraph Studio via studioOf()", async () => {
    const studio = await studioOf(HelloAgbossApplication, {
      processEnv: {
        ...process.env,
        OPENROUTER_API_KEY: "offline-test-openrouter-api-key",
      },
    });
    try {
      expect(studio.names).toContain("hello-agboss-workflow");
      const drawn = await studio.graph("hello-agboss-workflow").getGraphAsync({ xray: true });
      const nodeIds = Object.keys(drawn.nodes);
      expect(nodeIds).toContain("intake-triage-router");
      expect(nodeIds).toContain("support-specialist-agent");
      expect(nodeIds).toContain("quote-advisor-agent");
    } finally {
      await studio.close();
    }
  });

  it("resolves @agboss/core exclusively from packaged node_modules and generates .agboss type contracts", () => {
    const resolvedAgboss = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        'import { fileURLToPath } from "node:url"; import { realpathSync } from "node:fs"; process.stdout.write(realpathSync(fileURLToPath(import.meta.resolve("@agboss/core"))));',
      ],
      { cwd: PROJECT_ROOT, encoding: "utf8" },
    );
    expect(resolvedAgboss.startsWith(realpathSync(join(PROJECT_ROOT, "node_modules")))).toBe(true);
    expect(resolvedAgboss).not.toContain("/packages/agboss/src/");

    expect(existsSync(join(PROJECT_ROOT, ".agboss", "types.d.ts"))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, ".claude", "skills", "agboss", "SKILL.md"))).toBe(true);
  });

  it("scaffolds a clean project via `agboss create` and `agboss generate` following the canonical Block 1 layout", () => {
    const scaffoldConfig = resolveScaffoldTestConfig({
      projectRoot: PROJECT_ROOT,
      repoRoot: REPO_ROOT,
      env: process.env,
    });

    const isolatedWorkspace = realpathSync(mkdtempSync(join(tmpdir(), "hello-agboss-create-")));
    const cliBin = join(PROJECT_ROOT, "node_modules", ".bin", "agboss");
    const npmCache = join(REPO_ROOT, ".packed", ".npm-cache");

    try {
      execFileSync(cliBin, ["create", "clean-starter", "--yes", "--skip-install"], {
        cwd: isolatedWorkspace,
        stdio: "pipe",
        env: { ...process.env, npm_config_cache: npmCache },
      });

      const appDir = join(isolatedWorkspace, "clean-starter");
      expect(existsSync(join(appDir, "src", "clean-starter.application.ts"))).toBe(true);
      expect(
        existsSync(
          join(
            appDir,
            "src",
            "workflows",
            "clean-starter",
            "clean-starter.workflow.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          join(
            appDir,
            "src",
            "workflows",
            "clean-starter",
            "text.workflow-start.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          join(
            appDir,
            "src",
            "workflows",
            "clean-starter",
            "text.workflow-finish.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          join(
            appDir,
            "src",
            "agents",
            "clean-starter-assistant",
            "clean-starter-assistant.agent.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          join(
            appDir,
            "tests",
            "workflows",
            "clean-starter",
            "clean-starter.workflow.test.ts",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(join(appDir, "tests", "services", "api.service.test.ts")),
      ).toBe(true);

      const pkgPath = join(appDir, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
        overrides?: Record<string, string>;
      };
      expect(pkg.dependencies["@agboss/core"]).toBeDefined();
      expect(pkg.dependencies["@agboss/core"]?.startsWith("file:")).toBe(false);
      expect(pkg.devDependencies["@agboss/cli"]).toBeDefined();
      expect(pkg.devDependencies["@agboss/cli"]?.startsWith("file:")).toBe(false);

      pkg.dependencies["@agboss/core"] = scaffoldConfig.agbossSpec;
      pkg.devDependencies["@agboss/cli"] = scaffoldConfig.cliSpec;
      if (scaffoldConfig.useOverrides) {
        pkg.overrides = {
          "@agboss/core": scaffoldConfig.agbossSpec,
          "@agboss/cli": scaffoldConfig.cliSpec,
        };
      }
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

      const installArgs =
        scaffoldConfig.provenance === "published"
          ? ["install", "--registry", "https://registry.npmjs.org/", "--no-audit", "--no-fund"]
          : ["install", "--no-audit", "--no-fund"];
      execFileSync("npm", installArgs, {
        cwd: appDir,
        stdio: "pipe",
        env: { ...process.env, npm_config_cache: npmCache },
      });

      const verifiedPackages = verifyScaffoldInstalledPackages({
        appDir,
        config: scaffoldConfig,
      });
      expect(verifiedPackages.agboss.version).toBe(scaffoldConfig.expectedVersion.agboss);
      expect(verifiedPackages.agbossCli.version).toBe(scaffoldConfig.expectedVersion.agbossCli);
      expect(verifiedPackages.agboss.integrity).toBe(scaffoldConfig.expectedIntegrity.agboss);
      expect(verifiedPackages.agbossCli.integrity).toBe(scaffoldConfig.expectedIntegrity.agbossCli);
      if (scaffoldConfig.provenance === "published") {
        expect(verifiedPackages.agboss.resolved).toBe(scaffoldConfig.expectedResolved.agboss);
        expect(verifiedPackages.agbossCli.resolved).toBe(scaffoldConfig.expectedResolved.agbossCli);
      }

      const refsDir = join(appDir, ".claude", "skills", "agboss", "references");
      expect(
        readdirSync(refsDir).filter((f) => f.endsWith(".md")).length,
      ).toBeGreaterThanOrEqual(13);

      execFileSync(
        "npx",
        ["agboss", "g", "ws", "webhook-workflow-start"],
        { cwd: appDir, stdio: "pipe", env: { ...process.env, npm_config_cache: npmCache } },
      );
      expect(
        existsSync(
          join(
            appDir,
            "src",
            "workflows",
            "clean-starter",
            "webhook.workflow-start.ts",
          ),
        ),
      ).toBe(true);

      execFileSync(
        "npx",
        ["agboss", "g", "wf", "audit-workflow-finish"],
        { cwd: appDir, stdio: "pipe", env: { ...process.env, npm_config_cache: npmCache } },
      );
      expect(
        existsSync(
          join(
            appDir,
            "src",
            "workflows",
            "clean-starter",
            "audit.workflow-finish.ts",
          ),
        ),
      ).toBe(true);
    } finally {
      rmSync(isolatedWorkspace, { recursive: true, force: true });
    }
  });
});

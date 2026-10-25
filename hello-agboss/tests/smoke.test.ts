import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { secret } from "agboss";
import { callTool, replyWith, routeTo, testTool, testWith } from "agboss/testing";
import { describe, expect, it } from "vitest";
import { QuoteAdvisorAgent } from "../src/agents/quote-advisor/quote-advisor.agent.js";
import { SupportSpecialistAgent } from "../src/agents/support-specialist/support-specialist.agent.js";
import { SupportReplyDto } from "../src/dto/support-reply.dto.js";
import { HelloAgbossApplication } from "../src/hello-agboss.application.js";
import { IntakeTriageRouter } from "../src/routers/intake-triage/intake-triage.router.js";
import { CalculateQuoteTool } from "../src/tools/calculate-quote.tool.js";
import { HelloWorkflowFinish as HelloFinish } from "../src/workflow-finishes/hello.workflow-finish.js";
import { HelloWorkflowStart as HelloStart } from "../src/workflow-starts/hello.workflow-start.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const test = testWith(HelloAgbossApplication);

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

  const result = await app.execute(HelloStart, {
    customerId: "cust-001",
    question: "How does AGBoss validate workflows?",
    seats: 1,
  });

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

test("routes pricing inquiries to QuoteAdvisorAgent, invokes CalculateQuoteTool via DI, and returns volume-discounted quote", async ({
  app,
  mockLlm,
}) => {
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

  const result = await app.execute(HelloStart, {
    customerId: "cust-002",
    question: "What is the price for 12 seats on Pro?",
    seats: 12,
  });

  expect(result).toFollowPath([HelloStart, IntakeTriageRouter, QuoteAdvisorAgent, HelloFinish]);
  expect(result).toHaveCalledTools([CalculateQuoteTool]);
  expect(result).toHaveToolCallMatching(CalculateQuoteTool, { tier: "pro", seats: 12 });
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

describe("CalculateQuoteTool unit runner & packaging boundaries", () => {
  const runQuoteTool = testTool(CalculateQuoteTool, {
    environment: {
      openRouterApiKey: secret("OPENROUTER_API_KEY"),
      catalogCurrency: "EUR",
      sqlitePath: ":memory:",
    },
  });

  it("injects PricingCatalogService and reads catalogCurrency from ApplicationContext.environment", async () => {
    const { output } = await runQuoteTool({ tier: "starter", seats: 5 });
    expect(output).toEqual({
      tier: "starter",
      seats: 5,
      monthlyTotalUsd: 145,
      volumeDiscountApplied: false,
      currency: "EUR",
    });
  });

  it("resolves agboss exclusively from packaged node_modules and generates .agboss type contracts", () => {
    const resolvedAgboss = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", 'import { fileURLToPath } from "node:url"; import { realpathSync } from "node:fs"; process.stdout.write(realpathSync(fileURLToPath(import.meta.resolve("agboss"))));'],
      { cwd: PROJECT_ROOT, encoding: "utf8" },
    );
    expect(resolvedAgboss.startsWith(realpathSync(join(PROJECT_ROOT, "node_modules")))).toBe(true);
    expect(resolvedAgboss).not.toContain("/packages/agboss/src/");

    expect(existsSync(join(PROJECT_ROOT, ".agboss", "types.d.ts"))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, ".claude", "skills", "agboss", "SKILL.md"))).toBe(true);

    const describeRaw = execFileSync("npx", ["agboss", "describe", "--json"], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });
    const parsed = JSON.parse(describeRaw) as {
      ok: boolean;
      result: { application: { name: string; workflows: string[] } };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.result.application.name).toBe("hello-agboss-application");
    expect(parsed.result.application.workflows).toContain("hello-agboss-workflow");
  });
});

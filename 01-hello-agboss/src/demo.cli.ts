import { createApp, ExecutionStatus } from "@agboss/core";
import { installOfflineNetworkGuard } from "../../scripts/tooling/offline-transports.js";
import { startPricingApiStubServer } from "./services/pricing-catalog.service.js";
import { HelloWorkflowStart } from "./workflows/hello-agboss/hello.workflow-start.js";

/**
 * `npm run demo:codex-cli | demo:claude-cli | demo:gemini-cli`: the hello-agboss workflow on your own
 * vendor CLI and plan, no API key. Demo / local only: each provider prints its warning when it starts.
 * The pricing API is the local stub; only the CLI itself talks to its vendor.
 */
async function applicationOf(vendor: string): Promise<new () => object> {
  switch (vendor) {
    case "codex":
      return (await import("./hello-agboss.codex-cli.app.js")).HelloAgbossCodexCliApplication;
    case "claude":
      return (await import("./hello-agboss.claude-cli.app.js")).HelloAgbossClaudeCliApplication;
    case "gemini":
      return (await import("./hello-agboss.gemini-cli.app.js")).HelloAgbossGeminiCliApplication;
    default:
      throw new Error(`usage: tsx src/demo.cli.ts codex|claude|gemini (got "${vendor}")`);
  }
}

async function main(): Promise<void> {
  const vendor = process.argv[2] ?? "codex";
  const Application = await applicationOf(vendor);
  const restoreFetch = installOfflineNetworkGuard();
  const pricingStub = await startPricingApiStubServer();
  process.env.PRICING_API_BASE_URL = pricingStub.baseUrl;
  const app = await createApp(Application);
  try {
    const options = {
      ownerId: "user-demo-1",
      tenant: { tenantId: "tenant-acme", plan: "pro" as const },
      execution: { userId: "user-demo-1" },
    };
    const support = await app.execute(
      HelloWorkflowStart,
      { customerId: "cust-101", question: "How does AGBoss verify workflow path safety before runtime?", seats: 1 },
      options,
    );
    const pricing = await app.execute(
      HelloWorkflowStart,
      { customerId: "cust-202", question: "Can we get a pricing quote for the pro tier?", seats: 12 },
      options,
    );
    console.log(JSON.stringify({ vendor, support: summary(support), pricing: summary(pricing) }, null, 2));
    if (support.status !== ExecutionStatus.Finished || pricing.status !== ExecutionStatus.Finished) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
    await pricingStub.close();
    restoreFetch();
  }
}

function summary(run: { status: unknown; path: readonly string[]; output?: unknown; toolCalls: readonly unknown[] }): unknown {
  return { status: run.status, path: run.path, toolCalls: run.toolCalls.length, output: run.output };
}

await main();

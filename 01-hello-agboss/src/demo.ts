import { createApp, ExecutionStatus } from "agboss";
import { createHelloOfflineFetch } from "../../scripts/tooling/offline-transports.js";
import { HelloAgbossApplication } from "./hello-agboss.application.js";
import { startPricingApiStubServer } from "./services/pricing-catalog.service.js";
import { HelloWorkflowStart } from "./workflows/hello-agboss/hello.workflow-start.js";

async function main(): Promise<void> {
  const isLive = process.env.AGBOSS_LIVE_DEMO === "true";
  const pricingStub = await startPricingApiStubServer();
  process.env.PRICING_API_BASE_URL = pricingStub.baseUrl;

  const app = await createApp(HelloAgbossApplication, {
    processEnv: {
      ...process.env,
      PRICING_API_BASE_URL: pricingStub.baseUrl,
    },
    ...(isLive ? {} : { providerFetch: createHelloOfflineFetch() }),
  });

  try {
    const execOptions = {
      ownerId: "user-demo-1",
      tenant: { tenantId: "tenant-acme", plan: "pro" as const },
      execution: { userId: "user-demo-1" },
    };

    const supportRun = await app.execute(
      HelloWorkflowStart,
      {
        customerId: "cust-101",
        question: "How does AGBoss verify workflow path safety before runtime?",
        seats: 1,
      },
      execOptions,
    );

    if (
      supportRun.status !== ExecutionStatus.Finished ||
      !supportRun.path.includes("support-specialist-agent")
    ) {
      throw new Error(
        `Expected support-specialist-agent path, got ${supportRun.path.join(" -> ")}`,
      );
    }

    const pricingRun = await app.execute(
      HelloWorkflowStart,
      {
        customerId: "cust-202",
        question: "Can we get a pricing quote for the pro tier?",
        seats: 12,
      },
      execOptions,
    );

    if (
      pricingRun.status !== ExecutionStatus.Finished ||
      !pricingRun.path.includes("quote-advisor-agent")
    ) {
      throw new Error(`Expected quote-advisor-agent path, got ${pricingRun.path.join(" -> ")}`);
    }

    console.log(
      JSON.stringify(
        {
          application: app.name,
          pricingApiRequestsCount: pricingStub.requests.length,
          supportBranch: {
            status: supportRun.status,
            path: supportRun.path,
            output: supportRun.output,
          },
          pricingBranch: {
            status: pricingRun.status,
            path: pricingRun.path,
            toolCalls: pricingRun.toolCalls.map((c) => ({
              tool: c.step.component.name,
              status: c.status,
              input: c.input,
              output: c.output,
            })),
            output: pricingRun.output,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
    await pricingStub.close();
  }
}

await main();

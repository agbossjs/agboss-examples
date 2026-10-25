import { createApp, ExecutionStatus } from "agboss";
import { createHelloOfflineFetch } from "../../scripts/tooling/offline-transports.js";
import { HelloAgbossApplication } from "./hello-agboss.application.js";
import { HelloWorkflowStart } from "./workflow-starts/hello.workflow-start.js";

async function main(): Promise<void> {
  const isLive = process.env.AGBOSS_LIVE_DEMO === "true";
  const app = await createApp(
    HelloAgbossApplication,
    isLive ? {} : { providerFetch: createHelloOfflineFetch() },
  );
  try {
    const supportRun = await app.execute(HelloWorkflowStart, {
      customerId: "cust-101",
      question: "How does AGBoss verify workflow path safety before runtime?",
      seats: 1,
    });

    if (
      supportRun.status !== ExecutionStatus.Finished ||
      !supportRun.path.includes("support-specialist-agent")
    ) {
      throw new Error(`Expected support-specialist-agent path, got ${supportRun.path.join(" -> ")}`);
    }

    const pricingRun = await app.execute(HelloWorkflowStart, {
      customerId: "cust-202",
      question: "Can we get a pricing quote for the pro tier?",
      seats: 12,
    });

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
  }
}

await main();

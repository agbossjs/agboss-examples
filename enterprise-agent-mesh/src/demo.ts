import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp, ExecutionStatus } from "agboss";
import { A2AClient, a2aHttpListener } from "agboss/a2a";
import {
  BillingA2AExpose,
  BillingA2aCallerResolver,
  BillingApplication,
  BillingInquiryDto,
  BillingResolutionDto,
} from "../billing-service/billing.application.js";
import {
  CatalogApplication,
  CatalogWorkflowStart,
} from "../catalog-mcp/catalog.application.js";
import { runFederationBlastRadiusProof } from "../federation/verify-federation.js";

const billingApp = await createApp(BillingApplication);
const httpServer = createServer(
  a2aHttpListener(billingApp, {
    expose: BillingA2AExpose,
    callerResolver: BillingA2aCallerResolver,
    base: "/a2a",
  }),
);

await new Promise<void>((resolve) =>
  httpServer.listen(0, "127.0.0.1", () => resolve()),
);
const port = (httpServer.address() as AddressInfo).port;

const client = new A2AClient<BillingInquiryDto, BillingResolutionDto>({
  url: `http://127.0.0.1:${String(port)}/a2a`,
  contract: {
    target: {
      application: "billing-application",
      start: "billing-workflow-start",
    },
    input: BillingInquiryDto,
    output: BillingResolutionDto,
  },
  headers: {
    authorization: "Bearer key-acme",
  },
});

const billingResult = await client.execute({
  invoiceId: "INV-5001",
  question: "Verify SLA credit on delayed GPU rack",
});

await new Promise<void>((resolve) => httpServer.close(() => resolve()));
await billingApp.close();

let liveCatalogLookup: Record<string, unknown> | undefined;
if (process.env.OPEN_ROUTER_KEY || process.argv.includes("--live")) {
  const catalogApp = await createApp(CatalogApplication);
  try {
    const skuRun = await catalogApp.execute(CatalogWorkflowStart, {
      sku: "SKU-GPU-900",
    });
    liveCatalogLookup = {
      status: skuRun.status,
      output: skuRun.status === ExecutionStatus.Finished ? skuRun.output : undefined,
      path: skuRun.path,
    };
  } finally {
    await catalogApp.close();
  }
}

const federation = await runFederationBlastRadiusProof();

process.stdout.write(
  `${JSON.stringify(
    {
      project: "enterprise-agent-mesh",
      a2aResolution: billingResult,
      ...(liveCatalogLookup ? { liveCatalogLookup } : {}),
      federationProof: federation,
    },
    null,
    2,
  )}\n`,
);

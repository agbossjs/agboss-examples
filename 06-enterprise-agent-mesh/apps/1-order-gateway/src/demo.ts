import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp, ExecutionStatus } from "@agboss/core";
import { A2AClient, a2aHttpListener } from "@agboss/core/a2a";
import { runFederationBlastRadiusProof } from "../../../federation/verify-federation.js";
import {
  installOfflineNetworkGuard,
  isLiveDemoRequested,
  requireLiveApiKey,
} from "../../../../scripts/tooling/offline-transports.js";
import {
  BillingA2AExpose,
  BillingA2aCallerResolver,
  BillingApplication,
  BillingInquiryDto,
  BillingResolutionDto,
} from "../../2-billing-a2a/src/billing.application.js";
import {
  CatalogApplication,
  CatalogWorkflowStart,
} from "../../3-catalog-mcp/src/catalog.application.js";

const isLive = isLiveDemoRequested();
if (isLive) {
  requireLiveApiKey();
}
const restoreFetch = isLive ? (): void => undefined : installOfflineNetworkGuard();

try {
  const billingApp = await createApp(BillingApplication);
  const httpServer = createServer(
    a2aHttpListener(billingApp, {
      expose: BillingA2AExpose,
      callerResolver: BillingA2aCallerResolver,
      base: "/a2a",
    }),
  );

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
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

  await new Promise<void>((resolve) => {
    httpServer.close(() => {
      resolve();
    });
  });
  await billingApp.close();

  let liveCatalogLookup: Record<string, unknown> | undefined;
  if (isLive) {
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
  if (!federation.compatibleOk || federation.breakingExitCode === 0) {
    throw new Error(
      `Expected federation blast-radius proof to pass, got: ${JSON.stringify(federation)}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        project: "enterprise-agent-mesh",
        status: "passed",
        a2aResolution: billingResult,
        ...(liveCatalogLookup ? { liveCatalogLookup } : {}),
        federationProof: federation,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  restoreFetch();
}

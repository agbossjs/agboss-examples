import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp, ExecutionStatus } from "agboss";
import { A2ACallerRejectedError, A2AClient, a2aHttpListener } from "agboss/a2a";
import { callTool, replyWith, testWith } from "agboss/testing";
import { afterEach, describe, expect } from "vitest";
import {
  BillingA2AExpose,
  BillingA2aCallerResolver,
  BillingApplication,
  BillingInquiryDto,
  BillingResolutionDto,
} from "../billing-service/billing.application.js";
import {
  AskBillingTool,
  CatalogMcpServer,
  configureTriageMeshTarget,
  SearchCatalogTool,
  TriageAgent,
  TriageGatewayApplication,
  TriageResponseDto,
  TriageWorkflowFinish,
  TriageWorkflowStart,
} from "../triage-gateway/triage.application.js";

const billingTest = testWith(BillingApplication);
const triageTest = testWith(TriageGatewayApplication, {
  allowNetwork: ["127.0.0.1"],
});

const openServers: Server[] = [];

afterEach(async () => {
  configureTriageMeshTarget({
    billingUrl: "http://127.0.0.1:8081/a2a",
    apiKey: "key-acme",
    extraHeaders: {},
  });
  while (openServers.length > 0) {
    const srv = openServers.pop();
    if (srv !== undefined) {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  }
});

describe("Enterprise Agent Mesh — A2A Contract & Caller Authentication (EX-16 / EX-17)", () => {
  billingTest(
    "rejects unauthenticated A2A requests with 401 and resolves tenant acme for valid Bearer token",
    async ({ a2aServer }) => {
      const server = await a2aServer({
        expose: BillingA2AExpose,
        callerResolver: BillingA2aCallerResolver,
      });

      const unauthenticatedClient = new A2AClient<
        BillingInquiryDto,
        BillingResolutionDto
      >({
        url: server.url,
        contract: {
          target: {
            application: "billing-application",
            start: "billing-workflow-start",
          },
          input: BillingInquiryDto,
          output: BillingResolutionDto,
        },
      });

      await expect(
        unauthenticatedClient.execute({
          invoiceId: "INV-5001",
          question: "Check SLA credit",
        }),
      ).rejects.toThrow(A2ACallerRejectedError);

      const authenticatedClient = new A2AClient<
        BillingInquiryDto,
        BillingResolutionDto
      >({
        url: server.url,
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

      const resolution = await authenticatedClient.execute({
        invoiceId: "INV-5001",
        question: "Check SLA credit",
      });

      expect(resolution).toEqual({
        invoiceId: "INV-5001",
        resolution:
          "Invoice INV-5001 verified for tenant acme; $45.00 SLA credit applied.",
        creditedUsd: 45,
        resolvedTenantId: "acme",
      });
    },
  );

  triageTest(
    "executes TriageGatewayApplication across live loopback BillingApplication A2A and Catalog MCP",
    async ({ app, mockLlm, mcpOf }) => {
      const billingApp = await createApp(BillingApplication);
      const httpServer = createServer(
        a2aHttpListener(billingApp, {
          expose: BillingA2AExpose,
          callerResolver: BillingA2aCallerResolver,
          base: "/a2a",
        }),
      );
      openServers.push(httpServer);
      await new Promise<void>((resolve) =>
        httpServer.listen(0, "127.0.0.1", () => resolve()),
      );
      const port = (httpServer.address() as AddressInfo).port;
      configureTriageMeshTarget({
        billingUrl: `http://127.0.0.1:${String(port)}/a2a`,
        apiKey: "key-acme",
      });

      mcpOf(CatalogMcpServer).thenReturn({
        "lookup-sku-tool": ({ sku }) =>
          Promise.resolve({
            sku,
            title: `Enterprise Rack Module (${sku})`,
            unitPriceUsd: 1250,
            inStockUnits: 14,
          }),
      });

      mockLlm(TriageAgent).thenReturn(
        callTool(SearchCatalogTool, { sku: "SKU-GPU-900" }),
        callTool(AskBillingTool, {
          invoiceId: "INV-5001",
          question: "Verify SLA credit",
        }),
        replyWith(TriageResponseDto, {
          invoiceId: "INV-5001",
          sku: "SKU-GPU-900",
          summary:
            "SKU-GPU-900 in stock (14 units) and INV-5001 credited $45.00 for tenant acme.",
          creditedUsd: 45,
        }),
      );

      const execution = await app.execute(TriageWorkflowStart, {
        invoiceId: "INV-5001",
        sku: "SKU-GPU-900",
        question: "Check stock and SLA credit",
      });

      expect(execution.status).toBe(ExecutionStatus.Finished);
      expect(execution).toFinishWith(TriageWorkflowFinish, {
        invoiceId: "INV-5001",
        sku: "SKU-GPU-900",
        summary:
          "SKU-GPU-900 in stock (14 units) and INV-5001 credited $45.00 for tenant acme.",
        creditedUsd: 45,
      });

      await billingApp.close();
    },
  );
});

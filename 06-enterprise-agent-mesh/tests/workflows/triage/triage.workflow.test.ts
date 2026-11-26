import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createApp,
  ExecutionStatus,
  ToolCallStatus,
  LimitError,
} from "@agboss/core";
import {
  A2AError,
  A2AClient,
  a2aHttpListener,
  type A2AApp,
} from "@agboss/core/a2a";
import { callTool, replyWith, testWith } from "@agboss/core/testing";
import { ms } from "@agboss/core/units";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AskBillingTool,
  CatalogMcpServer,
  configureTriageMeshTarget,
  MeshLoopFallbackWorkflowFinish,
  SearchCatalogTool,
  TriageAgent,
  TriageGatewayApplication,
  TriageResponseDto,
  TriageWorkflowFinish,
  TriageWorkflowStart,
} from "../../../apps/1-order-gateway/src/order-gateway.application.js";
import { BillingA2AAgent } from "../../../apps/1-order-gateway/src/a2a/billing.a2a-agent.js";
import {
  BillingA2AEndpoint,
  BillingHttpAuthenticator,
  BillingApplication,
  BillingInquiryDto,
  BillingResolutionDto,
} from "../../../apps/2-billing-a2a/src/billing.application.js";
import { resetCatalogExecutionCount } from "../../../apps/3-catalog-mcp/src/catalog.application.js";
import { runFederationBlastRadiusProof } from "../../../federation/verify-federation.js";

const billingTest = testWith(BillingApplication);
const triageTest = testWith(TriageGatewayApplication, {
  allowNetwork: ["127.0.0.1"],
});

const openServers: Server[] = [];

beforeEach(() => {
  resetCatalogExecutionCount();
});

/**
 * Serves `billingApp` over A2A on a loopback port and gives the port — the Agent Card names the URL
 * callers reach it at, known once the server listens.
 */
async function listenedA2A(billingApp: A2AApp): Promise<number> {
  let listener: RequestListener = (_request, response) => {
    response.writeHead(503).end();
  };
  const httpServer = createServer((request, response) => {
    listener(request, response);
  });
  openServers.push(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
  const port = (httpServer.address() as AddressInfo).port;
  listener = a2aHttpListener(billingApp, {
    endpoint: BillingA2AEndpoint,
    authenticator: BillingHttpAuthenticator,
    publicUrl: `http://127.0.0.1:${String(port)}`,
    base: "/a2a",
  });
  return port;
}

afterEach(async () => {
  configureTriageMeshTarget({
    billingUrl: "http://127.0.0.1:8081/a2a",
    apiKey: "key-acme",
    extraHeaders: {},
  });
  while (openServers.length > 0) {
    const srv = openServers.pop();
    if (srv !== undefined) {
      await new Promise<void>((resolve) => {
        srv.close(() => {
          resolve();
        });
      });
    }
  }
});

describe("Enterprise Agent Mesh — A2A, MCP, Ed25519 Envelopes, Loop Guard & Federation Blast Radius", () => {
  billingTest(
    "rejects unauthenticated A2A requests with 401 and resolves tenant acme for valid Bearer token",
    async ({ a2aServer }) => {
      const server = await a2aServer({
        endpoint: BillingA2AEndpoint,
        authenticator: BillingHttpAuthenticator,
      });

      const unauthenticatedClient = new A2AClient<
        BillingInquiryDto,
        BillingResolutionDto
      >({
        url: server.url,
        contract: {
          application: "billing-application",
          skill: "billing-workflow-start",
          input: BillingInquiryDto,
          output: BillingResolutionDto,
        },
      });

      await expect(
        unauthenticatedClient.execute({
          invoiceId: "INV-5001",
          question: "Check SLA credit",
        }),
      ).rejects.toThrow(A2AError.CallerRejected);

      const authenticatedClient = new A2AClient<
        BillingInquiryDto,
        BillingResolutionDto
      >({
        url: server.url,
        contract: {
          application: "billing-application",
          skill: "billing-workflow-start",
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
    async ({ app, mockModel, mockMcp, clock }) => {
      // the billing server below runs on the real time and checks the envelope's replay window
      // against it; the gateway signs on the test's clock — so bring the test's clock to the real now
      const behind = new Date().getTime() - clock.now().getTime();
      await clock.advance(ms(behind));
      const billingApp = await createApp(BillingApplication);
      const port = await listenedA2A(billingApp);
      configureTriageMeshTarget({
        billingUrl: `http://127.0.0.1:${String(port)}/a2a`,
        apiKey: "key-acme",
      });

      mockMcp(CatalogMcpServer).thenReturn({
        "lookup-sku-tool": ({ sku }) =>
          Promise.resolve({
            sku,
            title: `Enterprise Rack Module (${sku})`,
            unitPriceUsd: 1250,
            inStockUnits: 14,
          }),
      });

      mockModel(TriageAgent).thenReturn(
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

      // the mesh rode the call (the billing card declares the extension): billing's run report,
      // verified with its key, names the remote execution in the tool call's record
      const billingCall = execution.toolCalls.find(
        (call) => call.step.component.name === "ask-billing-tool",
      );
      expect(billingCall?.status).toBe(ToolCallStatus.Succeeded);
      expect(billingCall?.remote).toMatchObject({
        application: "billing-application",
      });

      await billingApp.close();
    },
  );

  triageTest(
    "routes TriageWorkflow to MeshLoopFallbackWorkflowFinish via .onError(LimitError.MeshLoop, ...)",
    async ({ app, mockModel, mockService }) => {
      // the billing call refused as a loop: billing-application is already in the call chain
      mockService(BillingA2AAgent).execute.mockRejectedValue(
        new LimitError.MeshLoop({
          entry: "billing-application › billing-workflow-start",
          meshEntry: {
            application: "billing-application",
            start: "billing-workflow-start",
          },
          callChain: [
            {
              application: "billing-application",
              start: "billing-workflow-start",
              executionId: "exec_loop_1",
            },
          ],
        }),
      );
      mockModel(TriageAgent).thenReturn(
        callTool(AskBillingTool, {
          invoiceId: "INV-5001",
          question: "Trigger cyclic call",
        }),
      );

      const execution = await app.execute(TriageWorkflowStart, {
        invoiceId: "INV-5001",
        sku: "SKU-GPU-900",
        question: "Trigger cyclic call",
      });

      expect(execution.status).toBe(ExecutionStatus.Finished);
      expect(execution).toFinishWith(MeshLoopFallbackWorkflowFinish, {
        invoiceId: "INV-5001",
        sku: "SKU-GPU-900",
        question: "Trigger cyclic call",
      });
    },
  );

  it("passes compatible snapshots, detects incompatible schema + missing target with blast radius, and stitches hub show", async () => {
    const result = await runFederationBlastRadiusProof();

    expect(result.compatibleOk).toBe(true);
    expect(result.breakingExitCode).not.toBe(0);
    expect(result.breakingCodes).toContain("federation.incompatible-schema");
    expect(result.breakingCodes).toContain("federation.missing-target");
    expect(result.blastRadiusWorkflows).toContain(
      "triage-gateway-application › triage-workflow",
    );
    expect(result.hubAppNames).toEqual(
      expect.arrayContaining([
        "triage-gateway-application",
        "billing-application",
        "catalog-application",
      ]),
    );
  });
});

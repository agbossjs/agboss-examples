import { createHash, createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createApp,
  ExecutionStatus,
  MeshLoopDetectedError,
  type MeshEnvelope,
} from "@agboss/core";
import {
  A2ACallerRejectedError,
  A2AClient,
  A2AMesh,
  a2aHttpListener,
  type A2AApp,
} from "@agboss/core/a2a";
import { createMcpService } from "@agboss/core/mcp";
import { callTool, replyWith, testWith } from "@agboss/core/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MESH_PRIVATE_KEY_PEM } from "../../../apps/1-order-gateway/src/environments/app.environment.js";
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
  BillingA2AExpose,
  BillingA2aCallerResolver,
  BillingApplication,
  BillingInquiryDto,
  BillingResolutionDto,
} from "../../../apps/2-billing-a2a/src/billing.application.js";
import {
  CatalogApplication,
  CatalogMcp,
  getCatalogExecutionCount,
  resetCatalogExecutionCount,
} from "../../../apps/3-catalog-mcp/src/catalog.application.js";
import { runFederationBlastRadiusProof } from "../../../federation/verify-federation.js";

const billingTest = testWith(BillingApplication);
const triageTest = testWith(TriageGatewayApplication, {
  allowNetwork: ["127.0.0.1"],
});

const openServers: Server[] = [];

interface JsonRpcMessage {
  readonly jsonrpc: "2.0";
  readonly id?: number;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
  readonly result?: unknown;
  readonly error?: unknown;
}

function createLoopbackMcpChannel() {
  const pending = new Map<number, (msg: JsonRpcMessage) => void>();
  let onServerMessage: ((msg: JsonRpcMessage) => void) | undefined;

  const transport = {
    start(): Promise<void> {
      return Promise.resolve();
    },
    send(message: JsonRpcMessage): Promise<void> {
      if (message.id !== undefined) {
        pending.get(message.id)?.(message);
        pending.delete(message.id);
      }
      return Promise.resolve();
    },
    close(): Promise<void> {
      return Promise.resolve();
    },
    get onmessage() {
      return onServerMessage;
    },
    set onmessage(fn: ((msg: JsonRpcMessage) => void) | undefined) {
      onServerMessage = fn;
    },
  };

  let nextId = 1;
  return {
    transport,
    request(
      method: string,
      params: Record<string, unknown> = {},
    ): Promise<JsonRpcMessage> {
      const id = nextId++;
      return new Promise<JsonRpcMessage>((resolve) => {
        pending.set(id, resolve);
        onServerMessage?.({ jsonrpc: "2.0", id, method, params });
      });
    },
  };
}

function signMcpMeshEnvelope(args: Record<string, unknown>): string {
  const bodyHash = `sha256:${createHash("sha256")
    .update(JSON.stringify(args))
    .digest("hex")}`;
  const envelope: MeshEnvelope = {
    schema: 1,
    issuer: "triage-gateway-application",
    audience: "catalog-application",
    origin: {
      rootExecutionId: "exec_root_mcp_1",
      executionId: "exec_mcp_1",
      workflow: { name: "triage-workflow", version: "1.0.0" },
      step: {
        component: "triage-agent",
        idempotencyKey: "step_mcp_1",
        tool: "search-catalog-tool",
      },
    },
    callChain: [
      {
        application: "triage-gateway-application",
        start: "triage-workflow-start",
        executionId: "exec_mcp_1",
      },
    ],
    issuedAt: new Date().toISOString(),
    expiresIn: "PT60S",
    bodyHash,
  };
  return encodeSignedMeshJws(envelope, DEFAULT_MESH_PRIVATE_KEY_PEM);
}

function encodeUnsignedMeshJws(envelope: MeshEnvelope): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "agboss-mesh" }),
    "utf8",
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(envelope), "utf8").toString(
    "base64url",
  );
  return `${header}.${payload}.`;
}

function encodeSignedMeshJws(
  envelope: MeshEnvelope,
  privateKeyPem: string,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "EdDSA", typ: "agboss-mesh" }),
    "utf8",
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(envelope), "utf8").toString(
    "base64url",
  );
  const input = `${header}.${payload}`;
  const signature = sign(
    null,
    Buffer.from(input, "utf8"),
    createPrivateKey(privateKeyPem),
  ).toString("base64url");
  return `${input}.${signature}`;
}

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
    expose: BillingA2AExpose,
    callerResolver: BillingA2aCallerResolver,
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
        expose: BillingA2AExpose,
        callerResolver: BillingA2aCallerResolver,
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
          mesh: A2AMesh.IfSupported,
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
          application: "billing-application",
          skill: "billing-workflow-start",
          input: BillingInquiryDto,
          output: BillingResolutionDto,
          mesh: A2AMesh.IfSupported,
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
      const port = await listenedA2A(billingApp);
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

  it("exposes lookup-sku-tool and catalog-workflow-start over MCP and deduplicates repeated _meta.callId", async () => {
    const app = await createApp(CatalogApplication);
    const mcpService = createMcpService(app, CatalogMcp);
    const channel = createLoopbackMcpChannel();

    await mcpService.connect(
      channel.transport as unknown as Parameters<typeof mcpService.connect>[0],
      {
        peer: "triage-gateway-application",
        tenant: { tenantId: "acme" },
        ownerId: "triage-gateway-acme",
      },
    );

    const listResponse = await channel.request("tools/list");
    const toolsResult = listResponse.result as {
      tools: { name: string }[];
    };
    expect(toolsResult.tools.map((t) => t.name)).toEqual([
      "lookup-sku-tool",
      "catalog-workflow-start",
      "resume_workflow",
    ]);

    const toolArgs = { sku: "SKU-GPU-900" };
    const signedMesh = signMcpMeshEnvelope(toolArgs);

    const firstCall = await channel.request("tools/call", {
      name: "lookup-sku-tool",
      arguments: toolArgs,
      _meta: {
        callId: "step_idem_sku_900",
        "agboss.dev/mesh": signedMesh,
      },
    });

    expect(getCatalogExecutionCount()).toBe(1);

    const secondCall = await channel.request("tools/call", {
      name: "lookup-sku-tool",
      arguments: toolArgs,
      _meta: {
        callId: "step_idem_sku_900",
        "agboss.dev/mesh": signedMesh,
      },
    });

    expect(getCatalogExecutionCount()).toBe(1);
    expect(secondCall.result).toEqual(firstCall.result);

    await app.close();
  });

  it("refuses forged Ed25519 mesh signatures with mesh.signature-invalid and enforces loop / maxMeshHops limits over MCP", async () => {
    const app = await createApp(CatalogApplication);
    const mcpService = createMcpService(app, CatalogMcp);
    const channel = createLoopbackMcpChannel();
    await mcpService.connect(
      channel.transport as unknown as Parameters<typeof mcpService.connect>[0],
      {
        peer: "triage-gateway-application",
        tenant: { tenantId: "acme" },
        ownerId: "triage-gateway-acme",
      },
    );
    const toolArgs = { sku: "SKU-GPU-900" };
    const origin: MeshEnvelope["origin"] = {
      rootExecutionId: "exec_root_1",
      executionId: "exec_1",
      workflow: { name: "triage-workflow", version: "1.0.0" },
      step: {
        component: "triage-agent",
        idempotencyKey: "step_mesh_1",
        tool: "search-catalog-tool",
      },
    };
    const callWith = async (mesh: string) =>
      (
        await channel.request("tools/call", {
          name: "lookup-sku-tool",
          arguments: toolArgs,
          _meta: { "agboss.dev/mesh": mesh },
        })
      ).result as {
        isError?: boolean;
        _meta?: Record<string, { code?: string }>;
      };

    const attackerKeys = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const forged = await callWith(
      encodeSignedMeshJws(
        {
          schema: 1,
          issuer: "triage-gateway-application",
          audience: "catalog-application",
          origin,
          callChain: [
            {
              application: "triage-gateway-application",
              start: "triage-workflow-start",
              executionId: "exec_1",
            },
          ],
          issuedAt: new Date().toISOString(),
          expiresIn: "PT60S",
          bodyHash: `sha256:${createHash("sha256").update(JSON.stringify(toolArgs)).digest("hex")}`,
        },
        attackerKeys.privateKey,
      ),
    );
    expect(forged.isError).toBe(true);
    expect(forged._meta?.["agboss.dev/error"]?.code).toBe(
      "mesh.signature-invalid",
    );

    // a chain that already passed through this tool: the loop guard refuses before anything runs
    const loop = await callWith(
      encodeUnsignedMeshJws({
        schema: 1,
        issuer: "triage-gateway-application",
        origin,
        callChain: [
          {
            application: "catalog-application",
            start: "lookup-sku-tool",
            executionId: "exec_loop_1",
          },
          {
            application: "triage-gateway-application",
            start: "triage-workflow-start",
            executionId: "exec_loop_2",
          },
        ],
      }),
    );
    expect(loop.isError).toBe(true);
    expect(loop._meta?.["agboss.dev/error"]?.code).toBe("limit.mesh-loop");

    // three hops already: the catalog's maxMeshHops is 3
    const hops = await callWith(
      encodeUnsignedMeshJws({
        schema: 1,
        issuer: "triage-gateway-application",
        origin,
        callChain: [
          {
            application: "ingress-application",
            start: "ingress-start",
            executionId: "exec_hop_1",
          },
          {
            application: "router-application",
            start: "router-start",
            executionId: "exec_hop_2",
          },
          {
            application: "triage-gateway-application",
            start: "triage-workflow-start",
            executionId: "exec_hop_3",
          },
        ],
      }),
    );
    expect(hops.isError).toBe(true);
    expect(hops._meta?.["agboss.dev/error"]?.code).toBe("limit.hops");
    expect(getCatalogExecutionCount()).toBe(0);

    await app.close();
  });

  triageTest(
    "routes TriageWorkflow to MeshLoopFallbackWorkflowFinish via .onError(MeshLoopDetectedError, ...)",
    async ({ app, mockLlm, mockOf }) => {
      // the billing call refused as a loop: billing-application is already in the call chain
      mockOf(BillingA2AAgent).execute.mockRejectedValue(
        new MeshLoopDetectedError({
          entry: {
            application: "billing-application",
            start: "billing-workflow-start",
          },
          chain: [
            {
              application: "billing-application",
              start: "billing-workflow-start",
              executionId: "exec_loop_1",
            },
          ],
        }),
      );
      mockLlm(TriageAgent).thenReturn(
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

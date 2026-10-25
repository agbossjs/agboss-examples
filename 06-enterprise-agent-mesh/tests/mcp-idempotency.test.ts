import { createHash, createPrivateKey, sign } from "node:crypto";
import { createApp, type MeshEnvelope } from "agboss";
import { createMcpService } from "agboss/mcp";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CatalogApplication,
  CatalogMcp,
  getCatalogExecutionCount,
  resetCatalogExecutionCount,
} from "../catalog-mcp/catalog.application.js";
import { DEFAULT_MESH_PRIVATE_KEY_PEM } from "../src/environments/app.environment.js";

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
    createPrivateKey(DEFAULT_MESH_PRIVATE_KEY_PEM),
  ).toString("base64url");
  return `${input}.${signature}`;
}

describe("Enterprise Agent Mesh — MCP Exposure & _meta.callId Idempotency (EX-16 / EX-17)", () => {
  beforeEach(() => {
    resetCatalogExecutionCount();
  });

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
});

import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp, type App } from "@agboss/core";
import { mcpHttpListener } from "@agboss/core/mcp";
import { signedMeshEnvelope } from "@agboss/core/testing";
import { afterEach, describe, expect, it } from "vitest";
import {
  CatalogApplication,
  CatalogHttpAuthenticator,
  CatalogMcp,
  getCatalogExecutionCount,
  resetCatalogExecutionCount,
} from "../../apps/3-catalog-mcp/src/catalog.application.js";
import { OFFLINE_KEYS } from "../../apps/1-order-gateway/src/scripts/offline-keys.js";

const closers: (() => Promise<void>)[] = [];

afterEach(async () => {
  while (closers.length > 0) await closers.pop()?.();
});

/**
 * The catalog application served over MCP's Streamable HTTP by `mcpHttpListener` on a free loopback port: its
 * authenticator judges every caller that is no signed mesh peer, and there is no anonymous door.
 */
async function servedCatalog(): Promise<{ readonly url: string; readonly app: App }> {
  const app = await createApp(CatalogApplication);
  let url = "";
  const server: Server = createServer(
    mcpHttpListener(app, {
      endpoint: CatalogMcp,
      authenticator: CatalogHttpAuthenticator,
      publicUrl: () => url, // the port is known once it listens: the peers' signatures name this origin
      base: "/mcp",
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  closers.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => { resolve(); }));
    await app.close();
  });
  return { url: `${url}/mcp`, app };
}

const now = (): Date => new Date();

const TRIAGE = "triage-gateway-application";
const SIGNING_KEY = createPrivateKey(OFFLINE_KEYS["MESH_SIGNING_KEY"] ?? "");
const toolArgs = { sku: "SKU-GPU-900" };

const origin = {
  rootExecutionId: "exec_root_1",
  executionId: "exec_1",
  workflow: { name: "triage-workflow", version: "1.0.0" },
  step: { component: "triage-agent", idempotencyKey: "step_mesh_1", tool: "search-catalog-tool" },
} as const;
const triageHop = { application: TRIAGE, start: "triage-workflow-start", executionId: "exec_1" } as const;

/** The `X-AGBoss-Mesh` header the gateway's HTTP client signs every request with: this request's method, path and body. */
function meshHeader(key: KeyObject, issuedAt: Date, request: { method: string; url: URL; body: string }): string {
  const encode = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  const input = `${encode({ alg: "EdDSA", typ: "agboss-mesh-http" })}.${encode({
    issuer: TRIAGE,
    audience: "catalog-application",
    origin: request.url.origin,
    jti: randomBytes(16).toString("base64url"),
    method: request.method.toUpperCase(),
    path: `${request.url.pathname}${request.url.search}`,
    bodyHash: `sha256:${createHash("sha256").update(request.body).digest("hex")}`,
    issuedAt: issuedAt.toISOString(),
    expiresIn: "PT60S",
  })}`;
  return `${input}.${sign(null, Buffer.from(input, "utf8"), key).toString("base64url")}`;
}

/** An MCP client of the catalog at `url`: the SDK's, with every request signed as the triage gateway (or by `key`, a forger's). */
async function peerClient(url: string, issuedAt: () => Date, key: KeyObject = SIGNING_KEY): Promise<Client> {
  const signedFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set(
      "X-AGBoss-Mesh",
      meshHeader(key, issuedAt(), {
        method: init?.method ?? "GET",
        url: new URL(input instanceof Request ? input.url : input),
        body: typeof init?.body === "string" ? init.body : "",
      }),
    );
    return fetch(input, { ...init, headers });
  };
  const client = new Client({ name: "triage-gateway", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { fetch: signedFetch }));
  return client;
}

interface ToolResult {
  readonly isError?: boolean;
  readonly structuredContent?: unknown;
  readonly _meta?: Record<string, { readonly code?: string } | undefined>;
}

describe("Catalog over MCP (mcpHttpListener): the endpoint, its callers and the mesh", () => {
  it("an unknown caller is refused with 401 before anything of it is read as MCP", async () => {
    const { url } = await servedCatalog();

    const noKey = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const wrongKey = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer nope" },
      body: "{}",
    });

    expect(noKey.status).toBe(401);
    expect(wrongKey.status).toBe(401);
  });

  it("an external client with a known key lists the endpoint's tools", async () => {
    const { url } = await servedCatalog();
    const client = new Client({ name: "claude-desktop", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: { authorization: "Bearer key-catalog-reader" } },
      }),
    );

    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name)).toEqual(["lookup-sku-tool", "catalog-workflow-start", "resume_workflow"]);
    await client.close();
  });

  it(
    "a signed peer's repeated _meta.callId is one call: the catalog runs once and the second answer is the kept one",
    async () => {
      resetCatalogExecutionCount();
      const { url } = await servedCatalog();
      const client = await peerClient(url, now);
      const mesh = signedMeshEnvelope({
        issuer: TRIAGE,
        audience: "catalog-application",
        signingKey: SIGNING_KEY,
        body: JSON.stringify(toolArgs),
        issuedAt: now(),
        origin,
        callChain: [triageHop],
      });
      const call = (): Promise<ToolResult> =>
        client.callTool({
          name: "lookup-sku-tool",
          arguments: toolArgs,
          _meta: { callId: "step_idem_sku_900", "agboss.dev/mesh": mesh },
        }) as Promise<ToolResult>;

      const first = await call();
      expect(getCatalogExecutionCount()).toBe(1);
      const second = await call();

      expect(getCatalogExecutionCount()).toBe(1);
      expect(first.isError).not.toBe(true);
      expect(second.structuredContent).toEqual(first.structuredContent);
      await client.close();
    },
  );

  it(
    "a forged envelope signature is mesh.signature-invalid, a chain through this tool is limit.mesh-loop and a long one limit.hops: nothing runs",
    async () => {
      resetCatalogExecutionCount();
      const { url } = await servedCatalog();
      const client = await peerClient(url, now);
      const envelope = (signingKey: KeyObject | string, callChain: readonly { application: string; start: string; executionId: string }[]): string =>
        signedMeshEnvelope({
          issuer: TRIAGE,
          audience: "catalog-application",
          signingKey,
          body: JSON.stringify(toolArgs),
          issuedAt: now(),
          origin,
          callChain,
        });
      const callWith = async (mesh: string): Promise<ToolResult> =>
        (await client.callTool({
          name: "lookup-sku-tool",
          arguments: toolArgs,
          _meta: { "agboss.dev/mesh": mesh },
        })) as ToolResult;
      const attacker = generateKeyPairSync("ed25519").privateKey;

      const forged = await callWith(envelope(attacker, [triageHop]));
      // a chain that already passed through this tool: the loop guard refuses before anything runs
      const loop = await callWith(
        envelope(SIGNING_KEY, [{ application: "catalog-application", start: "lookup-sku-tool", executionId: "exec_loop_1" }, triageHop]),
      );
      // three hops already: the catalog's maxHops is 3
      const hops = await callWith(
        envelope(SIGNING_KEY, [
          { application: "ingress-application", start: "ingress-start", executionId: "exec_hop_1" },
          { application: "router-application", start: "router-start", executionId: "exec_hop_2" },
          triageHop,
        ]),
      );

      expect(forged.isError).toBe(true);
      expect(forged._meta?.["agboss.dev/error"]?.code).toBe("mesh.signature-invalid");
      expect(loop.isError).toBe(true);
      expect(loop._meta?.["agboss.dev/error"]?.code).toBe("limit.mesh-loop");
      expect(hops.isError).toBe(true);
      expect(hops._meta?.["agboss.dev/error"]?.code).toBe("limit.hops");
      expect(getCatalogExecutionCount()).toBe(0);
      await client.close();
    },
  );

  it("a request whose X-AGBoss-Mesh header is signed by a stranger's key is 401 mesh.signature-invalid", async () => {
    const { url } = await servedCatalog();
    const stranger = generateKeyPairSync("ed25519").privateKey;
    const body = "{}";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-AGBoss-Mesh": meshHeader(stranger, now(), { method: "POST", url: new URL(url), body }),
      },
      body,
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "mesh.signature-invalid" });
  });
});

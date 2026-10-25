import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createApp,
  ExecutionStatus,
  HopsLimitExceededError,
  MeshLoopDetectedError,
  type MeshEnvelope,
} from "agboss";
import { A2AClient, a2aHttpListener } from "agboss/a2a";
import { callTool, testWith } from "agboss/testing";
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
  MeshLoopFallbackWorkflowFinish,
  TriageAgent,
  TriageGatewayApplication,
  TriageWorkflowStart,
} from "../triage-gateway/triage.application.js";

const billingTest = testWith(BillingApplication);
const triageTest = testWith(TriageGatewayApplication, {
  allowNetwork: ["127.0.0.1"],
});

const openServers: Server[] = [];

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

describe("Enterprise Agent Mesh — Loop Detection, Hop Limits & Ed25519 Verification (EX-16 / EX-17)", () => {
  billingTest(
    "rejects forged Ed25519 mesh signatures with 401 mesh.signature-invalid before executing",
    async ({ a2aServer }) => {
      const server = await a2aServer({
        expose: BillingA2AExpose,
        callerResolver: BillingA2aCallerResolver,
      });

      const attackerKeys = generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      const forgedEnvelope: MeshEnvelope = {
        schema: 1,
        issuer: "triage-gateway-application",
        audience: "billing-application",
        origin: {
          rootExecutionId: "exec_root_1",
          executionId: "exec_1",
          workflow: { name: "triage-workflow", version: "1.0.0" },
          step: {
            component: "triage-agent",
            idempotencyKey: "step_forged_1",
            tool: "ask-billing-tool",
          },
        },
        callChain: [
          {
            application: "triage-gateway-application",
            start: "triage-workflow-start",
            executionId: "exec_1",
          },
        ],
        issuedAt: new Date().toISOString(),
        expiresIn: "PT60S",
      };

      const res = await fetch(`${server.url}/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer key-acme",
          "agboss-mesh": encodeSignedMeshJws(
            forgedEnvelope,
            attackerKeys.privateKey,
          ),
        },
        body: JSON.stringify({
          input: { invoiceId: "INV-5001", question: "Forged mesh request" },
        }),
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("mesh.signature-invalid");
    },
  );

  billingTest(
    "throws MeshLoopDetectedError and HopsLimitExceededError when callChain loops or exceeds maxMeshHops",
    async ({ a2aServer }) => {
      const server = await a2aServer({
        expose: BillingA2AExpose,
        callerResolver: BillingA2aCallerResolver,
      });

      const loopEnvelope: MeshEnvelope = {
        schema: 1,
        issuer: "triage-gateway-application",
        audience: "billing-application",
        origin: {
          rootExecutionId: "exec_root_loop",
          executionId: "exec_loop_2",
          workflow: { name: "triage-workflow", version: "1.0.0" },
          step: {
            component: "triage-agent",
            idempotencyKey: "step_loop_1",
            tool: "ask-billing-tool",
          },
        },
        callChain: [
          {
            application: "billing-application",
            start: "billing-workflow-start",
            executionId: "exec_loop_1",
          },
          {
            application: "triage-gateway-application",
            start: "triage-workflow-start",
            executionId: "exec_loop_2",
          },
        ],
      };

      const loopClient = new A2AClient<BillingInquiryDto, BillingResolutionDto>({
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
          "agboss-mesh": encodeUnsignedMeshJws(loopEnvelope),
        },
      });

      await expect(
        loopClient.execute({
          invoiceId: "INV-5001",
          question: "Cyclic A->B->A call",
        }),
      ).rejects.toThrow(MeshLoopDetectedError);

      const hopsEnvelope: MeshEnvelope = {
        schema: 1,
        issuer: "triage-gateway-application",
        audience: "billing-application",
        origin: {
          rootExecutionId: "exec_root_hops",
          executionId: "exec_hop_3",
          workflow: { name: "triage-workflow", version: "1.0.0" },
          step: {
            component: "triage-agent",
            idempotencyKey: "step_hops_1",
            tool: "ask-billing-tool",
          },
        },
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
      };

      const hopsClient = new A2AClient<BillingInquiryDto, BillingResolutionDto>({
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
          "agboss-mesh": encodeUnsignedMeshJws(hopsEnvelope),
        },
      });

      await expect(
        hopsClient.execute({
          invoiceId: "INV-5001",
          question: "Exceeds maxMeshHops: 3",
        }),
      ).rejects.toThrow(HopsLimitExceededError);
    },
  );

  triageTest(
    "routes TriageWorkflow to MeshLoopFallbackWorkflowFinish via .onError(MeshLoopDetectedError, ...)",
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

      const loopEnvelope: MeshEnvelope = {
        schema: 1,
        issuer: "triage-gateway-application",
        audience: "billing-application",
        origin: {
          rootExecutionId: "exec_root_loop",
          executionId: "exec_loop_2",
          workflow: { name: "triage-workflow", version: "1.0.0" },
          step: {
            component: "triage-agent",
            idempotencyKey: "step_loop_1",
            tool: "ask-billing-tool",
          },
        },
        callChain: [
          {
            application: "billing-application",
            start: "billing-workflow-start",
            executionId: "exec_loop_1",
          },
        ],
      };

      configureTriageMeshTarget({
        billingUrl: `http://127.0.0.1:${String(port)}/a2a`,
        apiKey: "key-acme",
        extraHeaders: {
          "agboss-mesh": encodeUnsignedMeshJws(loopEnvelope),
        },
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

      await billingApp.close();
    },
  );
});

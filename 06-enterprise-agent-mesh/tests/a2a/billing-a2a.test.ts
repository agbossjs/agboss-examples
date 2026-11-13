import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { TaskState, Role, type Message } from "@a2a-js/sdk";
import {
  ClientFactory,
  ClientFactoryOptions,
  DefaultAgentCardResolver,
  JsonRpcTransportFactory,
} from "@a2a-js/sdk/client";
import { A2A_MESH_EXTENSION, A2A_SKILLS_EXTENSION } from "@agboss/core/a2a";
import type { MeshEnvelope } from "@agboss/core";
import { testWith } from "@agboss/core/testing";
import { describe, expect } from "vitest";
import {
  BillingA2AExpose,
  BillingA2aCallerResolver,
  BillingApplication,
} from "../../apps/2-billing-a2a/src/billing.application.js";

const billingTest = testWith(BillingApplication);
const billing = {
  expose: BillingA2AExpose,
  callerResolver: BillingA2aCallerResolver,
};
const inquiry = { invoiceId: "INV-5001", question: "Check SLA credit" };

interface Card {
  readonly name: string;
  readonly capabilities: {
    readonly streaming?: boolean;
    readonly extensions?: readonly {
      uri: string;
      params?: Record<string, unknown>;
    }[];
  };
  readonly skills: readonly { id: string; tags: readonly string[] }[];
  readonly securitySchemes: Record<string, unknown>;
  readonly supportedInterfaces: readonly {
    url: string;
    protocolBinding: string;
  }[];
}

/** The `Authorization` header of the billing resolver's known key. */
const AUTH = { authorization: "Bearer key-acme" };

describe("Billing over A2A v1.0: its Agent Card", () => {
  billingTest(
    "the card names the skill, the extensions, the bearer scheme and its URL",
    async ({ a2aServer }) => {
      const { url } = await a2aServer(billing);

      const response = await fetch(`${url}/.well-known/agent-card.json`);
      const card = (await response.json()) as Card;

      expect(response.status).toBe(200);
      expect(card.name).toBe("billing-a2a-expose");
      expect(
        card.skills.map((skill) => ({ id: skill.id, tags: skill.tags })),
      ).toEqual([
        { id: "billing-workflow-start", tags: ["billing", "invoices", "sla"] },
      ]);
      expect(card.capabilities.streaming).toBe(true);
      const extensions = card.capabilities.extensions ?? [];
      expect(extensions.map((extension) => extension.uri).sort()).toEqual(
        [A2A_MESH_EXTENSION, A2A_SKILLS_EXTENSION].sort(),
      );
      expect(
        extensions.find((extension) => extension.uri === A2A_MESH_EXTENSION)
          ?.params,
      ).toEqual({
        idempotencyRetention: "PT86400S",
        messageIdempotencyRetention: "PT900S",
      });
      expect(Object.keys(card.securitySchemes)).toHaveLength(1);
      expect(card.supportedInterfaces).toEqual([
        expect.objectContaining({ url, protocolBinding: "JSONRPC" }),
      ]);
    },
  );
});

describe("Billing over A2A v1.0: the official SDK client", () => {
  billingTest(
    "discovers the card and runs a task to COMPLETED with the finish's output",
    async ({ a2aServer }) => {
      const { url } = await a2aServer(billing);
      // the billing resolver wants its bearer key on every request, the card's too
      const fetchImpl: typeof fetch = (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("authorization", AUTH.authorization);
        return fetch(input, { ...init, headers });
      };
      const options = ClientFactoryOptions.createFrom(
        ClientFactoryOptions.default,
        {
          transports: [new JsonRpcTransportFactory({ fetchImpl })],
          cardResolver: new DefaultAgentCardResolver({ fetchImpl }),
        },
      );
      const client = await new ClientFactory(options).createFromUrl(url);
      const message: Message = {
        messageId: "interop-1",
        role: Role.ROLE_USER,
        parts: [
          {
            content: { $case: "data", value: inquiry },
            metadata: undefined,
            filename: "",
            mediaType: "application/json",
          },
        ],
        contextId: "",
        taskId: "",
        metadata: undefined,
        extensions: [],
        referenceTaskIds: [],
      };

      const sent = await client.sendMessage({
        tenant: "",
        message,
        configuration: {
          acceptedOutputModes: [],
          taskPushNotificationConfig: undefined,
          returnImmediately: false,
        },
        metadata: undefined,
      });

      expect(sent).toMatchObject({
        status: { state: TaskState.TASK_STATE_COMPLETED },
        artifacts: [
          {
            parts: [
              {
                content: {
                  $case: "data",
                  value: expect.objectContaining({
                    invoiceId: "INV-5001",
                    creditedUsd: 45,
                  }),
                },
              },
            ],
          },
        ],
      });
    },
  );
});

describe("Billing over A2A v1.0: the inbound mesh checks", () => {
  /** One JSON-RPC `SendMessage` of the inquiry with `envelope` in the mesh entry. */
  async function sendWith(url: string, envelope: string): Promise<Response> {
    return fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "a2a-version": "1.0",
        "a2a-extensions": A2A_MESH_EXTENSION,
        ...AUTH,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "SendMessage",
        params: {
          message: {
            messageId: `m-${envelope.length}`,
            role: "ROLE_USER",
            parts: [{ data: inquiry, mediaType: "application/json" }],
            metadata: { [A2A_MESH_EXTENSION]: { envelope } },
          },
          configuration: { returnImmediately: true },
        },
      }),
    });
  }

  const origin: MeshEnvelope["origin"] = {
    rootExecutionId: "exec_root_1",
    executionId: "exec_1",
    workflow: { name: "triage-workflow", version: "1.0.0" },
    step: {
      component: "triage-agent",
      idempotencyKey: "step_1",
      tool: "ask-billing-tool",
    },
  };
  const hop = (application: string, executionId: string) => ({
    application,
    start: `${application}-start`,
    executionId,
  });
  const envelopeOf = (
    chain: MeshEnvelope["callChain"],
    signed: string | undefined,
  ): string => {
    const envelope: MeshEnvelope = {
      schema: 1,
      issuer: "triage-gateway-application",
      audience: "billing-application",
      origin,
      callChain: chain,
      issuedAt: new Date().toISOString(),
      expiresIn: "PT60S",
      bodyHash: "sha256:00",
    };
    const header = Buffer.from(
      JSON.stringify({
        alg: signed === undefined ? "none" : "EdDSA",
        typ: "agboss-mesh",
      }),
    ).toString("base64url");
    const payload = Buffer.from(JSON.stringify(envelope)).toString("base64url");
    if (signed === undefined) return `${header}.${payload}.`;
    const signature = sign(
      null,
      Buffer.from(`${header}.${payload}`),
      createPrivateKey(signed),
    );
    return `${header}.${payload}.${signature.toString("base64url")}`;
  };
  const keys = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  billingTest(
    "a forged signature is 401 mesh.signature-invalid, nothing runs",
    async ({ a2aServer }) => {
      const { url } = await a2aServer(billing);

      const response = await sendWith(
        url,
        envelopeOf([hop("triage-gateway-application", "e1")], keys.privateKey),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        code: "mesh.signature-invalid",
      });
    },
  );

  billingTest(
    "a chain through billing's own skill is a REJECTED task, limit.mesh-loop",
    async ({ a2aServer }) => {
      const { url } = await a2aServer(billing);

      const response = await sendWith(
        url,
        envelopeOf(
          [
            hop("billing-application", "e0"),
            hop("triage-gateway-application", "e1"),
          ].map((entry, index) =>
            index === 0 ? { ...entry, start: "billing-workflow-start" } : entry,
          ),
          undefined,
        ),
      );
      const body = (await response.json()) as {
        result: {
          task: {
            status: {
              state: string;
              message?: { metadata?: Record<string, { code?: string }> };
            };
          };
        };
      };

      expect(body.result.task.status.state).toBe("TASK_STATE_REJECTED");
      expect(
        body.result.task.status.message?.metadata?.[A2A_MESH_EXTENSION]?.code,
      ).toBe("limit.mesh-loop");
    },
  );

  billingTest(
    "a chain as long as maxMeshHops (3) is a REJECTED task, limit.hops",
    async ({ a2aServer }) => {
      const { url } = await a2aServer(billing);

      const response = await sendWith(
        url,
        envelopeOf(
          [
            hop("ingress-application", "h1"),
            hop("router-application", "h2"),
            hop("triage-gateway-application", "h3"),
          ],
          undefined,
        ),
      );
      const body = (await response.json()) as {
        result: {
          task: {
            status: {
              state: string;
              message?: { metadata?: Record<string, { code?: string }> };
            };
          };
        };
      };

      expect(body.result.task.status.state).toBe("TASK_STATE_REJECTED");
      expect(
        body.result.task.status.message?.metadata?.[A2A_MESH_EXTENSION]?.code,
      ).toBe("limit.hops");
    },
  );
});

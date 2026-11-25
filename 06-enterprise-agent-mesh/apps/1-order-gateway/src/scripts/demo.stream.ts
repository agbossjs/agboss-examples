import "./offline-keys.js";
import { createServer, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";
import { Role, type Message } from "@a2a-js/sdk";
import {
  ClientFactory,
  ClientFactoryOptions,
  DefaultAgentCardResolver,
  JsonRpcTransportFactory,
} from "@a2a-js/sdk/client";
import { createApp } from "@agboss/core";
import { A2A_SKILLS_EXTENSION, a2aHttpListener } from "@agboss/core/a2a";
import { BillingA2AEndpoint } from "../../../2-billing-a2a/src/a2a/billing.a2a-endpoint.js";
import { BillingLiveApplication } from "../../../2-billing-a2a/src/scripts/billing.live.app.js";
import { BillingHttpAuthenticator } from "../../../2-billing-a2a/src/a2a/billing.http-authenticator.js";

/**
 * Live only (`npm run demo:stream`, needs OPENROUTER_API_KEY): the invoice review runs on a real
 * model behind billing's A2A server, and the answer streams to this client over message/stream (SSE).
 * Without a key it only says so: `npm test` proves the same offline.
 */
const key = process.env.OPENROUTER_API_KEY;
if (key === undefined || key === "" || key === "offline-test-openrouter-api-key") {
  process.stdout.write("demo:stream skipped: set OPENROUTER_API_KEY to stream a live invoice review over A2A.\n");
} else {
  const app = await createApp(BillingLiveApplication);
  let listener: RequestListener = (_request, response) => {
    response.writeHead(503).end();
  };
  const server = createServer((request, response) => {
    listener(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  listener = a2aHttpListener(app, {
    endpoint: BillingA2AEndpoint,
    authenticator: BillingHttpAuthenticator,
    publicUrl: url,
  });
  try {
    const withKey: typeof fetch = (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("authorization", "Bearer key-acme");
      return fetch(input, { ...init, headers });
    };
    const client = await new ClientFactory(
      ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
        transports: [new JsonRpcTransportFactory({ fetchImpl: withKey })],
        cardResolver: new DefaultAgentCardResolver({ fetchImpl: withKey }),
      }),
    ).createFromUrl(url);
    const message: Message = {
      messageId: "live-review-1",
      role: Role.ROLE_USER,
      parts: [
        {
          content: { $case: "data", value: { question: "Invoice INV-5001: is the SLA credit right?" } },
          metadata: undefined,
          filename: "",
          mediaType: "application/json",
        },
        {
          content: { $case: "raw", value: Buffer.from("sku,qty,unit_usd\nGPU rack,2,18000\nSupport plan,1,4500\nRack install,3,1000\n") },
          metadata: undefined,
          filename: "invoice.csv",
          mediaType: "text/csv",
        },
      ],
      contextId: "",
      taskId: "",
      metadata: { [A2A_SKILLS_EXTENSION]: { skill: "invoice-review-workflow-start" } },
      extensions: [],
      referenceTaskIds: [],
    };
    const startedAt = performance.now();
    const arrivals: { ms: number; event: string }[] = [];
    for await (const { payload } of client.sendMessageStream({
      tenant: "",
      message,
      configuration: { acceptedOutputModes: [], taskPushNotificationConfig: undefined, returnImmediately: false },
      metadata: undefined,
    })) {
      const ms = Math.round(performance.now() - startedAt);
      if (payload?.$case === "artifactUpdate") {
        const text = payload.value.artifact?.parts.map((part) => (part.content?.$case === "text" ? part.content.value : "")).join("") ?? "";
        arrivals.push({ ms, event: `artifact append=${String(payload.value.append)} last=${String(payload.value.lastChunk)} ${JSON.stringify(text)}` });
      } else if (payload?.$case === "statusUpdate" || payload?.$case === "task") {
        arrivals.push({ ms, event: `${payload.$case} state=${String(payload.value.status?.state)}` });
      }
    }
    process.stdout.write(`${JSON.stringify({ events: arrivals.length, arrivals }, null, 2)}\n`);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    await app.close();
  }
}

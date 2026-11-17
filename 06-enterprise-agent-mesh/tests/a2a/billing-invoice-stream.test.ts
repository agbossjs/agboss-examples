import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { TaskState, type StreamResponse } from "@a2a-js/sdk";
import { createApp, type App } from "@agboss/core";
import { a2aHttpListener } from "@agboss/core/a2a";
import { afterEach, describe, expect, it } from "vitest";
import {
  BillingA2AExpose,
  BillingA2aCallerResolver,
  BillingApplication,
} from "../../apps/2-billing-a2a/src/billing.application.js";
import { chunkOf, INVOICE_CSV, INVOICE_TOTAL, reviewRequest, sdkClientOf, shownAfter } from "./billing-wire.js";

/**
 * The real path, no scripted model: billing's own offline stand-in model reads the CSV the framework
 * showed it and answers word by word, so the answer streams as several chunks over SSE.
 */
const ANSWER = `INV-5001 has 3 line items totalling ${INVOICE_TOTAL} USD, so the SLA credit can be checked against that total.`;

let app: App | undefined;
let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (server === undefined) return resolve();
    server.close(() => {
      resolve();
    });
  });
  await app?.close();
  app = undefined;
  server = undefined;
});

/** Billing served on 127.0.0.1, its Agent Card naming the URL it is reached at. */
async function serveBilling(): Promise<string> {
  app = await createApp(BillingApplication);
  let listener: RequestListener = (_request, response) => {
    response.writeHead(503).end();
  };
  server = createServer((request, response) => {
    listener(request, response);
  });
  const live = server;
  await new Promise<void>((resolve) => live.listen(0, "127.0.0.1", resolve));
  const { port } = live.address() as AddressInfo;
  listener = a2aHttpListener(app, {
    expose: BillingA2AExpose,
    callerResolver: BillingA2aCallerResolver,
    publicUrl: `http://127.0.0.1:${String(port)}`,
  });
  return `http://127.0.0.1:${String(port)}`;
}

describe("The invoice review streams token by token over A2A message/stream", () => {
  it("the answer arrives as many chunks while the task is WORKING, and ends as the answer once", async () => {
    const client = await sdkClientOf(await serveBilling());

    const events: StreamResponse[] = [];
    const stateAtChunk: (TaskState | undefined)[] = [];
    for await (const event of client.sendMessageStream(reviewRequest("stream-1"))) {
      events.push(event);
      if (chunkOf(event) !== undefined && event.payload?.$case === "artifactUpdate") {
        const task = await client.getTask({ tenant: "", id: event.payload.value.taskId, historyLength: undefined });
        stateAtChunk.push(task.status?.state);
      }
    }

    const chunks = events.flatMap((event) => chunkOf(event) ?? []);
    const words = chunks.filter((chunk) => chunk.append);
    // several chunks, the first one starts the artifact, the next ones extend it
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks[0]?.append).toBe(false);
    expect(words.length).toBeGreaterThan(4);
    // the answer is worked out of the CSV the agent was sent as a file part
    expect(shownAfter(chunks)).toBe(ANSWER);
    // each chunk was read while the task still worked: it streamed, it was not replayed after the end
    expect(stateAtChunk.length).toBeGreaterThan(5);
    expect(stateAtChunk.slice(0, 3)).toEqual(Array(3).fill(TaskState.TASK_STATE_WORKING));
    // only the answer: the judge's note never reached the stream, in a chunk or a status
    expect(JSON.stringify(events)).not.toContain("audit note");
    const last = events.at(-1);
    expect(last?.payload?.$case === "statusUpdate" && last.payload.value.status?.state).toBe(
      TaskState.TASK_STATE_COMPLETED,
    );
  }, 20_000);

  it("a second invoice gets its own total: the answer follows the file, not a canned text", async () => {
    const client = await sdkClientOf(await serveBilling());
    const small = "sku,qty,unit_usd\nSupport plan,2,250\n";

    const events: StreamResponse[] = [];
    for await (const event of client.sendMessageStream(reviewRequest("stream-2", small))) events.push(event);

    expect(shownAfter(events.flatMap((event) => chunkOf(event) ?? []))).toContain("1 line items totalling 500.00 USD");
    expect(INVOICE_CSV).not.toBe(small);
  }, 20_000);
});

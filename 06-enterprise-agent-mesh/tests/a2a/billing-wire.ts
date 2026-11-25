import { Role, type Message, type Part, type StreamResponse } from "@a2a-js/sdk";
import {
  ClientFactory,
  ClientFactoryOptions,
  DefaultAgentCardResolver,
  JsonRpcTransportFactory,
  type Client,
} from "@a2a-js/sdk/client";
import { A2A_SKILLS_EXTENSION } from "@agboss/core/a2a";

/** The billing resolver's known API key: the bearer token of every request, the card's too. */
const BEARER = { authorization: "Bearer key-acme" };

/** The skill a message runs: billing has two, the invoice review is asked for by name. */
export const REVIEW_SKILL = "invoice-review-workflow-start";

/** An invoice as the customer's system exports it: sku, quantity, unit price in USD. */
export const INVOICE_CSV = "sku,qty,unit_usd\nGPU rack,2,18000\nSupport plan,1,4500\nRack install,3,1000\n";
/** What the CSV adds up to: 2 x 18000 + 4500 + 3 x 1000. */
export const INVOICE_TOTAL = "43500.00";
export const QUESTION = "Invoice INV-5001: is the SLA credit right?";

const fetchWithKey: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("authorization", BEARER.authorization);
  return fetch(input, { ...init, headers });
};

/** The official SDK's client of the billing agent at `url`: its card fetched, its key sent. */
export function sdkClientOf(url: string): Promise<Client> {
  const options = ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
    transports: [new JsonRpcTransportFactory({ fetchImpl: fetchWithKey })],
    cardResolver: new DefaultAgentCardResolver({ fetchImpl: fetchWithKey }),
  });
  return new ClientFactory(options).createFromUrl(url);
}

/** The streaming request of the invoice review: the question as data, the invoice as a file part. */
export function reviewRequest(messageId: string, csv: string = INVOICE_CSV) {
  const message: Message = {
    messageId,
    role: Role.ROLE_USER,
    parts: [
      {
        content: { $case: "data", value: { question: QUESTION } },
        metadata: undefined,
        filename: "",
        mediaType: "application/json",
      },
      {
        content: { $case: "raw", value: Buffer.from(csv) },
        metadata: undefined,
        filename: "invoice.csv",
        mediaType: "text/csv",
      },
    ],
    contextId: "",
    taskId: "",
    metadata: { [A2A_SKILLS_EXTENSION]: { skill: REVIEW_SKILL } },
    extensions: [],
    referenceTaskIds: [],
  };
  return {
    tenant: "",
    message,
    configuration: {
      acceptedOutputModes: [],
      taskPushNotificationConfig: undefined,
      returnImmediately: false,
    },
    metadata: undefined,
  };
}

/** The text of a part list, the text parts joined. */
const textOf = (parts: readonly Part[]): string =>
  parts.map((part) => (part.content?.$case === "text" ? part.content.value : "")).join("");

/** One chunk of the task's output artifact as the stream delivered it. */
export interface Chunk {
  readonly text: string;
  readonly append: boolean;
  readonly last: boolean;
}

export const chunkOf = (event: StreamResponse): Chunk | undefined =>
  event.payload?.$case === "artifactUpdate"
    ? {
        text: textOf(event.payload.value.artifact?.parts ?? []),
        append: event.payload.value.append,
        last: event.payload.value.lastChunk,
      }
    : undefined;

/** The text a client shows after applying every chunk as A2A v1.0 says: replace, or extend. */
export const shownAfter = (chunks: readonly Chunk[]): string =>
  chunks.reduce((shown, chunk) => (chunk.append ? shown + chunk.text : chunk.text), "");

/** A raw `SendMessage` JSON-RPC call, as a client without the SDK would make it. */
export async function rpc(url: string, params: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "a2a-version": "1.0", ...BEARER },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "SendMessage", params }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** The question as the one data part the skill's input is made of. */
export const questionPart = { data: { question: QUESTION }, mediaType: "application/json" };

/** The `SendMessage` params of the invoice review: the message's `parts` as given. */
export const reviewParams = (messageId: string, parts: readonly unknown[]) => ({
  message: {
    messageId,
    role: "ROLE_USER",
    parts,
    metadata: { [A2A_SKILLS_EXTENSION]: { skill: REVIEW_SKILL } },
  },
  configuration: { returnImmediately: false },
});

/** A `raw` file part as the JSON wire writes it. */
export const rawPart = (bytes: Uint8Array, mediaType: string, filename: string) => ({
  raw: Buffer.from(bytes).toString("base64"),
  mediaType,
  filename,
});

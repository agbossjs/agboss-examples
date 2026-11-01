import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import type { StubEvent } from "../stub/stub-gateway.types.js";

/** A running receiver: where the gateway posts, and how to stop it. */
export interface WebhookReceiver {
  readonly url: string;
  close(): Promise<void>;
}

const SIGNATURE_HEADER = "stub-signature";

/** Whether `signature` is `sha256=<HMAC-SHA256 of body under secret>` (compared in constant time). */
export function isSignedBy(secret: string, body: string, signature: string | undefined): boolean {
  if (signature === undefined) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The shop's webhook endpoint (PS15, PS16): checks the gateway's signature first — the
 * application's job, never the framework's — then hands the event to `onEvent` (which starts an
 * execution that applies it once). `200` when it was applied, `401` for a bad signature, `500`
 * when applying failed: the gateway delivers it again later.
 */
export async function startWebhookReceiver(
  secret: string,
  onEvent: (event: StubEvent, delivery: number) => Promise<unknown>,
): Promise<WebhookReceiver> {
  const counter = { delivery: 0 };
  const server = createServer((request, response) => {
    void (async () => {
      const body = await bodyOf(request);
      const signature = request.headers[SIGNATURE_HEADER];
      if (!isSignedBy(secret, body, typeof signature === "string" ? signature : undefined)) {
        response.writeHead(401).end();
        return;
      }
      counter.delivery += 1;
      try {
        await onEvent(JSON.parse(body) as StubEvent, counter.delivery);
        response.writeHead(200).end();
      } catch {
        response.writeHead(500).end();
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}/webhooks/stub`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

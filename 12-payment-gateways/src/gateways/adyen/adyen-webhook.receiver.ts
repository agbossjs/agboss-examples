// Independent example, not affiliated (see adyen.gateway-payments.ts).
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { hmacValidator } from "@adyen/api-library";
import type { App } from "@agboss/core";
import { GatewayEventWorkflowStart } from "../../workflows/gateway-event/gateway-event.workflow-start.js";

interface AdyenItem {
  readonly eventCode: string;
  readonly pspReference: string;
  readonly merchantReference: string;
  readonly amount: { readonly value: number };
  readonly additionalData?: Record<string, string>;
}

/**
 * The shop's Adyen webhook endpoint: checks each item's HMAC with the official library's
 * `hmacValidator`, then applies it once — a fenced effect under the event's own id
 * (`<pspReference>:<eventCode>`, the fields Adyen says a duplicate repeats). Answers `[accepted]`.
 */
export async function startAdyenWebhookReceiver(apps: readonly Pick<App, "execute">[], hmacKey: string): Promise<{ url: string; close: () => Promise<void> }> {
  const counter = { delivery: 0 };
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      void (async () => {
        const items = (JSON.parse(Buffer.concat(chunks).toString("utf8")) as { notificationItems: { NotificationRequestItem: AdyenItem }[] }).notificationItems;
        const app = apps[counter.delivery++ % apps.length];
        try {
          for (const { NotificationRequestItem: item } of items) {
            if (!new hmacValidator().validateHMAC(item as never, hmacKey)) throw new Error("bad HMAC");
            await app?.execute(GatewayEventWorkflowStart, { eventId: `${item.pspReference}:${item.eventCode}`, eventCode: item.eventCode, orderId: item.merchantReference, amountCents: item.amount.value });
          }
          response.writeHead(200).end("[accepted]");
        } catch {
          response.writeHead(500).end();
        }
      })();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}/webhooks/adyen`,
    close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => { resolve(); }); }),
  };
}

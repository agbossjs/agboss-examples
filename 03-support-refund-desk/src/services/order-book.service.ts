import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Injectable } from "@agboss/core";

export interface OrderRecord {
  readonly orderId: string;
  readonly tenantId: string;
  readonly customerEmail: string;
  readonly customerPhone: string;
  readonly ticketId: string;
  readonly item: string;
  readonly amountUsd: number;
  readonly daysSincePurchase: number;
  readonly status: string;
}

export interface RecordedToolOperation {
  readonly kind: "lookup" | "refund";
  readonly orderId: string;
  readonly tenantId: string;
  readonly receivedEmail: string;
  readonly amountUsd: number;
  readonly idempotencyKey: string;
}

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
const ORDERS_DATA: readonly OrderRecord[] = JSON.parse(
  readFileSync(join(FIXTURES_DIR, "orders.json"), "utf8"),
) as readonly OrderRecord[];

const recordedOperations: RecordedToolOperation[] = [];

export function getRecordedToolOperations(): readonly RecordedToolOperation[] {
  return [...recordedOperations];
}

export function resetRecordedToolOperations(): void {
  recordedOperations.length = 0;
}

@Injectable()
export class OrderBookService {
  findById(orderId: string): OrderRecord | undefined {
    return ORDERS_DATA.find((entry) => entry.orderId === orderId);
  }

  recordLookup(order: OrderRecord, receivedEmail: string, idempotencyKey: string): void {
    recordedOperations.push({
      kind: "lookup",
      orderId: order.orderId,
      tenantId: order.tenantId,
      receivedEmail,
      amountUsd: order.amountUsd,
      idempotencyKey,
    });
  }

  issueRefund(
    order: OrderRecord,
    receivedEmail: string,
    amountUsd: number,
    idempotencyKey: string,
  ): { refundId: string; status: string } {
    recordedOperations.push({
      kind: "refund",
      orderId: order.orderId,
      tenantId: order.tenantId,
      receivedEmail,
      amountUsd,
      idempotencyKey,
    });
    return {
      refundId: `REF-${order.orderId}-${recordedOperations.length}`,
      status: "refunded",
    };
  }
}

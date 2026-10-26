import { Injectable } from "@agboss/core";

@Injectable()
export class RefundApiService {
  issue(orderId: string, amountCents: number, idempotencyKey: string): Promise<string> {
    return Promise.resolve(`refund-${orderId}-${String(amountCents)}-${idempotencyKey}`);
  }
}

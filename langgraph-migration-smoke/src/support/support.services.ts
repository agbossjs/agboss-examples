import { Injectable } from "agboss";

@Injectable()
export class OrderBookService {
  factsOf(orderId: string): Promise<string> {
    return Promise.resolve(
      `order ${orderId}: delivered four days late; shipping fee 1500 cents ($15.00), eligible for a 1500 cents refund`,
    );
  }
}

@Injectable()
export class RefundApiService {
  issue(orderId: string, amountCents: number, idempotencyKey: string): Promise<string> {
    return Promise.resolve(`refund-${orderId}-${String(amountCents)}-${idempotencyKey}`);
  }
}

@Injectable()
export class SupervisorQueueService {
  notify(pauseId: string, text: string): Promise<void> {
    void pauseId;
    void text;
    return Promise.resolve();
  }
}

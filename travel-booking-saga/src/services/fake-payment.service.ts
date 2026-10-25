import { Injectable } from "agboss";
import { recordIdempotentOperation } from "./operation-ledger.service.js";
import { PaymentDeclinedError } from "./payment-declined.error.js";

export interface PaymentCaptureResult {
  readonly paymentTransactionId: string;
  readonly capturedAmountUsd: number;
}

@Injectable()
export class FakePaymentService {
  authorizeAndCapture(params: {
    readonly bookingId: string;
    readonly amountUsd: number;
    readonly simulateDecline: boolean;
    readonly idempotencyKey: string;
  }): PaymentCaptureResult {
    if (params.simulateDecline) {
      throw new PaymentDeclinedError(
        `Payment declined by issuer for booking ${params.bookingId}`,
      );
    }
    const paymentTransactionId = `PAY-${params.bookingId}`;
    return recordIdempotentOperation({
      service: "payments",
      operation: "authorize",
      resourceId: paymentTransactionId,
      idempotencyKey: params.idempotencyKey,
      nextResourceState: "AUTHORIZED",
      computeResult: () => ({
        paymentTransactionId,
        capturedAmountUsd: params.amountUsd,
      }),
    });
  }

  voidOrRefund(params: {
    readonly paymentTransactionId: string;
    readonly idempotencyKey: string;
  }): void {
    recordIdempotentOperation({
      service: "payments",
      operation: "void",
      resourceId: params.paymentTransactionId,
      idempotencyKey: params.idempotencyKey,
      nextResourceState: "VOIDED",
      computeResult: () => undefined,
    });
  }
}

import { Injectable, OutboundRecovery, Reconciliation } from "@agboss/core";
import { CALL_BOUNDS, PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../../src/payments/right-payment-operations.js";
import type { PaymentRefund } from "../../src/payments/payment-operations.js";
import type { StubMovement } from "../../src/stub/stub-gateway.types.js";

/**
 * A developer's own step that looks right — a `sendOnce` under the refund's business key — but
 * sends the refund without `call.idempotencyKey`. AGBoss never resends it blindly; when the refund's
 * answer is lost, the retry reaches the gateway as a new refund (AC3: PS19 turns red).
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class ForgotRefundKeyPaymentOperations extends RightPaymentOperations {
  override async refund(refund: PaymentRefund): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "refund",
      key: `refund:${refund.chargeId}:${String(refund.refundNumber)}`,
      target: "stub-gateway",
      operation: "refund",
      request: { chargeId: refund.chargeId, amountCents: refund.amountCents },
      ...CALL_BOUNDS,
      send: (call) => client.refund(refund.chargeId, refund.amountCents, { signal: call.signal }), // no key
      recovery: OutboundRecovery.permanentLookup<StubMovement>(() => Reconciliation.notExecuted()),
    });
    return result;
  }
}

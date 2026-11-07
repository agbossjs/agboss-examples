import { ExecutionContext, Injectable, NotSentTrust, OutboundCallReconciliation, effectKeyOf } from "@agboss/core";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../../src/payments/right-payment-operations.js";
import type { PaymentRefund } from "../../src/payments/payment-operations.js";
import type { StubMovement } from "../../src/stub/stub-gateway.types.js";

/**
 * A developer's own step that looks right — an outbound call under the refund's business key — but
 * sends the refund without `call.idempotencyKey`. AGBoss never resends it blindly; when the refund's
 * answer is lost, the retry reaches the gateway as a new refund (AC3: PS19 turns red).
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class ForgotRefundKeyPaymentOperations extends RightPaymentOperations {
  override async refund(executionContext: ExecutionContext, refund: PaymentRefund): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const key = effectKeyOf(executionContext, "refund", {
      businessKey: `refund:${refund.chargeId}:${String(refund.refundNumber)}`,
    });
    const { result } = await this.outboundCalls.send(key, {
      target: "stub-gateway",
      operation: "refund",
      request: { chargeId: refund.chargeId, amountCents: refund.amountCents },
      send: (call) => client.refund(refund.chargeId, refund.amountCents, { signal: call.signal }), // no key
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: () => OutboundCallReconciliation.notSent(),
    });
    return result;
  }
}

import { ExecutionContext, Injectable, NotSentTrust, OutboundCallReconciliation, effectKeyOf } from "@agboss/core";
import type { StubMovement } from "../../stub/stub-gateway.types.js";
import type { PaymentRefund } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";

/**
 * WRONG (PS19): each path that refunds builds its own key — here the step's. The operator's refund
 * whose answer was lost and the customer's request for the same refund are two keys: two refunds.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class KeyPerPathRefundPaymentOperations extends RightPaymentOperations {
  override async refund(executionContext: ExecutionContext, refund: PaymentRefund): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const { result } = await this.outboundCalls.send(effectKeyOf(executionContext, "refund"), {
      target: "stub-gateway",
      operation: "refund",
      request: { chargeId: refund.chargeId, amountCents: refund.amountCents },
      send: (call) =>
        client.refund(refund.chargeId, refund.amountCents, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: () => OutboundCallReconciliation.unknown({ reason: "no lookup" }),
    });
    return result;
  }
}

import { Injectable, OutboundRecovery, Reconciliation } from "@agboss/core";
import type { StubMovement } from "../../stub/stub-gateway.types.js";
import type { PaymentRefund } from "../payment-operations.js";
import { CALL_BOUNDS, PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";

/**
 * WRONG (PS19): each path that refunds builds its own key — here the step's (no business `key`). The operator's
 * refund whose answer was lost and the customer's request for the same refund are two keys: two refunds.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class KeyPerPathRefundPaymentOperations extends RightPaymentOperations {
  override async refund(refund: PaymentRefund): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "refund",
      target: "stub-gateway",
      operation: "refund",
      request: { chargeId: refund.chargeId, amountCents: refund.amountCents },
      ...CALL_BOUNDS,
      send: (call) =>
        client.refund(refund.chargeId, refund.amountCents, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      recovery: OutboundRecovery.permanentLookup<StubMovement>(() => Reconciliation.unknown("no lookup")),
    });
    return result;
  }
}

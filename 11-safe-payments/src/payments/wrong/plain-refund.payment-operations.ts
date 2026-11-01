import { ExecutionContext, Injectable } from "@agboss/core";
import type { StubMovement } from "../../stub/stub-gateway.types.js";
import type { PaymentRefund } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";

/**
 * WRONG (PS10): the undo refunds by a plain client call. The undo runs again when its holder dies
 * after the refund and before the undo is marked done: a second refund.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class PlainRefundPaymentOperations extends RightPaymentOperations {
  override refund(executionContext: ExecutionContext, refund: PaymentRefund): Promise<StubMovement> {
    return this.stubGatewayService.client().refund(refund.chargeId, refund.amountCents);
  }
}

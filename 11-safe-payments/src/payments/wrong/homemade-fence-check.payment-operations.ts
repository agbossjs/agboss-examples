import { ExecutionContext, Injectable } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

/**
 * WRONG (PS4): a homemade check — `fence.assertHeld()` — and then the call, in a second step of its
 * own. Between the two the holder can freeze, lose its lease and wake up: the check passed, the
 * call goes out anyway (a time-of-check to time-of-use gap).
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class HomemadeFenceCheckPaymentOperations extends RightPaymentOperations {
  override charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    executionContext.fence.assertHeld();
    return this.stubGatewayService.client().createCharge(chargeRequestOf(order));
  }
}

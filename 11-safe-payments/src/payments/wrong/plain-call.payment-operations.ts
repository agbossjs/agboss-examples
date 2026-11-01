import { ExecutionContext, Injectable } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

/**
 * WRONG (PS2, PS3): a plain client call in the step — no intent recorded, no fence, no key. A step
 * run again after a crash, or a frozen holder that wakes up, charges again.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class PlainCallPaymentOperations extends RightPaymentOperations {
  override charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    return this.stubGatewayService.client().createCharge(chargeRequestOf(order));
  }
}

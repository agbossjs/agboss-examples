import { randomUUID } from "node:crypto";
import { ExecutionContext, Injectable } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";

/**
 * WRONG (PS1, PS5, PS22): a plain call with a new idempotency key on every attempt — what a client
 * does when it makes up a key per request. The gateway cannot tell the retry from a new charge.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class NewKeyPerAttemptPaymentOperations extends RightPaymentOperations {
  override charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    return this.stubGatewayService.client().createCharge(chargeRequestOf(order), {
      idempotencyKey: randomUUID(), // and no signal: a zombie's call still goes out
    });
  }
}

/** The gateway's request for an order. */
export const chargeRequestOf = (order: ChargeOrder) => ({
  amountCents: order.amountCents,
  currency: "usd",
  reference: order.orderId,
  capture: order.capture,
  paymentMethod: order.paymentMethod,
});

import { randomUUID } from "node:crypto";
import { ExecutionContext, Injectable } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

/**
 * WRONG (PS14): "the write failed, so charge again". The database lost the connection after it
 * committed the charge's completion; the error is caught and the order charged again, a new key.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class RetryAfterStoreErrorPaymentOperations extends RightPaymentOperations {
  override async charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    try {
      return await super.charge(executionContext, order);
    } catch {
      return this.stubGatewayService.client().createCharge(chargeRequestOf(order), {
        idempotencyKey: randomUUID(),
      });
    }
  }
}

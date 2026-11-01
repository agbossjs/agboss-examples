import { ExecutionContext, Injectable } from "@agboss/core";
import { StubGatewayError } from "../../stub/stub-gateway.client.js";
import type { StubMovement } from "../../stub/stub-gateway.types.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";

/**
 * WRONG (PS20): the capture and the void are sent each on its own. The gateway refuses the void
 * of a captured authorization, the cancel takes that as "already cancelled", and the shop books the
 * order cancelled while the customer's money stays captured — never refunded.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class BothDispositionsPaymentOperations extends RightPaymentOperations {
  override settle(executionContext: ExecutionContext, chargeId: string, amountCents: number): Promise<StubMovement> {
    return this.stubGatewayService.client().capture(chargeId, amountCents);
  }

  override async void(executionContext: ExecutionContext, chargeId: string): Promise<StubMovement> {
    try {
      return await this.stubGatewayService.client().void(chargeId);
    } catch (error) {
      if (error instanceof StubGatewayError && error.status === 409)
        return { id: `void-of-${chargeId}`, chargeId, amountCents: 0, status: "succeeded" };
      throw error;
    }
  }
}

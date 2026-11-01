import { ExecutionContext, Injectable } from "@agboss/core";
import type { StubEvent } from "../../stub/stub-gateway.types.js";
import type { AppliedEvent } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations, firstShipmentOf } from "../right-payment-operations.js";

/**
 * WRONG (PS15, PS16): every delivery is applied as it comes. `charge.authorized` captures the first
 * shipment by a plain call on each delivery (a duplicate captures twice), and the order's status is
 * the event's payload — a refund that arrives before the payment's success ends "paid".
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class PayloadEventsPaymentOperations extends RightPaymentOperations {
  override async applyEvent(executionContext: ExecutionContext, event: StubEvent): Promise<AppliedEvent> {
    const client = this.stubGatewayService.client();
    const charge = await client.getCharge(event.chargeId);
    switch (event.type) {
      case "charge.authorized": {
        const amountCents = firstShipmentOf(charge.amountCents);
        await client.capture(event.chargeId, amountCents);
        return { orderId: event.reference, status: "captured", heldCents: amountCents };
      }
      case "charge.succeeded":
        return { orderId: event.reference, status: "paid", heldCents: charge.amountCents };
      case "refund.succeeded":
        return { orderId: event.reference, status: "refunded", heldCents: 0 };
    }
  }
}

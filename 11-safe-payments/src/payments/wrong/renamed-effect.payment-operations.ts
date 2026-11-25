import { Injectable, OutboundRecovery, Reconciliation } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder } from "../payment-operations.js";
import { CALL_BOUNDS, PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

/** Which version is deployed: the scenario rolls it out (PS12). */
export const deployment = { version: 1 };

/**
 * WRONG (PS12): version 2 renames the call (`charge-v2`). The same order under another name is
 * another key — to AGBoss and to the gateway: an order charged by version 1 is charged again.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class RenamedEffectPaymentOperations extends RightPaymentOperations {
  override async charge(order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const name = deployment.version === 1 ? "charge" : `charge-v${String(deployment.version)}`;
    const { result } = await this.idempotency.sendOnce({
      name,
      key: `order:${order.orderId}`,
      target: "stub-gateway",
      operation: "charge",
      request: chargeRequestOf(order),
      ...CALL_BOUNDS,
      send: (call) => client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      recovery: OutboundRecovery.permanentLookup<StubCharge>(() => Reconciliation.unknown("no lookup")),
    });
    return result;
  }
}

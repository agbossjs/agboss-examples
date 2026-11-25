import { Injectable, OutboundRecovery } from "@agboss/core";
import { hours } from "@agboss/core/units";
import type { StubCharge } from "../stub/stub-gateway.types.js";
import type { ChargeOrder } from "./payment-operations.js";
import { CALL_BOUNDS, PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "./right-payment-operations.js";
import { chargeRequestOf } from "./wrong/new-key-per-attempt.payment-operations.js";

/**
 * RIGHT on a gateway whose only lookup is a replay of the key (PS17 d, `NoLookup`; Adyen): the call declares its
 * recovery a replay with the gateway's key retention (`OutboundRecovery.replayWithin`, #658, #795, #1325), so
 * AGBoss never sends that replay once the key may be gone.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class ReplayWithinRetentionPaymentOperations extends RightPaymentOperations {
  override async charge(order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "charge",
      key: `order:${order.orderId}`,
      target: "stub-gateway",
      operation: "charge",
      request: chargeRequestOf(order),
      ...CALL_BOUNDS,
      send: (call) => client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      recovery: OutboundRecovery.replayWithin(hours(24)), // the stub's documented retention
    });
    return result;
  }
}

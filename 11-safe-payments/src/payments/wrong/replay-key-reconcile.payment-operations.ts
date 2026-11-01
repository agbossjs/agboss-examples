import { ExecutionContext, Injectable, OutboundCallReconciliation, fencedEffectKeyOf } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

/**
 * A reconcile by the key alone: "send it again, the gateway will replay it" (`notSent()`). WRONG on
 * a gateway with a lookup (PS17 b): once the gateway forgot the key, the replay is a new charge —
 * the lookup by our reference, which does not expire, would have found it. On a gateway whose only
 * lookup IS the replay (PS17 d, `NoLookup`) it is the only answer — safe only while the key lives
 * (#658: AGBoss does not yet tell `reconcile` how old the attempt is).
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class ReplayKeyReconcilePaymentOperations extends RightPaymentOperations {
  override async charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const key = fencedEffectKeyOf(executionContext, "charge", { businessKey: `order:${order.orderId}` });
    const { result } = await this.outboundCalls.send(key, {
      target: "stub-gateway",
      operation: "charge",
      request: chargeRequestOf(order),
      send: (call) => client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      reconcile: () => OutboundCallReconciliation.notSent(),
    });
    return result;
  }
}

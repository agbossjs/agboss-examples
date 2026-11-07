import { ExecutionContext, Injectable, NotSentTrust, OutboundCallReconciliation, effectKeyOf } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

/**
 * A reconcile by the key alone: "send it again, the gateway will replay it" (`notSent()`). WRONG on
 * a gateway with a lookup (PS17 b): once the gateway forgot the key, the replay is a new charge —
 * the lookup by our reference, which does not expire, would have found it. On a gateway whose only
 * lookup IS the replay (PS17 d, `NoLookup`) it is the only answer — safe only while the key lives,
 * so the right wiring there declares it a replay with the key's retention
 * (`ReplayWithinRetentionPaymentOperations`, `NotSentTrust.KeyReplay`, #658); this one trusts it as
 * a lookup (`NotSentTrust.Lookup`, #795), at any age.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class ReplayKeyReconcilePaymentOperations extends RightPaymentOperations {
  override async charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const key = effectKeyOf(executionContext, "charge", { businessKey: `order:${order.orderId}` });
    const { result } = await this.outboundCalls.send(key, {
      target: "stub-gateway",
      operation: "charge",
      request: chargeRequestOf(order),
      send: (call) => client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // WRONG: a replay of the key trusted as a lookup, at any age (#795)
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: () => OutboundCallReconciliation.notSent(),
    });
    return result;
  }
}

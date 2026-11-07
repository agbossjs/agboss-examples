import { ExecutionContext, Injectable, NotSentTrust, OutboundCallReconciliation, effectKeyOf } from "@agboss/core";
import { hours } from "@agboss/core/units";
import type { StubCharge } from "../stub/stub-gateway.types.js";
import type { ChargeOrder } from "./payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "./right-payment-operations.js";
import { chargeRequestOf } from "./wrong/new-key-per-attempt.payment-operations.js";

/**
 * RIGHT on a gateway whose only lookup is a replay of the key (PS17 d, `NoLookup`; Adyen): reconcile
 * answers `notSent()` — the replay — and the call declares it one, with the gateway's key retention
 * (`NotSentTrust.KeyReplay`, `keyRetention`, #658, #795), so AGBoss never sends that replay once the
 * key may be gone.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class ReplayWithinRetentionPaymentOperations extends RightPaymentOperations {
  override async charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const key = effectKeyOf(executionContext, "charge", { businessKey: `order:${order.orderId}` });
    const { result } = await this.outboundCalls.send(key, {
      target: "stub-gateway",
      operation: "charge",
      request: chargeRequestOf(order),
      notSent: { trust: NotSentTrust.KeyReplay, keyRetention: hours(24) }, // the stub's documented retention
      send: (call) => client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      reconcile: () => OutboundCallReconciliation.notSent(),
    });
    return result;
  }
}

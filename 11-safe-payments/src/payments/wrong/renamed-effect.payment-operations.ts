import { ExecutionContext, Injectable, NotSentTrust, OutboundCallReconciliation, effectKeyOf } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

/** Which version is deployed: the scenario rolls it out (PS12). */
export const deployment = { version: 1 };

/**
 * WRONG (PS12): version 2 renames the call (`charge-v2`). The same order under another name is
 * another key — to AGBoss and to the gateway: an order charged by version 1 is charged again.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class RenamedEffectPaymentOperations extends RightPaymentOperations {
  override async charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const name = deployment.version === 1 ? "charge" : `charge-v${String(deployment.version)}`;
    const key = effectKeyOf(executionContext, name, { businessKey: `order:${order.orderId}` });
    const { result } = await this.outboundCalls.send(key, {
      target: "stub-gateway",
      operation: "charge",
      request: chargeRequestOf(order),
      send: (call) => client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: () => OutboundCallReconciliation.unknown({ reason: "no lookup" }),
    });
    return result;
  }
}

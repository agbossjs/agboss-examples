import { ExecutionContext, Injectable, OutboundCallReconciliation, fencedEffectKeyOf } from "@agboss/core";
import type { StubCharge, StubMovement } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder, PartialCapture } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

/**
 * WRONG (PS7, PS8, PS17 a, PS18): every call keyed by its step (`fencedEffectKeyOf(executionContext,
 * "charge")`) — safe against a step run again, but a second tool call, a second execution or a
 * second capture of the same shipment is a step of its own: a key of its own, a charge of its own.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class StepKeyedPaymentOperations extends RightPaymentOperations {
  override async charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const { result } = await this.outboundCalls.send(fencedEffectKeyOf(executionContext, "charge"), {
      target: "stub-gateway",
      operation: "charge",
      request: chargeRequestOf(order),
      send: (call) => client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      reconcile: () => OutboundCallReconciliation.unknown({ reason: "no lookup" }),
    });
    return result;
  }

  override async capture(executionContext: ExecutionContext, capture: PartialCapture): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const { result } = await this.outboundCalls.send(fencedEffectKeyOf(executionContext, "capture"), {
      target: "stub-gateway",
      operation: "capture",
      request: { chargeId: capture.chargeId, amountCents: capture.amountCents },
      send: (call) =>
        client.capture(capture.chargeId, capture.amountCents, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      reconcile: () => OutboundCallReconciliation.unknown({ reason: "no lookup" }),
    });
    return result;
  }
}

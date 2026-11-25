import { Injectable, OutboundRecovery, Reconciliation } from "@agboss/core";
import type { StubCharge, StubMovement } from "../../stub/stub-gateway.types.js";
import type { ChargeOrder, PartialCapture } from "../payment-operations.js";
import { CALL_BOUNDS, PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";

/**
 * WRONG (PS7, PS8, PS17 a, PS18): every call keyed by its step (`sendOnce` with no business `key`) —
 * safe against a step run again, but a second tool call, a second execution or a second capture of the same
 * shipment is a step of its own: a key of its own, a charge of its own.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class StepKeyedPaymentOperations extends RightPaymentOperations {
  override async charge(order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "charge",
      target: "stub-gateway",
      operation: "charge",
      request: chargeRequestOf(order),
      ...CALL_BOUNDS,
      send: (call) => client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      recovery: OutboundRecovery.permanentLookup<StubCharge>(() => Reconciliation.unknown("no lookup")),
    });
    return result;
  }

  override async capture(capture: PartialCapture): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "capture",
      target: "stub-gateway",
      operation: "capture",
      request: { chargeId: capture.chargeId, amountCents: capture.amountCents },
      ...CALL_BOUNDS,
      send: (call) =>
        client.capture(capture.chargeId, capture.amountCents, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      recovery: OutboundRecovery.permanentLookup<StubMovement>(() => Reconciliation.unknown("no lookup")),
    });
    return result;
  }
}

import { Idempotency, Injectable, OutboundRecovery, Reconciliation } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { OrderBookRepository } from "../repositories/order-book.repository.js";
import { OrderBookService } from "../services/order-book.service.js";
import { StubGatewayService } from "../services/stub-gateway.service.js";
import { StubGatewayError, type StubGatewayClient } from "../stub/stub-gateway.client.js";
import type { StubCharge, StubEvent, StubMovement } from "../stub/stub-gateway.types.js";
import {
  PaymentOperations,
  type AppliedEvent,
  type ChargeOrder,
  type PartialCapture,
  type PaymentRefund,
  type WalletCharge,
  WalletInsufficientError,
} from "../payments/payment-operations.js";

/** The gateway's target name, for operators (`app.pendingOutboundCallsOf`). */
const TARGET = "stub-gateway";

/** What bounds every call: one attempt, and how long its rows are kept (over the longest recovery of the scenarios). */
const CALL_BOUNDS = { timeout: seconds(15), ttl: hours(48) } as const;

/** The first shipment of an authorization, captured when the gateway says it is authorized (PS15). */
const firstShipmentOf = (amountCents: number): number => Math.ceil(amountCents / 2);

/** The status an order is booked with for a charge as the gateway shows it now (PS16). */
function orderStatusOf(charge: StubCharge): string {
  switch (charge.status) {
    case "authorized":
      return charge.capturedCents > 0 ? "captured" : "authorized";
    case "succeeded":
      return charge.capturedCents < charge.amountCents ? "captured" : "paid";
    case "refunded":
      return "refunded";
    case "voided":
      return "cancelled";
    case "requires_action":
    case "declined":
      return "new";
  }
}

/**
 * YOURS — "check your own gateway call": a copy of the right wiring to edit. Change how it calls
 * the gateway (your SDK, your keys, your lookup) and run `npm run check:yours`: every scenario's
 * right-version assertion runs with this class instead of `RightPaymentOperations`. A step that
 * forgets the idempotency key on a refund turns PS19 red (`tests/your-step.test.ts`).
 *
 * The right wiring (Wiki → Payments → How to wire a gateway): one `Idempotency.sendOnce` per money-moving
 * operation, keyed by a business key — `order:<id>`, `capture:<charge>:<n>`, `refund:<charge>:<n>`,
 * `disposition:<charge>` — its `call.idempotencyKey` sent to the gateway, and a `recovery` asking the
 * gateway what happened (never a blind resend). Events are applied by reading the charge's current
 * status, never the event's payload.
 */
/** What it is built from — add your SDK client's service here. */
const YOUR_DEPS = [Idempotency, StubGatewayService, OrderBookService, OrderBookRepository] as const;

@Injectable({ deps: YOUR_DEPS })
export class YourPaymentOperations extends PaymentOperations {
  constructor(
    protected readonly idempotency: Idempotency,
    protected readonly stubGatewayService: StubGatewayService,
    protected readonly orderBookService: OrderBookService,
    protected readonly orderBookRepository: OrderBookRepository,
  ) {
    super();
  }

  override async charge(order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "charge",
      // the order, not the step: a second tool call, a second execution, a new version — one charge
      key: `order:${order.orderId}`,
      target: TARGET,
      operation: "charge",
      // the fingerprint: the same order with another amount or card is a conflict, never a charge
      request: {
        amountCents: order.amountCents,
        currency: "usd",
        reference: order.orderId,
        capture: order.capture,
        paymentMethod: order.paymentMethod,
      },
      ...CALL_BOUNDS,
      send: (call) => client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // asked only when an earlier attempt's outcome is unknown: look it up by our reference, which does
      // not expire: its "not there" holds at any age (#795)
      recovery: OutboundRecovery.permanentLookup((lookup) => chargeOf(client, order, lookup.signal)),
    });
    return result;
  }

  override async chargeWallet(charge: WalletCharge): Promise<StubCharge> {
    // the aggregate's invariant is the application's (PS9): the draw on the wallet's row, in a
    // `runOnce` transaction — its CHECK refuses a balance below zero, once per part
    await this.orderBookService
      .once("wallet-draw", { businessKey: `draw:${charge.orderId}`, fingerprint: charge }, () => ({
        balanceCents: this.orderBookRepository.draw(charge.walletId, charge.amountCents),
      }))
      .catch((error: unknown) => {
        if (error instanceof Error && /CHECK constraint failed/u.test(error.message))
          throw new WalletInsufficientError(charge.walletId);
        throw error;
      });
    return this.charge({
      orderId: charge.orderId,
      amountCents: charge.amountCents,
      paymentMethod: "card_ok",
      capture: true,
    });
  }

  override async confirm(order: ChargeOrder, chargeId: string): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "confirm",
      key: `order:${order.orderId}`,
      target: TARGET,
      operation: "confirm",
      request: { chargeId },
      ...CALL_BOUNDS,
      send: (call) => client.confirm(chargeId, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // the charge's own status: a lookup (#795)
      recovery: OutboundRecovery.permanentLookup(async (lookup) => {
        const charge = await client.getCharge(chargeId, { signal: lookup.signal });
        return charge.status === "requires_action" ? Reconciliation.notExecuted() : Reconciliation.completed(charge);
      }),
    });
    return result;
  }

  override async capture(capture: PartialCapture): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "capture",
      // one key per shipment: a second execution capturing shipment 2 gets the first capture (PS18)
      key: `capture:${capture.chargeId}:${String(capture.shipment)}`,
      target: TARGET,
      operation: "capture",
      request: { chargeId: capture.chargeId, amountCents: capture.amountCents },
      ...CALL_BOUNDS,
      send: (call) =>
        client.capture(capture.chargeId, capture.amountCents, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // never asked: the recovery answers unknown (#795)
      recovery: OutboundRecovery.permanentLookup<StubMovement>(() =>
        Reconciliation.unknown("a capture has no lookup by shipment: check the charge"),
      ),
    });
    return result;
  }

  override settle(chargeId: string, amountCents: number): Promise<StubMovement> {
    return this.dispose(chargeId, "capture", amountCents);
  }

  override void(chargeId: string): Promise<StubMovement> {
    return this.dispose(chargeId, "void", 0);
  }

  override async refund(refund: PaymentRefund): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "refund",
      // one key for every path that refunds this payment: the undo, an operator, the customer (PS19)
      key: `refund:${refund.chargeId}:${String(refund.refundNumber)}`,
      target: TARGET,
      operation: "refund",
      request: { chargeId: refund.chargeId, amountCents: refund.amountCents },
      ...CALL_BOUNDS,
      send: (call) =>
        client.refund(refund.chargeId, refund.amountCents, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // the charge's refunds: its record, not the key (#795)
      recovery: OutboundRecovery.permanentLookup(async (lookup) => {
        const refunds = await client.refundsOf(refund.chargeId, { signal: lookup.signal });
        const found = refunds[refund.refundNumber - 1];
        return found === undefined ? Reconciliation.notExecuted() : Reconciliation.completed(found);
      }),
    });
    return result;
  }

  override async applyEvent(event: StubEvent): Promise<AppliedEvent> {
    const client = this.stubGatewayService.client();
    if (event.type === "charge.authorized") {
      // the event is a hint: read the authorization, capture its first shipment under its own key
      const charge = await client.getCharge(event.chargeId);
      await this.capture({
        chargeId: charge.chargeId,
        shipment: 1,
        amountCents: firstShipmentOf(charge.amountCents),
      });
    }
    // never the event's payload: the charge's status now, so a late or reordered event cannot
    // move the order back (PS16)
    const current = await client.getCharge(event.chargeId);
    return {
      orderId: current.reference,
      status: orderStatusOf(current),
      heldCents: current.capturedCents - current.refundedCents,
    };
  }

  /** One key for an authorization's outcome: a void and a capture of it are one disposition (PS20). */
  private async dispose(chargeId: string, action: "capture" | "void", amountCents: number): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const { result } = await this.idempotency.sendOnce({
      name: "disposition",
      key: `disposition:${chargeId}`,
      target: TARGET,
      operation: action,
      // the action is in the request, so in the fingerprint: the other action is a conflict
      request: { chargeId, action, amountCents },
      ...CALL_BOUNDS,
      send: (call) =>
        action === "capture"
          ? client.capture(chargeId, amountCents, { idempotencyKey: call.idempotencyKey, signal: call.signal })
          : client.void(chargeId, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // the charge's own status: a lookup (#795)
      recovery: OutboundRecovery.permanentLookup<StubMovement>(async (lookup) => {
        const charge = await client.getCharge(chargeId, { signal: lookup.signal });
        const done = action === "void" ? charge.status === "voided" : charge.capturedCents >= amountCents;
        return done
          ? Reconciliation.completed({ id: `${action}-of-${chargeId}`, chargeId, amountCents, status: "succeeded" as const })
          : Reconciliation.notExecuted();
      }),
    });
    return result;
  }
}

/**
 * What happened to an order's charge, by its reference: the charge (`completed`), none
 * (`notExecuted()`: send it again, under the same key), or `unknown` when the gateway has no lookup —
 * a person decides (PS5, PS6).
 */
async function chargeOf(client: StubGatewayClient, order: ChargeOrder, signal: AbortSignal): Promise<Reconciliation<StubCharge>> {
  let found: readonly StubCharge[];
  try {
    found = await client.findByReference(order.orderId, { signal });
  } catch (error) {
    if (error instanceof StubGatewayError && error.error === "not_supported")
      return Reconciliation.unknown("the gateway has no lookup by reference");
    throw error;
  }
  // every hit checked against this order — its reference and its amount: never another order's payment
  const charge = found.find((hit) => hit.reference === order.orderId && hit.amountCents === order.amountCents);
  return charge === undefined ? Reconciliation.notExecuted() : Reconciliation.completed(charge);
}

import {
  ExecutionContext,
  Injectable,
  NotSentTrust,
  OutboundCallReconciliation,
  OutboundCalls,
  effectKeyOf,
} from "@agboss/core";
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

/** The gateway's target name, for operators (`app.outboundCallsOf`). */
const TARGET = "stub-gateway";

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
 * The right wiring (Wiki → Payments → How to wire a gateway): one outbound call per money-moving
 * operation, keyed by a business key — `order:<id>`, `capture:<charge>:<n>`, `refund:<charge>:<n>`,
 * `disposition:<charge>` — its `call.idempotencyKey` sent to the gateway, and `reconcile` asking the
 * gateway what happened (never a blind resend). Events are applied by reading the charge's current
 * status, never the event's payload.
 */
/** What it is built from — add your SDK client's service here. */
const YOUR_DEPS = [OutboundCalls, StubGatewayService, OrderBookService, OrderBookRepository] as const;

@Injectable({ deps: YOUR_DEPS })
export class YourPaymentOperations extends PaymentOperations {
  constructor(
    protected readonly outboundCalls: OutboundCalls,
    protected readonly stubGatewayService: StubGatewayService,
    protected readonly orderBookService: OrderBookService,
    protected readonly orderBookRepository: OrderBookRepository,
  ) {
    super();
  }

  override async charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    // the order, not the step: a second tool call, a second execution, a new version — one charge
    const key = effectKeyOf(executionContext, "charge", { businessKey: `order:${order.orderId}` });
    const { result } = await this.outboundCalls.send(key, {
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
      send: (call) =>
        client.createCharge(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // asked only when an earlier attempt's outcome is unknown: look it up by our reference
      // by our reference, which does not expire: its "not there" holds at any age (#795)
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: (lookup) => chargeOf(client, order, lookup.signal),
    });
    return result;
  }

  override async chargeWallet(executionContext: ExecutionContext, charge: WalletCharge): Promise<StubCharge> {
    // the aggregate's invariant is the application's (PS9): the draw on the wallet's row, in a
    // fenced effect's transaction — its CHECK refuses a balance below zero, once per part
    await this.orderBookService
      .once(executionContext, "wallet-draw", `draw:${charge.orderId}`, (database) => ({
        balanceCents: this.orderBookRepository.draw(database, charge.walletId, charge.amountCents),
      }))
      .catch((error: unknown) => {
        if (error instanceof Error && /CHECK constraint failed/u.test(error.message))
          throw new WalletInsufficientError(charge.walletId);
        throw error;
      });
    return this.charge(executionContext, {
      orderId: charge.orderId,
      amountCents: charge.amountCents,
      paymentMethod: "card_ok",
      capture: true,
    });
  }

  override async confirm(
    executionContext: ExecutionContext,
    order: ChargeOrder,
    chargeId: string,
  ): Promise<StubCharge> {
    const client = this.stubGatewayService.client();
    const key = effectKeyOf(executionContext, "confirm", { businessKey: `order:${order.orderId}` });
    const { result } = await this.outboundCalls.send(key, {
      target: TARGET,
      operation: "confirm",
      request: { chargeId },
      send: (call) => client.confirm(chargeId, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // the charge's own status: a lookup (#795)
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: async (lookup) => {
        const charge = await client.getCharge(chargeId, { signal: lookup.signal });
        return charge.status === "requires_action"
          ? OutboundCallReconciliation.notSent()
          : OutboundCallReconciliation.completed(charge);
      },
    });
    return result;
  }

  override async capture(executionContext: ExecutionContext, capture: PartialCapture): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    // one key per shipment: a second execution capturing shipment 2 gets the first capture (PS18)
    const key = effectKeyOf(executionContext, "capture", {
      businessKey: `capture:${capture.chargeId}:${String(capture.shipment)}`,
    });
    const { result } = await this.outboundCalls.send(key, {
      target: TARGET,
      operation: "capture",
      request: { chargeId: capture.chargeId, amountCents: capture.amountCents },
      send: (call) =>
        client.capture(capture.chargeId, capture.amountCents, {
          idempotencyKey: call.idempotencyKey,
          signal: call.signal,
        }),
      // never asked: reconcile answers unknown (#795)
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: () =>
        OutboundCallReconciliation.unknown({ reason: "a capture has no lookup by shipment: check the charge" }),
    });
    return result;
  }

  override settle(executionContext: ExecutionContext, chargeId: string, amountCents: number): Promise<StubMovement> {
    return this.dispose(executionContext, chargeId, "capture", amountCents);
  }

  override void(executionContext: ExecutionContext, chargeId: string): Promise<StubMovement> {
    return this.dispose(executionContext, chargeId, "void", 0);
  }

  override async refund(executionContext: ExecutionContext, refund: PaymentRefund): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    // one key for every path that refunds this payment: the undo, an operator, the customer (PS19)
    const key = effectKeyOf(executionContext, "refund", {
      businessKey: `refund:${refund.chargeId}:${String(refund.refundNumber)}`,
    });
    const { result } = await this.outboundCalls.send(key, {
      target: TARGET,
      operation: "refund",
      request: { chargeId: refund.chargeId, amountCents: refund.amountCents },
      send: (call) =>
        client.refund(refund.chargeId, refund.amountCents, {
          idempotencyKey: call.idempotencyKey,
          signal: call.signal,
        }),
      // the charge's refunds: its record, not the key (#795)
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: async (lookup) => {
        const refunds = await client.refundsOf(refund.chargeId, { signal: lookup.signal });
        const found = refunds[refund.refundNumber - 1];
        return found === undefined
          ? OutboundCallReconciliation.notSent()
          : OutboundCallReconciliation.completed(found);
      },
    });
    return result;
  }

  override async applyEvent(executionContext: ExecutionContext, event: StubEvent): Promise<AppliedEvent> {
    const client = this.stubGatewayService.client();
    if (event.type === "charge.authorized") {
      // the event is a hint: read the authorization, capture its first shipment under its own key
      const charge = await client.getCharge(event.chargeId, { signal: executionContext.signal });
      await this.capture(executionContext, {
        chargeId: charge.chargeId,
        shipment: 1,
        amountCents: firstShipmentOf(charge.amountCents),
      });
    }
    // never the event's payload: the charge's status now, so a late or reordered event cannot
    // move the order back (PS16)
    const current = await client.getCharge(event.chargeId, { signal: executionContext.signal });
    return {
      orderId: current.reference,
      status: orderStatusOf(current),
      heldCents: current.capturedCents - current.refundedCents,
    };
  }

  /** One key for an authorization's outcome: a void and a capture of it are one disposition (PS20). */
  private async dispose(
    executionContext: ExecutionContext,
    chargeId: string,
    action: "capture" | "void",
    amountCents: number,
  ): Promise<StubMovement> {
    const client = this.stubGatewayService.client();
    const key = effectKeyOf(executionContext, "disposition", { businessKey: `disposition:${chargeId}` });
    const { result } = await this.outboundCalls.send(key, {
      target: TARGET,
      operation: action,
      // the action is in the request, so in the fingerprint: the other action is a conflict
      request: { chargeId, action, amountCents },
      send: (call) =>
        action === "capture"
          ? client.capture(chargeId, amountCents, { idempotencyKey: call.idempotencyKey, signal: call.signal })
          : client.void(chargeId, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // the charge's own status: a lookup (#795)
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: async (lookup) => {
        const charge = await client.getCharge(chargeId, { signal: lookup.signal });
        const done = action === "void" ? charge.status === "voided" : charge.capturedCents >= amountCents;
        return done
          ? OutboundCallReconciliation.completed({ id: `${action}-of-${chargeId}`, chargeId, amountCents, status: "succeeded" as const })
          : OutboundCallReconciliation.notSent();
      },
    });
    return result;
  }
}

/**
 * What happened to an order's charge, by its reference: the charge (`completed`), none
 * (`notSent()`: send it again, under the same key), or `unknown` when the gateway has no lookup —
 * a person decides (PS5, PS6).
 */
async function chargeOf(
  client: StubGatewayClient,
  order: ChargeOrder,
  signal: AbortSignal,
): Promise<OutboundCallReconciliation<StubCharge>> {
  let found: readonly StubCharge[];
  try {
    found = await client.findByReference(order.orderId, { signal });
  } catch (error) {
    if (error instanceof StubGatewayError && error.error === "not_supported")
      return OutboundCallReconciliation.unknown({ reason: "the gateway has no lookup by reference" });
    throw error;
  }
  // every hit checked against this order — its reference and its amount: never another order's payment
  const charge = found.find((hit) => hit.reference === order.orderId && hit.amountCents === order.amountCents);
  return charge === undefined
    ? OutboundCallReconciliation.notSent()
    : OutboundCallReconciliation.completed(charge);
}

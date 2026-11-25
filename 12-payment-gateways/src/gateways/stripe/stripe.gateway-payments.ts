// Independent example, not affiliated. Stripe is named only to identify its public API. AGBoss is
// not affiliated with, endorsed by or sponsored by Stripe; the name is its owner's trademark. This
// example follows Stripe's public documentation as read on 2026-11-01
// (https://docs.stripe.com/api/idempotent_requests). Gateways change their APIs and SDKs: check the
// official documentation before relying on it.
import { Idempotency, Injectable, OutboundRecovery, Reconciliation } from "@agboss/core";
import { hours } from "@agboss/core/units";
import Stripe from "stripe";
import { CALL_BOUNDS, GatewayPayments, type GatewayMovement, type GatewayOrder, type GatewayPayment, type GatewayRefund } from "../../gateway-payments.js";
import { GatewayStubService } from "../../services/gateway-stub.service.js";

const KEY_RETENTION = hours(24); // "Stripe retains keys for at least 24 hours"

/** A value inside a search query's quotes: "escape quotes inside of quotes with a backslash" (docs.stripe.com/search). */
const searchText = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");

/** Stripe's official SDK (`stripe`), its `host`/`port`/`protocol` options pointed at the stub. */
@Injectable({ deps: [Idempotency, GatewayStubService] })
export class StripeGatewayPayments extends GatewayPayments {
  constructor(
    private readonly idempotency: Idempotency,
    private readonly gatewayStubService: GatewayStubService,
  ) {
    super();
  }

  private stripe(): Stripe {
    const { hostname, port } = new URL(this.gatewayStubService.baseUrl());
    // no retries of the SDK's own: AGBoss decides every resend, under one key
    return new Stripe("sk_test_offline_placeholder", { host: hostname, port: Number(port), protocol: "http", maxNetworkRetries: 0 });
  }

  override async charge(order: GatewayOrder): Promise<GatewayPayment> {
    const stripe = this.stripe();
    const { result } = await this.idempotency.sendOnce({
      name: "charge",
      // the order, not the step: a second tool call or a second execution gets the first receipt
      key: `order:${order.orderId}`,
      target: "stripe", operation: "payment_intents.create",
      request: { amount: order.amountCents, currency: "usd", confirm: true, payment_method: "pm_card_visa", capture_method: order.capture ? "automatic" : "manual", metadata: { order_id: order.orderId } },
      ...CALL_BOUNDS,
      send: async (call) => paymentOf(await stripe.paymentIntents.create(call.request, { idempotencyKey: call.idempotencyKey })),
      // the search lags: what it does not find proves nothing, so a replay under the key is the recovery, refused past Stripe's retention (#658)
      recovery: OutboundRecovery.lookupWithin(KEY_RETENTION, async () => {
        // escaped (a quote or a backslash in an id cannot add a clause), every hit checked against this order
        const found = await stripe.paymentIntents.search({ query: `metadata['order_id']:'${searchText(order.orderId)}'` });
        const intent = found.data.find((hit) => hit.metadata["order_id"] === order.orderId && hit.amount === order.amountCents && hit.currency === "usd");
        return intent === undefined ? Reconciliation.notExecuted() : Reconciliation.completed(paymentOf(intent));
      }),
    });
    return result;
  }

  override async refund(refund: GatewayRefund): Promise<GatewayMovement> {
    const stripe = this.stripe();
    const { result } = await this.idempotency.sendOnce({
      name: "refund",
      key: `refund:${refund.paymentId}:${String(refund.refundNumber)}`,
      target: "stripe", operation: "refunds.create",
      request: { payment_intent: refund.paymentId, amount: refund.amountCents },
      ...CALL_BOUNDS,
      send: async (call) => movementOf(await stripe.refunds.create(call.request, { idempotencyKey: call.idempotencyKey })),
      // refunds.list is the payment's own record, no lag: its "not there" holds at any age (#795)
      recovery: OutboundRecovery.permanentLookup(async () => {
        const refunds = await stripe.refunds.list({ payment_intent: refund.paymentId });
        const found = refunds.data[refund.refundNumber - 1];
        return found === undefined ? Reconciliation.notExecuted() : Reconciliation.completed(movementOf(found));
      }),
    });
    return result;
  }
}

const paymentOf = (intent: Stripe.PaymentIntent): GatewayPayment => ({ paymentId: intent.id, amountCents: intent.amount, status: intent.status });
const movementOf = (refund: Stripe.Refund): GatewayMovement => ({ movementId: refund.id, status: refund.status ?? "pending" });

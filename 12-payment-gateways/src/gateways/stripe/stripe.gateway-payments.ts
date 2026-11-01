// Independent example, not affiliated. Stripe is named only to identify its public API. AGBoss is
// not affiliated with, endorsed by or sponsored by Stripe; the name is its owner's trademark. This
// example follows Stripe's public documentation as read on 2026-11-01
// (https://docs.stripe.com/api/idempotent_requests). Gateways change their APIs and SDKs: check the
// official documentation before relying on it.
import { ExecutionContext, Injectable, OutboundCallReconciliation, OutboundCalls, fencedEffectKeyOf } from "@agboss/core";
import Stripe from "stripe";
import { GatewayPayments, type GatewayMovement, type GatewayOrder, type GatewayPayment, type GatewayRefund } from "../../gateway-payments.js";
import { AttemptAgeService } from "../../services/attempt-age.service.js";
import { GatewayStubService } from "../../services/gateway-stub.service.js";

const KEY_RETENTION = 24 * 60 * 60 * 1000; // "Stripe retains keys for at least 24 hours"

/** A value inside a search query's quotes: "escape quotes inside of quotes with a backslash" (docs.stripe.com/search). */
const searchText = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");

/** Stripe's official SDK (`stripe`), its `host`/`port`/`protocol` options pointed at the stub. */
@Injectable({ deps: [OutboundCalls, GatewayStubService, AttemptAgeService] })
export class StripeGatewayPayments extends GatewayPayments {
  constructor(
    private readonly outboundCalls: OutboundCalls,
    private readonly gatewayStubService: GatewayStubService,
    private readonly attemptAgeService: AttemptAgeService,
  ) {
    super();
  }

  private stripe(): Stripe {
    const { hostname, port } = new URL(this.gatewayStubService.baseUrl());
    // no retries of the SDK's own: AGBoss decides every resend, under one key
    return new Stripe("sk_test_offline_placeholder", { host: hostname, port: Number(port), protocol: "http", maxNetworkRetries: 0 });
  }

  override async charge(executionContext: ExecutionContext, order: GatewayOrder): Promise<GatewayPayment> {
    const stripe = this.stripe();
    const businessKey = `order:${order.orderId}`;
    const startedAt = await this.attemptAgeService.startOf(executionContext, businessKey); // #658
    const { result } = await this.outboundCalls.send(fencedEffectKeyOf(executionContext, "charge", { businessKey }), {
      target: "stripe",
      operation: "payment_intents.create",
      request: { amount: order.amountCents, currency: "usd", confirm: true, payment_method: "pm_card_visa", capture_method: order.capture ? "automatic" : "manual", metadata: { order_id: order.orderId } },
      send: async (call) => paymentOf(await stripe.paymentIntents.create(call.request, { idempotencyKey: call.idempotencyKey })),
      reconcile: async () => {
        // escaped (a quote or a backslash in an id cannot add a clause), every hit checked against this order
        const found = await stripe.paymentIntents.search({ query: `metadata['order_id']:'${searchText(order.orderId)}'` });
        const intent = found.data.find((hit) => hit.metadata["order_id"] === order.orderId && hit.amount === order.amountCents && hit.currency === "usd");
        if (intent !== undefined) return OutboundCallReconciliation.completed(paymentOf(intent));
        // the search lags: empty is not "not sent" — a replay under the key is safe while Stripe keeps it
        return this.attemptAgeService.isWithin(startedAt, KEY_RETENTION)
          ? OutboundCallReconciliation.notSent()
          : OutboundCallReconciliation.unknown({ reason: "not in Stripe's search, and its key may be gone" });
      },
    });
    return result;
  }

  override async refund(executionContext: ExecutionContext, refund: GatewayRefund): Promise<GatewayMovement> {
    const stripe = this.stripe();
    const businessKey = `refund:${refund.paymentId}:${String(refund.refundNumber)}`;
    const { result } = await this.outboundCalls.send(fencedEffectKeyOf(executionContext, "refund", { businessKey }), {
      target: "stripe",
      operation: "refunds.create",
      request: { payment_intent: refund.paymentId, amount: refund.amountCents },
      send: async (call) => movementOf(await stripe.refunds.create(call.request, { idempotencyKey: call.idempotencyKey })),
      reconcile: async () => {
        const refunds = await stripe.refunds.list({ payment_intent: refund.paymentId });
        const found = refunds.data[refund.refundNumber - 1];
        return found === undefined ? OutboundCallReconciliation.notSent() : OutboundCallReconciliation.completed(movementOf(found));
      },
    });
    return result;
  }
}

const paymentOf = (intent: Stripe.PaymentIntent): GatewayPayment => ({ paymentId: intent.id, amountCents: intent.amount, status: intent.status });
const movementOf = (refund: Stripe.Refund): GatewayMovement => ({ movementId: refund.id, status: refund.status ?? "pending" });

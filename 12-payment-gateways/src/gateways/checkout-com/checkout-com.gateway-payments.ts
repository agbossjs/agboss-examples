// Independent example, not affiliated. Checkout.com is named only to identify its public API.
// AGBoss is not affiliated with, endorsed by or sponsored by Checkout.com; the name is its owner's
// trademark. This example follows Checkout.com's public documentation as read on 2026-11-01
// (https://www.checkout.com/docs/developer-resources/api/idempotency). Gateways change their APIs and
// SDKs: check the official documentation before relying on it.
import { ExecutionContext, Injectable, NotSentTrust, OutboundCallReconciliation, OutboundCalls, effectKeyOf } from "@agboss/core";
import { Checkout } from "checkout-sdk-node";
import { GatewayPayments, type GatewayCapture, type GatewayMovement, type GatewayOrder, type GatewayPayment, type GatewayRefund } from "../../gateway-payments.js";
import { GatewayStubService } from "../../services/gateway-stub.service.js";

interface CkoPayment { readonly id: string; readonly amount: number; readonly currency: string; readonly reference: string; readonly status: string }

/** The SDK's payments API as this wiring uses it (`checkout-sdk-node` ships loose types). */
interface CkoPayments {
  request(body: object, idempotencyKey: string): Promise<unknown>;
  getPaymentList(query: object): Promise<unknown>;
  getActions(id: string): Promise<unknown>;
  capture(id: string, body: object, idempotencyKey: string): Promise<unknown>;
  refund(id: string, body: object, idempotencyKey: string): Promise<unknown>;
}
interface CkoAction { readonly id: string; readonly type: string }

/** Checkout.com's official SDK (`checkout-sdk-node`), its `host` option pointed at the stub. */
@Injectable({ deps: [OutboundCalls, GatewayStubService] })
export class CheckoutComGatewayPayments extends GatewayPayments {
  constructor(
    private readonly outboundCalls: OutboundCalls,
    private readonly gatewayStubService: GatewayStubService,
  ) {
    super();
  }

  private cko(): { payments: CkoPayments } {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- the SDK's own types do not resolve under the type-aware lint
    return new Checkout("sk_sbox_offline_placeholder", { host: this.gatewayStubService.baseUrl() });
  }

  override async charge(executionContext: ExecutionContext, order: GatewayOrder): Promise<GatewayPayment> {
    const cko = this.cko();
    const key = effectKeyOf(executionContext, "charge", { businessKey: `order:${order.orderId}` });
    const { result } = await this.outboundCalls.send(key, {
      target: "checkout.com",
      operation: "payments.request",
      request: { source: { type: "id", id: "src_offline" }, amount: order.amountCents, currency: "USD", reference: order.orderId, capture: order.capture },
      send: async (call) => paymentOf((await cko.payments.request(call.request, call.idempotencyKey)) as CkoPayment),
      // the payments list by our reference does not expire: a lookup, not a replay (#795)
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: async () => {
        const { data } = (await cko.payments.getPaymentList({ reference: order.orderId })) as { data: CkoPayment[] };
        // a reference is not unique: every hit checked against this order — reference, amount, currency
        const found = data.find((hit) => hit.reference === order.orderId && hit.amount === order.amountCents && hit.currency === "USD");
        return found === undefined ? OutboundCallReconciliation.notSent() : OutboundCallReconciliation.completed(paymentOf(found));
      },
    });
    return result;
  }

  override capture(executionContext: ExecutionContext, capture: GatewayCapture): Promise<GatewayMovement> {
    const body = { amount: capture.amountCents, capture_type: "NonFinal" };
    return this.action(executionContext, "Capture", `capture:${capture.paymentId}:${String(capture.shipment)}`, capture.paymentId, capture.shipment, body);
  }

  override refund(executionContext: ExecutionContext, refund: GatewayRefund): Promise<GatewayMovement> {
    const body = { amount: refund.amountCents, reference: `${refund.orderId}-refund-${String(refund.refundNumber)}` };
    return this.action(executionContext, "Refund", `refund:${refund.paymentId}:${String(refund.refundNumber)}`, refund.paymentId, refund.refundNumber, body);
  }

  /** A capture or a refund: an outbound call under its business key; reconciled by the payment's actions. */
  private async action(executionContext: ExecutionContext, type: "Capture" | "Refund", businessKey: string, paymentId: string, n: number, body: { amount: number; capture_type?: string; reference?: string }): Promise<GatewayMovement> {
    const cko = this.cko();
    const { result } = await this.outboundCalls.send(effectKeyOf(executionContext, type.toLowerCase(), { businessKey }), {
      target: "checkout.com",
      operation: `payments.${type.toLowerCase()}`,
      request: body,
      send: async (call) => {
        const answer = (await (type === "Capture" ? cko.payments.capture(paymentId, call.request, call.idempotencyKey) : cko.payments.refund(paymentId, call.request, call.idempotencyKey))) as { action_id: string };
        return { movementId: answer.action_id, status: "accepted" };
      },
      // the payment's actions are its record: a lookup (#795)
      notSent: { trust: NotSentTrust.Lookup },
      reconcile: async () => {
        const actions = ((await cko.payments.getActions(paymentId)) as CkoAction[]).filter((action) => action.type === type);
        const found = actions[n - 1];
        return found === undefined ? OutboundCallReconciliation.notSent() : OutboundCallReconciliation.completed({ movementId: found.id, status: "accepted" });
      },
    });
    return result;
  }
}

const paymentOf = (payment: CkoPayment): GatewayPayment => ({ paymentId: payment.id, amountCents: payment.amount, status: payment.status });

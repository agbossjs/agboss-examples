// Independent example, not affiliated. PayPal is named only to identify its public API. AGBoss is
// not affiliated with, endorsed by or sponsored by PayPal; the name is its owner's trademark. This
// example follows PayPal's public documentation as read on 2026-11-01
// (https://developer.paypal.com/api/rest/reference/idempotency/). Gateways change their APIs and
// SDKs: check the official documentation before relying on it.
import { Client, Environment, OrdersController, PaymentsController, type Order } from "@paypal/paypal-server-sdk";
import { ExecutionContext, Injectable, OutboundCallReconciliation, OutboundCalls, fencedEffectKeyOf } from "@agboss/core";
import { GatewayPayments, type GatewayMovement, type GatewayOrder, type GatewayPayment, type GatewayRefund } from "../../gateway-payments.js";
import { GatewayStubService } from "../../services/gateway-stub.service.js";
import { StubTlsAgent } from "./paypal-stub-transport.js";

const capturesOf = (order: Order) => order.purchaseUnits?.[0]?.payments?.captures ?? [];

/** PayPal's official SDK (`@paypal/paypal-server-sdk`): money moves at the capture of an order created first. */
@Injectable({ deps: [OutboundCalls, GatewayStubService] })
export class PayPalGatewayPayments extends GatewayPayments {
  constructor(private readonly outboundCalls: OutboundCalls, private readonly gatewayStubService: GatewayStubService) {
    super();
  }

  private client(): Client {
    const httpsAgent = new StubTlsAgent(Number(new URL(this.gatewayStubService.baseUrl()).port), this.gatewayStubService.certificate());
    return new Client({ clientCredentialsAuthCredentials: { oAuthClientId: "offline-placeholder", oAuthClientSecret: "offline-placeholder" }, environment: Environment.Sandbox, timeout: 0, httpClientOptions: { httpsAgent } });
  }

  override async charge(executionContext: ExecutionContext, order: GatewayOrder): Promise<GatewayPayment> {
    const orders = new OrdersController(this.client());
    const businessKey = `order:${order.orderId}`;
    const created = await this.outboundCalls.send(fencedEffectKeyOf(executionContext, "create-order", { businessKey }), {
      target: "paypal",
      operation: "orders.create",
      request: { intent: "CAPTURE", purchaseUnits: [{ referenceId: order.orderId, amount: { currencyCode: "USD", value: (order.amountCents / 100).toFixed(2) } }] },
      send: async (call) => ({ id: (await orders.createOrder({ body: call.request as never, paypalRequestId: call.idempotencyKey })).result.id ?? "" }),
      reconcile: () => OutboundCallReconciliation.notSent(), // no money moves here; a repeat returns the order
    });
    const paypalOrderId = created.result.id; // held before money moves: what the capture is reconciled by
    const { result } = await this.outboundCalls.send(fencedEffectKeyOf(executionContext, "capture", { businessKey }), {
      target: "paypal",
      operation: "orders.capture",
      request: { paypalOrderId },
      send: async (call) => {
        const answer = await orders.captureOrder({ id: paypalOrderId, paypalRequestId: call.idempotencyKey });
        return { paymentId: paypalOrderId, amountCents: order.amountCents, status: String(answer.result.status) };
      },
      reconcile: async () => {
        const { result: current } = await orders.getOrder({ id: paypalOrderId });
        return capturesOf(current).length > 0
          ? OutboundCallReconciliation.completed({ paymentId: paypalOrderId, amountCents: order.amountCents, status: String(current.status) })
          : OutboundCallReconciliation.notSent();
      },
    });
    return result;
  }

  override async refund(executionContext: ExecutionContext, refund: GatewayRefund): Promise<GatewayMovement> {
    const client = this.client();
    const orders = new OrdersController(client);
    const captureId = capturesOf((await orders.getOrder({ id: refund.paymentId })).result)[0]?.id ?? "";
    const businessKey = `refund:${refund.paymentId}:${String(refund.refundNumber)}`;
    const { result } = await this.outboundCalls.send(fencedEffectKeyOf(executionContext, "refund", { businessKey }), {
      target: "paypal",
      operation: "captures.refund",
      request: { captureId, amount: { currencyCode: "USD", value: (refund.amountCents / 100).toFixed(2) } },
      send: async (call) => {
        const answer = await new PaymentsController(client).refundCapturedPayment({ captureId, paypalRequestId: call.idempotencyKey, body: { amount: call.request.amount } });
        return { movementId: answer.result.id ?? "", status: String(answer.result.status) };
      },
      reconcile: async () => {
        const refunds = (await orders.getOrder({ id: refund.paymentId })).result.purchaseUnits?.[0]?.payments?.refunds ?? [];
        const found = refunds[refund.refundNumber - 1];
        return found === undefined ? OutboundCallReconciliation.notSent() : OutboundCallReconciliation.completed({ movementId: found.id ?? "", status: String(found.status) });
      },
    });
    return result;
  }
}

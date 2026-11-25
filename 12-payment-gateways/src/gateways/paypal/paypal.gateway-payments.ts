// Independent example, not affiliated. PayPal is named only to identify its public API. AGBoss is
// not affiliated with, endorsed by or sponsored by PayPal; the name is its owner's trademark. This
// example follows PayPal's public documentation as read on 2026-11-01
// (https://developer.paypal.com/api/rest/reference/idempotency/). Gateways change their APIs and
// SDKs: check the official documentation before relying on it.
import { Client, Environment, OrdersController, PaymentsController, type Order } from "@paypal/paypal-server-sdk";
import { Idempotency, Injectable, OutboundRecovery, Reconciliation } from "@agboss/core";
import { CALL_BOUNDS, GatewayPayments, type GatewayMovement, type GatewayOrder, type GatewayPayment, type GatewayRefund } from "../../gateway-payments.js";
import { GatewayStubService } from "../../services/gateway-stub.service.js";
import { StubTlsAgent } from "./paypal-stub-transport.js";

const capturesOf = (order: Order) => order.purchaseUnits?.[0]?.payments?.captures ?? [];

/** PayPal's official SDK (`@paypal/paypal-server-sdk`): money moves at the capture of an order created first. */
@Injectable({ deps: [Idempotency, GatewayStubService] })
export class PayPalGatewayPayments extends GatewayPayments {
  constructor(private readonly idempotency: Idempotency, private readonly gatewayStubService: GatewayStubService) {
    super();
  }

  private client(): Client {
    const httpsAgent = new StubTlsAgent(Number(new URL(this.gatewayStubService.baseUrl()).port), this.gatewayStubService.certificate());
    return new Client({ clientCredentialsAuthCredentials: { oAuthClientId: "offline-placeholder", oAuthClientSecret: "offline-placeholder" }, environment: Environment.Sandbox, timeout: 0, httpClientOptions: { httpsAgent } });
  }

  override async charge(order: GatewayOrder): Promise<GatewayPayment> {
    const orders = new OrdersController(this.client());
    const businessKey = `order:${order.orderId}`;
    const created = await this.idempotency.sendOnce({
      name: "create-order", key: businessKey, ...CALL_BOUNDS,
      target: "paypal", operation: "orders.create",
      request: { intent: "CAPTURE", purchaseUnits: [{ referenceId: order.orderId, amount: { currencyCode: "USD", value: (order.amountCents / 100).toFixed(2) } }] },
      send: async (call): Promise<{ id: string }> => ({ id: (await orders.createOrder({ body: call.request as never, paypalRequestId: call.idempotencyKey })).result.id ?? "" }),
      // trusted at any age (#795): an order's creation moves no money, a stray one expires unpaid
      recovery: OutboundRecovery.permanentLookup<{ id: string }>(() => Reconciliation.notExecuted()), // no money moves here; a repeat returns the order
    });
    const paypalOrderId = created.result.id; // held before money moves: what the capture is reconciled by
    const { result } = await this.idempotency.sendOnce({
      name: "capture", key: businessKey, ...CALL_BOUNDS,
      target: "paypal", operation: "orders.capture",
      request: { paypalOrderId },
      send: async (call): Promise<GatewayPayment> => {
        const answer = await orders.captureOrder({ id: paypalOrderId, paypalRequestId: call.idempotencyKey });
        return { paymentId: paypalOrderId, amountCents: order.amountCents, status: String(answer.result.status) };
      },
      // the order's GET is its own record: no capture there holds at any age (#795)
      recovery: OutboundRecovery.permanentLookup(async () => {
        const { result: current } = await orders.getOrder({ id: paypalOrderId });
        return capturesOf(current).length > 0 && current.purchaseUnits?.[0]?.referenceId === order.orderId
          ? Reconciliation.completed({ paymentId: paypalOrderId, amountCents: order.amountCents, status: String(current.status) })
          : Reconciliation.notExecuted();
      }),
    });
    return result;
  }

  override async refund(refund: GatewayRefund): Promise<GatewayMovement> {
    const client = this.client();
    const orders = new OrdersController(client);
    const paypalOrder = (await orders.getOrder({ id: refund.paymentId })).result;
    // the PayPal order must be this order's (its reference_id), beside the shop's own books
    if (paypalOrder.purchaseUnits?.[0]?.referenceId !== refund.orderId) throw new Error(`PayPal order ${refund.paymentId} is not order ${refund.orderId}'s`);
    const captureId = capturesOf(paypalOrder)[0]?.id ?? "";
    const businessKey = `refund:${refund.paymentId}:${String(refund.refundNumber)}`;
    const { result } = await this.idempotency.sendOnce({
      name: "refund", key: businessKey, ...CALL_BOUNDS,
      target: "paypal", operation: "captures.refund",
      request: { captureId, amount: { currencyCode: "USD", value: (refund.amountCents / 100).toFixed(2) } },
      send: async (call): Promise<GatewayMovement> => {
        const answer = await new PaymentsController(client).refundCapturedPayment({ captureId, paypalRequestId: call.idempotencyKey, body: { amount: call.request.amount } });
        return { movementId: answer.result.id ?? "", status: String(answer.result.status) };
      },
      // the order's refunds, read by its GET: the record, not the key (#795)
      recovery: OutboundRecovery.permanentLookup(async () => {
        const refunds = (await orders.getOrder({ id: refund.paymentId })).result.purchaseUnits?.[0]?.payments?.refunds ?? [];
        const found = refunds[refund.refundNumber - 1];
        return found === undefined ? Reconciliation.notExecuted() : Reconciliation.completed({ movementId: found.id ?? "", status: String(found.status) });
      }),
    });
    return result;
  }
}

// Independent example, not affiliated. Adyen is named only to identify its public API. AGBoss is
// not affiliated with, endorsed by or sponsored by Adyen; the name is its owner's trademark. This
// example follows Adyen's public documentation as read on 2026-11-01
// (https://docs.adyen.com/development-resources/api-idempotency). Gateways change their APIs and
// SDKs: check the official documentation before relying on it.
import { createHash } from "node:crypto";
import { CheckoutAPI, Client, EnvironmentEnum, type Types } from "@adyen/api-library";
import { ExecutionContext, Injectable, OutboundCallReconciliation, OutboundCalls, fencedEffectKeyOf } from "@agboss/core";
import { GatewayPayments, type GatewayMovement, type GatewayOrder, type GatewayPayment, type GatewayRefund } from "../../gateway-payments.js";
import { AttemptAgeService } from "../../services/attempt-age.service.js";
import { GatewayStubService } from "../../services/gateway-stub.service.js";
import { StubHttpClient } from "./adyen-stub-transport.js";

const KEY_RETENTION = 7 * 24 * 60 * 60 * 1000; // "valid for a period of 7 to 14 days": the minimum
const MERCHANT = "OfflineMerchantAccount";

/** Adyen takes 64 characters: a fixed-length digest of AGBoss's key (SHA-256, base64url: 43), never a cut. */
const adyenKeyOf = (idempotencyKey: string): string => createHash("sha256").update(idempotencyKey).digest("base64url");

/** Adyen's official SDK (`@adyen/api-library`), `environment: "TEST"` and a custom `httpClient`. */
@Injectable({ deps: [OutboundCalls, GatewayStubService, AttemptAgeService] })
export class AdyenGatewayPayments extends GatewayPayments {
  constructor(
    private readonly outboundCalls: OutboundCalls,
    private readonly gatewayStubService: GatewayStubService,
    private readonly attemptAgeService: AttemptAgeService,
  ) {
    super();
  }

  private checkout(): CheckoutAPI {
    const client = new Client({ apiKey: "offline_placeholder", environment: EnvironmentEnum.TEST }, new StubHttpClient(this.gatewayStubService.baseUrl()));
    return new CheckoutAPI(client);
  }

  /** No read API for payments: a replay of the key is the only lookup — `notSent()` while it lives (#658). */
  private replayWhileKept(startedAt: number) {
    return this.attemptAgeService.isWithin(startedAt, KEY_RETENTION)
      ? OutboundCallReconciliation.notSent()
      : OutboundCallReconciliation.unknown({ reason: "Adyen has no lookup and the key may be gone: check the Customer Area" });
  }

  override async charge(executionContext: ExecutionContext, order: GatewayOrder): Promise<GatewayPayment> {
    const checkout = this.checkout();
    const businessKey = `order:${order.orderId}`;
    const startedAt = await this.attemptAgeService.startOf(executionContext, businessKey);
    const { result } = await this.outboundCalls.send(fencedEffectKeyOf(executionContext, "charge", { businessKey }), {
      target: "adyen",
      operation: "payments",
      request: { amount: { value: order.amountCents, currency: "USD" }, reference: order.orderId, merchantAccount: MERCHANT, paymentMethod: { type: "scheme", storedPaymentMethodId: "offline" }, returnUrl: "https://shop.example/return" },
      send: async (call) => {
        const answer = await checkout.PaymentsApi.payments(call.request as unknown as Types.checkout.PaymentRequest, { idempotencyKey: adyenKeyOf(call.idempotencyKey) });
        return { paymentId: answer.pspReference ?? "", amountCents: order.amountCents, status: String(answer.resultCode) };
      },
      reconcile: () => this.replayWhileKept(startedAt),
    });
    return result;
  }

  override async refund(executionContext: ExecutionContext, refund: GatewayRefund): Promise<GatewayMovement> {
    const checkout = this.checkout();
    const businessKey = `refund:${refund.paymentId}:${String(refund.refundNumber)}`;
    const startedAt = await this.attemptAgeService.startOf(executionContext, businessKey);
    const { result } = await this.outboundCalls.send(fencedEffectKeyOf(executionContext, "refund", { businessKey }), {
      target: "adyen",
      operation: "refunds",
      request: { amount: { value: refund.amountCents, currency: "USD" }, merchantAccount: MERCHANT, reference: `${refund.orderId}-refund-${String(refund.refundNumber)}` },
      send: async (call) => {
        const answer = await checkout.ModificationsApi.refundCapturedPayment(refund.paymentId, call.request, { idempotencyKey: adyenKeyOf(call.idempotencyKey) });
        return { movementId: answer.pspReference, status: answer.status }; // "received": the REFUND webhook tells the outcome
      },
      reconcile: () => this.replayWhileKept(startedAt),
    });
    return result;
  }
}

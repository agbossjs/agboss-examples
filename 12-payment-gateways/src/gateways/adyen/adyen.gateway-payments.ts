// Independent example, not affiliated. Adyen is named only to identify its public API. AGBoss is
// not affiliated with, endorsed by or sponsored by Adyen; the name is its owner's trademark. This
// example follows Adyen's public documentation as read on 2026-11-01
// (https://docs.adyen.com/development-resources/api-idempotency). Gateways change their APIs and
// SDKs: check the official documentation before relying on it.
import { createHash } from "node:crypto";
import { CheckoutAPI, Client, EnvironmentEnum, Types } from "@adyen/api-library";
import { Idempotency, Injectable, OutboundRecovery } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { CALL_BOUNDS, GatewayPayments, type GatewayMovement, type GatewayOrder, type GatewayPayment, type GatewayRefund } from "../../gateway-payments.js";
import { GatewayStubService } from "../../services/gateway-stub.service.js";
import { StubHttpClient } from "./adyen-stub-transport.js";

const KEY_RETENTION = hours(7 * 24); // "valid for a period of 7 to 14 days": the minimum
/** Over the key's retention (7 days): a replay inside it finds the intent. */
const ADYEN_CALL = { timeout: CALL_BOUNDS.timeout, ttl: hours(8 * 24) };
const MERCHANT = "OfflineMerchantAccount";

/**
 * The payment request AGBoss keeps and replays: plain JSON. The SDK's `PaymentRequest` has `Date`
 * fields (`dateOfBirth`, `deliveryDate`, …) a stored request cannot carry, so the call builds it
 * from this one.
 */
interface AdyenPaymentRequest {
  readonly amount: { readonly value: number; readonly currency: string };
  readonly reference: string;
  readonly merchantAccount: string;
  readonly paymentMethod: { readonly type: "scheme"; readonly storedPaymentMethodId: string };
  readonly returnUrl: string;
}

const sdkPaymentOf = (request: AdyenPaymentRequest): Types.checkout.PaymentRequest => ({
  amount: request.amount,
  reference: request.reference,
  merchantAccount: request.merchantAccount,
  returnUrl: request.returnUrl,
  paymentMethod: { type: Types.checkout.CardDetails.TypeEnum.Scheme, storedPaymentMethodId: request.paymentMethod.storedPaymentMethodId },
});

/** Adyen takes 64 characters: a fixed-length digest of AGBoss's key (SHA-256, base64url: 43), never a cut. */
const adyenKeyOf = (idempotencyKey: string): string => createHash("sha256").update(idempotencyKey).digest("base64url");

/** Adyen's official SDK (`@adyen/api-library`), `environment: "TEST"` and a custom `httpClient`. */
@Injectable({ deps: [Idempotency, GatewayStubService] })
export class AdyenGatewayPayments extends GatewayPayments {
  constructor(
    private readonly idempotency: Idempotency,
    private readonly gatewayStubService: GatewayStubService,
  ) {
    super();
  }

  private checkout(): CheckoutAPI {
    return new CheckoutAPI(new Client({ apiKey: "offline_placeholder", environment: EnvironmentEnum.TEST }, new StubHttpClient(this.gatewayStubService.baseUrl())));
  }

  override async charge(order: GatewayOrder): Promise<GatewayPayment> {
    const checkout = this.checkout();
    const request: AdyenPaymentRequest = { amount: { value: order.amountCents, currency: "USD" }, reference: order.orderId, merchantAccount: MERCHANT, paymentMethod: { type: "scheme", storedPaymentMethodId: "offline" }, returnUrl: "https://shop.example/return" };
    const { result } = await this.idempotency.sendOnce({
      name: "payments",
      key: `order:${order.orderId}`,
      target: "adyen", operation: "payments",
      request,
      ...ADYEN_CALL,
      send: async (call) => {
        const answer = await checkout.PaymentsApi.payments(sdkPaymentOf(call.request), { idempotencyKey: adyenKeyOf(call.idempotencyKey) });
        return { paymentId: answer.pspReference ?? "", amountCents: order.amountCents, status: String(answer.resultCode) };
      },
      // no read API for payments: a replay of the key is the only lookup — sent only while Adyen
      // keeps the key (#658); past it, nothing is sent and a person checks the Customer Area
      recovery: OutboundRecovery.replayWithin(KEY_RETENTION),
    });
    return result;
  }

  override async refund(refund: GatewayRefund): Promise<GatewayMovement> {
    const checkout = this.checkout();
    const { result } = await this.idempotency.sendOnce({
      name: "refunds",
      key: `refund:${refund.paymentId}:${String(refund.refundNumber)}`,
      target: "adyen", operation: "refunds",
      request: { amount: { value: refund.amountCents, currency: "USD" }, merchantAccount: MERCHANT, reference: `${refund.orderId}-refund-${String(refund.refundNumber)}` },
      ...ADYEN_CALL,
      send: async (call) => {
        const answer = await checkout.ModificationsApi.refundCapturedPayment(refund.paymentId, call.request, { idempotencyKey: adyenKeyOf(call.idempotencyKey) });
        return { movementId: answer.pspReference, status: answer.status }; // "received": the REFUND webhook tells the outcome
      },
      recovery: OutboundRecovery.replayWithin(KEY_RETENTION),
    });
    return result;
  }
}

import { hmacValidator } from "@adyen/api-library";
import { StubKit, fieldText, type KeyPolicy, type StubRequest, type StubRoute } from "../../../stub-kit/stub-kit.js";

/**
 * A local stub of Adyen's Checkout API v72 — `/payments` and `/payments/{pspReference}/refunds` —
 * and its REFUND webhook, following Adyen's public docs as read on 2026-11-01. Independent example,
 * not affiliated: Adyen is named only to identify its public API; this is not Adyen's server and
 * imitates only what the docs say. Each behaviour cites its page.
 */

/** The HMAC key the stub signs its webhooks with (hex, as Adyen's are) — a test value, not a real key. */
export const ADYEN_TEST_HMAC_KEY = "44782DEF547AAA06C910C43932B1EB0C71FC68D9D0C057550C48EC2ACF6BA056";

/**
 * https://docs.adyen.com/development-resources/api-idempotency (2026-11-01): "send a request with
 * the idempotency-key:<key> in the header. The <key> is a unique identifier for the message with a
 * maximum of 64 characters." "Idempotency keys are valid for a period of 7 to 14 days after first
 * submission" (7 days here, the documented minimum). "If the Adyen payments platform already
 * processed the request, the response to the first attempt will be returned without duplication."
 * "If you submit a duplicate request before the first request has completed, the API returns an
 * HTTP 422 – Unprocessable Entity or HTTP 409 - Conflict status with the error code 704". The same
 * key with another body: not documented (UNVERIFIED) — the first response here.
 */
const KEYS: KeyPolicy = {
  keyOf: (request) => {
    const key = request.headers["idempotency-key"];
    return typeof key === "string" ? key : undefined;
  },
  retention: 7 * 24 * 60 * 60 * 1000,
  keeps: () => true,
  inProgress: {
    status: 422,
    body: { status: 422, errorCode: "704", message: "request already processed or in progress", errorType: "validation" },
    headers: { "transient-error": "true" },
  },
};

interface Payment {
  readonly pspReference: string;
  readonly reference: string;
  readonly value: number;
  refunded: number;
}

/** Starts the Adyen stub. */
export async function startAdyenStub(): Promise<StubKit> {
  const payments = new Map<string, Payment>();
  const counter = { next: 0 };
  const box: { kit?: StubKit } = {};
  const kit = (): StubKit => {
    if (box.kit === undefined) throw new Error("the Adyen stub is not started");
    return box.kit;
  };
  const psp = (): string => {
    counter.next += 1;
    return `PSP${String(1_000_000 + counter.next)}`;
  };
  const tooLong = (request: StubRequest) => (KEYS.keyOf(request)?.length ?? 0) > 64;
  const routes = (request: StubRequest): StubRoute | undefined => {
    const { method, path } = request;
    if (method === "POST" && path === "/v72/payments")
      return {
        operation: "charge",
        key: KEYS,
        handle: (req) => {
          if (tooLong(req)) return { status: 422, body: { status: 422, errorCode: "702", message: "idempotency-key longer than 64", errorType: "validation" } };
          const amount = req.body["amount"] as { value?: unknown } | undefined;
          const value = Number(amount?.value);
          const reference = fieldText(req.body["reference"]);
          const payment: Payment = { pspReference: psp(), reference, value, refunded: 0 };
          payments.set(payment.pspReference, payment);
          kit().record({ kind: "charge", reference, amountCents: value, key: KEYS.keyOf(req) });
          return { status: 200, body: { pspReference: payment.pspReference, resultCode: "Authorised", merchantReference: reference, amount: { value, currency: "USD" } } };
        },
      };
    // https://docs.adyen.com/online-payments/refund: "Wait for the REFUND webhook to learn the outcome
    // of the refund request." — the answer only says it was received
    const refund = /^\/v72\/payments\/([^/]+)\/refunds$/u.exec(path);
    if (method === "POST" && refund?.[1] !== undefined) {
      const payment = payments.get(refund[1]);
      return {
        operation: "refund",
        key: KEYS,
        handle: (req) => {
          const value = Number((req.body["amount"] as { value?: unknown } | undefined)?.value);
          if (payment === undefined) return { status: 422, body: { status: 422, errorCode: "167", message: "Original pspReference required for this operation", errorType: "validation" } };
          payment.refunded += value;
          kit().record({ kind: "refund", reference: payment.reference, amountCents: value, key: KEYS.keyOf(req) });
          return { status: 201, body: { pspReference: psp(), paymentPspReference: payment.pspReference, status: "received", amount: { value, currency: "USD" }, merchantAccount: req.body["merchantAccount"] } };
        },
      };
    }
    return undefined;
  };
  box.kit = await StubKit.start(routes);
  const reset = box.kit.reset.bind(box.kit);
  box.kit.reset = (now) => {
    payments.clear();
    counter.next = 0;
    reset(now);
  };
  return box.kit;
}

/**
 * A REFUND webhook for a refund (https://docs.adyen.com/development-resources/webhooks/handle-webhook-events:
 * "it is possible that you receive the same webhook event twice … These duplicate webhook events
 * have the same values in the eventCode and pspReference fields"), signed in
 * `additionalData.hmacSignature` (https://docs.adyen.com/development-resources/webhooks/secure-webhooks/verify-hmac-signatures).
 */
export function refundWebhook(refundPspReference: string, paymentPspReference: string, orderId: string, value: number): string {
  const item = {
    amount: { value, currency: "USD" },
    eventCode: "REFUND",
    eventDate: "2026-11-01T09:00:00+01:00",
    merchantAccountCode: "OfflineMerchantAccount",
    merchantReference: orderId,
    originalReference: paymentPspReference,
    pspReference: refundPspReference,
    success: "true",
    additionalData: {} as Record<string, string>,
  };
  item.additionalData["hmacSignature"] = new hmacValidator().calculateHmac(item as never, ADYEN_TEST_HMAC_KEY);
  return JSON.stringify({ live: "false", notificationItems: [{ NotificationRequestItem: item }] });
}

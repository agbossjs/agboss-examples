import { STRIPE_SEARCH_LAG, startStripeStub } from "../src/gateways/stripe/stub/stripe.stub.js";
import { StripeGatewayPayments } from "../src/gateways/stripe/stripe.gateway-payments.js";
import { CheckoutComGatewayPayments } from "../src/gateways/checkout-com/checkout-com.gateway-payments.js";
import { startCheckoutComStub } from "../src/gateways/checkout-com/stub/checkout-com.stub.js";
import { CardcomGatewayPayments } from "../src/gateways/cardcom/cardcom.gateway-payments.js";
import { startCardcomStub } from "../src/gateways/cardcom/stub/cardcom.stub.js";
import { PayPalGatewayPayments } from "../src/gateways/paypal/paypal.gateway-payments.js";
import { PAYPAL_SANDBOX_HOST, startPayPalStub } from "../src/gateways/paypal/stub/paypal.stub.js";
import { AdyenGatewayPayments } from "../src/gateways/adyen/adyen.gateway-payments.js";
import { startAdyenWebhookReceiver } from "../src/gateways/adyen/adyen-webhook.receiver.js";
import { ADYEN_TEST_HMAC_KEY, refundWebhook, startAdyenStub } from "../src/gateways/adyen/stub/adyen.stub.js";
import { BooksRepository } from "../src/repositories/books.repository.js";
import { CheckoutWorkflowStart } from "../src/workflows/checkout/checkout.workflow-start.js";
import { RefundWorkflowStart } from "../src/workflows/refund/refund.workflow-start.js";
import { outcomeOf, type GatewayRow, type GatewayUnderTest } from "./harness.js";
import { paymentIdOf, ps1, ps17Completed, ps17Failed, ps17Pending, ps18Shipments, ps19, ps2, ps23, ps5, ps8 } from "./runs.js";

/** Stripe: its stub, its wiring, and the scenarios of its row in the README's table. */
export async function stripe(): Promise<{ gateway: GatewayUnderTest; rows: GatewayRow[] }> {
  return {
    gateway: { slug: "stripe", name: "Stripe", stub: await startStripeStub(), operations: StripeGatewayPayments, chargeOperation: "charge" },
    rows: [ps1, ps2, ps5, ps8, ps17Completed(25), ps17Pending("ps17b", 25, { charges: 1 }), ps19("refund")],
  };
}

export { STRIPE_SEARCH_LAG };

/** Checkout.com: its stub, its wiring, the scenarios of its row. */
export async function checkoutCom(): Promise<{ gateway: GatewayUnderTest; rows: GatewayRow[] }> {
  return {
    gateway: { slug: "checkout-com", name: "Checkout.com", stub: await startCheckoutComStub(), operations: CheckoutComGatewayPayments, chargeOperation: "charge" },
    rows: [ps1, ps5, ps8, ps17Failed(73, { charges: 2, boundary: "#657" }), ps18Shipments, ps19("refund")],
  };
}

/** PS15 on Adyen: a refund's REFUND webhook delivered twice at once, to both instances. */
const adyenWebhookTwice: GatewayRow = {
  scenario: "ps15",
  title: "a webhook delivered twice",
  expected: { charges: 1, refunds: 1, notes: ["events applied: 1"] },
  async run(context) {
    const orderId = "adyen-ps15";
    const checkout = await context.app(0).execute(CheckoutWorkflowStart, { orderId, amountCents: 5000, capture: true, failShipping: false });
    const paymentId = paymentIdOf(checkout.output);
    const refund = await context.app(0).execute(RefundWorkflowStart, { orderId, paymentId, amountCents: 2000, refundNumber: 1 });
    const receiver = await startAdyenWebhookReceiver(context.apps, ADYEN_TEST_HMAC_KEY);
    try {
      const body = refundWebhook(refund.output?.movementId ?? "", paymentId, orderId, 2000);
      const post = () => fetch(receiver.url, { method: "POST", headers: { "content-type": "application/json" }, body }).then((response) => response.status);
      const statuses = await Promise.all([post(), post()]);
      const applied = context.app(1).resolve(BooksRepository).applied(orderId);
      return outcomeOf(context, "ps15", orderId, [`deliveries: ${statuses.join(", ")}`, `events applied: ${String(applied)}`]);
    } finally {
      await receiver.close();
    }
  },
};

/** Adyen: its stub, its wiring, the scenarios of its row. */
export async function adyen(): Promise<{ gateway: GatewayUnderTest; rows: GatewayRow[] }> {
  return {
    gateway: { slug: "adyen", name: "Adyen", stub: await startAdyenStub(), operations: AdyenGatewayPayments, chargeOperation: "charge" },
    rows: [
      ps1,
      ps5,
      adyenWebhookTwice,
      ps17Pending("ps17d", 7 * 24 + 1, { charges: 1, notes: ["intents left pending: 1"], boundary: "#658 (worked around: the wiring records the attempt's start; past 7 days, unknown)" }),
      ps19("refund"),
      ps23({ charges: 1, notes: ["in-progress", "replayed"] }),
    ],
  };
}

/** CardCom: its stub, its wiring (its HTTP API v11 by fetch), the scenarios of its row. */
export async function cardcom(): Promise<{ gateway: GatewayUnderTest; rows: GatewayRow[] }> {
  return {
    gateway: { slug: "cardcom", name: "CardCom", stub: await startCardcomStub(), operations: CardcomGatewayPayments, chargeOperation: "charge" },
    rows: [
      ps1,
      ps5,
      ps8,
      // refunds take no key at CardCom: today the lost answer's Failed intent is resent blindly (#657)
      ps19("refund", { charges: 1, refunds: 2, boundary: "#657 (CardCom refunds take no key)" }),
      // CardCom does not protect a concurrent duplicate (KB 509: "wait … up to 7 seconds")
      ps23({ charges: 2, boundary: "CardCom's own in-flight gap (KB 509)" }),
    ],
  };
}

/** PayPal: its TLS stub (a certificate made now), its wiring, the scenarios of its row. */
export async function paypal(): Promise<{ gateway: GatewayUnderTest; rows: GatewayRow[]; certificate: string }> {
  const { stub, certificate } = await startPayPalStub();
  return {
    gateway: {
      slug: "paypal",
      name: "PayPal",
      stub,
      operations: PayPalGatewayPayments,
      chargeOperation: "capture", // money moves at the capture
      allowNetwork: [PAYPAL_SANDBOX_HOST], // the name the SDK requests; its agent connects to 127.0.0.1 only
    },
    rows: [ps1, ps5, ps8, ps17Pending("ps17b", 7, { charges: 1 }), ps19("refund")],
    certificate,
  };
}

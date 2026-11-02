import { callTool, callTools, replyWith } from "@agboss/core/testing";
import { SecureCheckoutAgent } from "../src/agents/secure-checkout/secure-checkout.agent.js";
import { NewKeyPerAttemptPaymentOperations } from "../src/payments/wrong/new-key-per-attempt.payment-operations.js";
import { OrderBookRepository } from "../src/repositories/order-book.repository.js";
import { StubGatewayClient } from "../src/stub/stub-gateway.client.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { ConfirmSecurePaymentTool } from "../src/tools/confirm-secure-payment.tool.js";
import { CreateSecurePaymentTool } from "../src/tools/create-secure-payment.tool.js";
import { startWebhookReceiver } from "../src/webhooks/gateway-webhook.receiver.js";
import { SecureCheckoutWorkflowStart } from "../src/workflows/secure-checkout/secure-checkout.workflow-start.js";
import { outcomeOf, settled } from "./outcome.js";
import { Variant, type PaymentScenario, type ScenarioContext } from "./scenario.types.js";

const payment = { orderId: "ps21-order", amountCents: 3000 };

/**
 * The 3DS outcome arrives — from a return page or the webhook — naming the charge (PS21). Right:
 * it answers the order's one pause; a second answer is `NotPausedError`, and the confirm runs once,
 * on the charge the shop's books hold. Wrong: every request confirms the charge it names.
 */
async function outcomeArrived(context: ScenarioContext, chargeId: string, by: string): Promise<string> {
  if (context.variant === Variant.Wrong)
    await settled(new StubGatewayClient(context.stub.baseUrl).confirm(chargeId));
  const [pauseId] = context.app(1).resolve(OrderBookRepository).awaitedOutcomes("default", payment.orderId);
  return settled(context.app(1).resume({ pauseId: pauseId ?? "", decision: { approved: true } }, { answeredBy: by }));
}

/**
 * PS21 — a 3DS flow, the browser retries: the payment form is submitted twice (two create calls in
 * one turn), the return page loads twice and the webhook arrives once. Wrong: a new key per form
 * submission, and each return page confirms the charge in its query string — two charges. Right:
 * one charge under the order's key; the return pages and the webhook all answer one pause, once.
 */
export const ps21: PaymentScenario = {
  id: "ps21",
  title: "A redirect or 3DS flow: the browser retries",
  rows: [
    {
      row: "ps21",
      level: StubLevel.Full,
      wrongOperations: NewKeyPerAttemptPaymentOperations,
      wrong: { charges: 2, confirms: 2 },
      right: { charges: 1, confirms: 1, lost: 0, orderStatus: "paid", notes: ["run.not-paused"] },
      async run(context) {
        context.mockLlm(SecureCheckoutAgent).thenReturn(
          // the form submitted twice: two calls in one turn
          callTools(callTool(CreateSecurePaymentTool, payment), callTool(CreateSecurePaymentTool, payment)),
          callTool(ConfirmSecurePaymentTool, payment),
          replyWith("Paid with 3DS."),
        );
        const paused = await context.app(0).execute(SecureCheckoutWorkflowStart, { text: "pay order ps21-order" });
        const charges = context.stub.chargesOf(payment.orderId).map((charge) => charge.chargeId);
        const [first, second = first] = charges;
        if (first === undefined) throw new Error("no 3DS charge at the stub");
        // each form submission redirected the browser with its own charge
        const returnPage1 = await outcomeArrived(context, first, "return-page");
        const returnPage2 = await outcomeArrived(context, second ?? first, "return-page");
        const receiver = await startWebhookReceiver(context.stub.webhookSecret, (event) =>
          outcomeArrived(context, event.chargeId, "webhook"),
        );
        try {
          await context.stub.deliver([context.stub.eventFor("charge.succeeded", first)], { to: receiver.url });
        } finally {
          await receiver.close();
        }
        return outcomeOf(context, "ps21", "ps21", [payment.orderId], [
          `paused: ${String(paused.pending.length)}`,
          `return page 1: ${returnPage1}`,
          `return page 2: ${returnPage2}`,
        ]);
      },
    },
  ],
};

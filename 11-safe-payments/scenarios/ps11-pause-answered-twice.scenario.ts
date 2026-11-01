import { callTool, replyWith } from "@agboss/core/testing";
import { ApprovalAgent } from "../src/agents/approval/approval.agent.js";
import { StubGatewayClient } from "../src/stub/stub-gateway.client.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { ApprovedChargeTool } from "../src/tools/approved-charge.tool.js";
import { ApprovedCheckoutWorkflowStart } from "../src/workflows/approved-checkout/approved-checkout.workflow-start.js";
import { outcomeOf, settled } from "./outcome.js";
import { Variant, type PaymentScenario, type ScenarioContext } from "./scenario.types.js";

const CUSTOMER = "customer-11";
const charge = { orderId: "ps11-order", amountCents: 90_000 };

/**
 * The customer's "approve" button, pressed twice at once and handled on two instances (PS11).
 * Right: each press answers the pause (`app.resume`); the pause moves from pending to resolved
 * once, the second press gets `NotPausedError`. Wrong: the handler stores the approval and charges
 * on each press itself.
 */
function approve(context: ScenarioContext, instance: number, pauseId: string): Promise<string> {
  if (context.variant === Variant.Right)
    return settled(
      context.app(instance).resume({ pauseId, decision: { approved: true } }, { ownerId: CUSTOMER }),
    );
  const client = new StubGatewayClient(context.stub.baseUrl);
  return settled(
    client.createCharge({ ...charge, currency: "usd", reference: charge.orderId, capture: true, paymentMethod: "card_ok" }),
  );
}

/**
 * PS11 — a pause answered twice: a large order waits for the customer's approval, and two presses
 * of "approve" reach two instances at once. Wrong: the approval handler charges on every press, two
 * charges. Right: both presses answer the one pause; it is resolved once, the charge runs once.
 */
export const ps11: PaymentScenario = {
  id: "ps11",
  title: "A pause answered twice",
  rows: [
    {
      row: "ps11",
      level: StubLevel.Full,
      wrong: { charges: 2 },
      right: { charges: 1, lost: 0, orderStatus: "paid", notes: ["not-paused"] },
      async run(context) {
        context.mockLlm(ApprovalAgent).thenReturn(
          callTool(ApprovedChargeTool, charge),
          ...(context.variant === Variant.Right ? [replyWith("Charged once you approved.")] : []),
        );
        const paused = await context
          .app(0)
          .execute(ApprovedCheckoutWorkflowStart, { text: "a large order" }, { ownerId: CUSTOMER });
        const pauseId = paused.pending[0]?.pauseId ?? "";
        const presses = await Promise.all([approve(context, 0, pauseId), approve(context, 1, pauseId)]);
        return outcomeOf(context, "ps11", "ps11", [charge.orderId], presses.map((press) => `press: ${press}`));
      },
    },
  ],
};

import { callTool, callTools, replyWith } from "@agboss/core/testing";
import { PaymentAgent } from "../src/agents/payment/payment.agent.js";
import { StepKeyedPaymentOperations } from "../src/payments/wrong/step-keyed.payment-operations.js";
import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { ChargeOrderTool } from "../src/tools/charge-order.tool.js";
import { PaymentAgentWorkflowStart } from "../src/workflows/payment-agent/payment-agent.workflow-start.js";
import { failureOf, outcomeOf } from "./outcome.js";
import type { PaymentScenario } from "./scenario.types.js";

/**
 * PS7 — the model calls the charge tool twice: twice in one turn, once more in the next, then once
 * with another amount. Each tool call is a step of its own. Wrong: keyed by the step, every call
 * charges. Right: keyed by the order (`order:<id>`): the first charges, the others get its receipt
 * (`Joined` / `Replayed`), and the other amount is refused (`BusinessKeyConflictError`).
 */
export const ps7: PaymentScenario = {
  id: "ps7",
  title: "The model calls the charge tool twice",
  rows: [
    {
      row: "ps7",
      level: StubLevel.Full,
      wrongOperations: StepKeyedPaymentOperations,
      wrong: { charges: 4 },
      right: { charges: 1, lost: 0, notes: ["fenced-effect.business-key-conflict"] },
      async run(context) {
        const charge = { orderId: "ps7-order", amountCents: 2500 };
        context.mockLlm(PaymentAgent).thenReturn(
          // two calls in one turn
          callTools(callTool(ChargeOrderTool, charge), callTool(ChargeOrderTool, charge)),
          callTool(ChargeOrderTool, charge),
          callTool(ChargeOrderTool, { ...charge, amountCents: 9900 }),
          replyWith("The order is paid."),
        );
        const result = await context.app(0).execute(PaymentAgentWorkflowStart, { text: "pay for order ps7-order" });
        const calls = result.toolCalls.map((call) =>
          call.error === undefined ? call.status : `${call.status}: ${failureOf(call.error)}`,
        );
        return outcomeOf(context, "ps7", "ps7", [charge.orderId], calls);
      },
    },
  ],
};

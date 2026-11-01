import { Agent } from "@agboss/core";
import { CHAT_MODEL } from "../../model-providers/models.js";
import { ChargeOrderTool } from "../../tools/charge-order.tool.js";

/** Takes the customer's payment with the charge tool — which a model may call twice (PS7). */
@Agent({
  name: "payment-agent",
  description: "Takes the customer's payment",
  prompt: "Charge the customer's order with charge-order-tool, then say it is paid.",
  model: CHAT_MODEL,
  tools: [ChargeOrderTool],
})
export class PaymentAgent {}

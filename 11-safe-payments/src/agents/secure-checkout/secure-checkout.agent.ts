import { Agent } from "@agboss/core";
import { CHAT_MODEL } from "../../model-providers/models.js";
import { ConfirmSecurePaymentTool } from "../../tools/confirm-secure-payment.tool.js";
import { CreateSecurePaymentTool } from "../../tools/create-secure-payment.tool.js";

/** Takes a 3DS payment: creates it, waits for its outcome, confirms it (PS21). */
@Agent({
  name: "secure-checkout-agent",
  description: "Takes a 3DS payment",
  prompt: "Create the payment, then confirm it once the customer completed 3DS.",
  model: CHAT_MODEL,
  tools: [CreateSecurePaymentTool, ConfirmSecurePaymentTool],
})
export class SecureCheckoutAgent {}

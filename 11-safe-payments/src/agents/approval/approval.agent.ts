import { Agent } from "@agboss/core";
import { CHAT_MODEL } from "../../model-providers/models.js";
import { ApprovedChargeTool } from "../../tools/approved-charge.tool.js";

/** Charges a large order with the customer's approval (PS11). */
@Agent({
  name: "approval-agent",
  description: "Charges a large order once the customer approves it",
  prompt: "Charge the order with approved-charge-tool; it waits for the customer's approval.",
  model: CHAT_MODEL,
  tools: [ApprovedChargeTool],
})
export class ApprovalAgent {}

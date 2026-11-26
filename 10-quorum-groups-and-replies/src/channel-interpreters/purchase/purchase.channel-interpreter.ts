import { ChannelInterpreter } from "@agboss/core";
import { CAREFUL_CHAT_MODEL } from "../../model-providers/models.js";

/**
 * Reads an approver's free-text reply — "ok but only up to $500" — into the role's typed decision
 * (`ToolCallApprovalDecisionDto`): approved or not, the reason, and the corrected tool call when the
 * approver capped the amount (`overrideInput`). It gets the pause's question with the reply
 * (`{ ask, reply }`); what it answers is validated like any decision. A reply it cannot read is
 * `PauseError.UninterpretableReply` and the pause stays pending — nothing resumes on a guess. Its prompt is
 * one line: the framework describes the corrected call by the tool's input and gives the model a
 * "not understood" tool for "🤷" (agbossjs/agboss#648).
 */
@ChannelInterpreter({
  name: "purchase-reply-interpreter",
  description: "Turns an approver's free-text reply into a purchase decision",
  model: CAREFUL_CHAT_MODEL,
  prompt: "./purchase.prompt.md",
})
export class PurchaseReplyInterpreter {}

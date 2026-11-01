import { DecidedBy, ReplyInterpreter } from "@agboss/core";
import { CAREFUL_CHAT_MODEL } from "../../model-providers/models.js";

/**
 * Reads an approver's free-text reply — "ok but only up to $500" — into the role's typed decision
 * (`ToolCallApprovalDecisionDto`): approved or not, the reason, and the corrected tool call when the
 * approver capped the amount (`overrideArguments`). It gets the pause's question with the reply
 * (`{ ask, reply }`); what it answers is validated like any decision. A reply it cannot read is
 * `UninterpretableReplyError` and the pause stays pending — nothing resumes on a guess.
 */
@ReplyInterpreter({
  name: "purchase-reply-interpreter",
  description: "Turns an approver's free-text reply into a purchase decision",
  decidedBy: DecidedBy.Model,
  model: CAREFUL_CHAT_MODEL,
  promptUrls: ["./purchase.prompt.md"],
})
export class PurchaseReplyInterpreter {}

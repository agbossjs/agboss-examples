import { PauseRespondent, ToolApproval } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { PurchaseReplyInterpreter } from "../channel-interpreters/purchase/purchase.channel-interpreter.js";

/**
 * What a purchase order is approved through: it approves `place-purchase-order-tool` calls, and the
 * approver answers through the channel's own side (`PauseRespondent.Delegate` — the pause's id is
 * the channel's, never the caller's). The approver writes free text; `PurchaseReplyInterpreter`
 * reads it into the typed decision. Its one channel is listed in `@Application({ channels })`:
 * `ConsoleApproverChannel`.
 */
@ToolApproval({
  name: "purchase-approver-tool-approval",
  description: "A purchasing approver approves a purchase order, in free text",
  respondent: PauseRespondent.Delegate,
  timeout: hours(24),
  channelInterpreter: PurchaseReplyInterpreter,
})
export class PurchaseApproverToolApproval {}

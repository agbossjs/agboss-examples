import { PauseRespondent, ToolApproval } from "@agboss/core";
import { hours } from "@agboss/core/units";

/**
 * A large order waits for the customer's own approval (PS11): the thread's owner answers
 * (`PauseRespondent.Owner`), by the pause id the paused execution lists.
 */
@ToolApproval({
  name: "checkout-approval-tool-approval",
  description: "The customer approves the charge of a large order",
  respondent: PauseRespondent.Owner,
  timeout: hours(24),
})
export class CheckoutApprovalToolApproval {}

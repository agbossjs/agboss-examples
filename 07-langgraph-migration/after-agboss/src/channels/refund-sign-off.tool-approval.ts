import { PauseRespondent, ToolApproval } from "@agboss/core";
import { hours } from "@agboss/core/units";

/** A supervisor signs off a large refund before it is issued; the thread's owner answers. */
@ToolApproval({
  name: "refund-sign-off-tool-approval",
  description: "A supervisor signs off a large refund before it is issued",
  respondent: PauseRespondent.Owner,
  timeout: hours(24),
})
export class RefundSignOffToolApproval {}

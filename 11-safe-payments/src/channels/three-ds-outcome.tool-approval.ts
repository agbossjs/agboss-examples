import { PauseRespondent, ToolApproval } from "@agboss/core";
import { hours } from "@agboss/core/units";

/**
 * The 3DS outcome of a payment (PS21): answered by whichever comes first — the customer's browser
 * on the return page, or the gateway's webhook — through the channel's own side (the pause id is
 * the channel's, `PauseRespondent.Delegate`). The second answer is `NotPausedError`.
 */
@ToolApproval({
  name: "three-ds-outcome-tool-approval",
  description: "The customer completes 3DS: the return page or the webhook says so",
  respondent: PauseRespondent.Delegate,
  timeout: hours(24),
})
export class ThreeDsOutcomeToolApproval {}

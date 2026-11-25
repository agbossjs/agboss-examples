import { Channel, ChannelOutcome } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { CheckoutApprovalToolApproval } from "./checkout-approval.tool-approval.js";

/**
 * Waits for the customer: the execution pauses until `app.resume({ pauseId, decision })`, by the
 * pause id the paused execution lists (`result.pending`).
 */
@Channel({
  name: "approval-inbox-channel",
  description: "Waits for the customer's approval",
  target: CheckoutApprovalToolApproval,
  ttl: hours(24),
})
export class ApprovalInboxChannel {
  send(): Promise<ChannelOutcome<CheckoutApprovalToolApproval>> {
    return Promise.resolve(ChannelOutcome.awaitReply());
  }
}

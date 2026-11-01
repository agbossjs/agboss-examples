import { Channel, ChannelOutcome } from "@agboss/core";
import { CheckoutApprovalChannel } from "./checkout-approval.channel-role.js";

/**
 * Waits for the customer: the execution pauses until `app.resume({ pauseId, decision })`, by the
 * pause id the paused execution lists (`result.pending`).
 */
@Channel({ name: "approval-inbox-channel", description: "Waits for the customer's approval" })
export class ApprovalInboxChannel extends CheckoutApprovalChannel {
  send(): Promise<ChannelOutcome<CheckoutApprovalChannel>> {
    return Promise.resolve(ChannelOutcome.awaitReply());
  }
}

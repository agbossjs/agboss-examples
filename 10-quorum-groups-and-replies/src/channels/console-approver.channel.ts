import { Channel, ChannelOutcome, type ChannelAsk } from "@agboss/core";
import { ApproverInbox } from "../services/approver-inbox.service.js";
import { PurchaseApproverChannel } from "./purchase-approver.channel-role.js";

/**
 * Posts the purchase order to the approvers' inbox once, with its pause's id, and waits: the run
 * pauses until `app.resume({ pauseId, reply })` brings the approver's words.
 */
@Channel({
  name: "console-approver-channel",
  description: "Posts a purchase order to the approvers' inbox",
  deps: [ApproverInbox],
})
export class ConsoleApproverChannel extends PurchaseApproverChannel {
  constructor(private readonly approverInbox: ApproverInbox) {
    super();
  }

  async send(
    ask: ChannelAsk<PurchaseApproverChannel>,
  ): Promise<ChannelOutcome<PurchaseApproverChannel>> {
    const { supplier, itemDescription, amountUsd } = ask.value.arguments;
    await this.approverInbox.post({ pauseId: ask.pauseId, supplier, itemDescription, amountUsd });
    return ChannelOutcome.awaitReply();
  }
}

import { Channel, ChannelOutcome, type ChannelAsk } from "@agboss/core";
import { ApproverInbox } from "../services/approver-inbox.service.js";
import { days } from "@agboss/core/units";
import { PurchaseApproverToolApproval } from "./purchase-approver.tool-approval.js";

/**
 * Posts the purchase order to the approvers' inbox once, with its pause's id, and waits: the run
 * pauses until `app.resume({ pauseId, reply })` brings the approver's words.
 */
@Channel({
  name: "console-approver-channel",
  description: "Posts a purchase order to the approvers' inbox",
  deps: [ApproverInbox],
  target: PurchaseApproverToolApproval,
  ttl: days(14), // how long a closed pause is kept for the channel
})
export class ConsoleApproverChannel {
  constructor(private readonly approverInbox: ApproverInbox) {}

  async send(
    ask: ChannelAsk<PurchaseApproverToolApproval>,
  ): Promise<ChannelOutcome<PurchaseApproverToolApproval>> {
    const { supplier, itemDescription, amountUsd } = ask.input;
    await this.approverInbox.post({
      pauseId: ask.pauseId,
      supplier,
      itemDescription,
      amountUsd,
    });
    return ChannelOutcome.awaitReply();
  }
}

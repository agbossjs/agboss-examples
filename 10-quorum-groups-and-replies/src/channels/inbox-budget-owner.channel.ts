import { Channel, ChannelOutcome, type ChannelAsk } from "@agboss/core";
import { BudgetOwnerInbox } from "../services/budget-owner-inbox.service.js";
import { BudgetOwnerQuestion } from "./budget-owner-question.channel-role.js";

/** Posts the question to the budget owners' inbox once, with its pause's id, and waits for the reply. */
@Channel({
  name: "inbox-budget-owner-channel",
  description: "Posts a budget raise to its owner's inbox",
  deps: [BudgetOwnerInbox],
})
export class InboxBudgetOwnerChannel extends BudgetOwnerQuestion {
  constructor(private readonly budgetOwnerInbox: BudgetOwnerInbox) {
    super();
  }

  async send(ask: ChannelAsk<BudgetOwnerQuestion>): Promise<ChannelOutcome<BudgetOwnerQuestion>> {
    await this.budgetOwnerInbox.post(ask);
    return ChannelOutcome.awaitReply();
  }
}

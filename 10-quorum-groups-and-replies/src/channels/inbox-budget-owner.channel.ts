import { Channel, ChannelOutcome, type ChannelAsk } from "@agboss/core";
import { BudgetOwnerInbox } from "../services/budget-owner-inbox.service.js";
import { days } from "@agboss/core/units";
import { BudgetOwnerExternalTask } from "./budget-owner.external-task.js";

/** Posts the question to the budget owners' inbox once, with its pause's id, and waits for the reply. */
@Channel({
  name: "inbox-budget-owner-channel",
  description: "Posts a budget raise to its owner's inbox",
  deps: [BudgetOwnerInbox],
  target: BudgetOwnerExternalTask,
  ttl: days(14), // how long a closed pause is kept for the channel
})
export class InboxBudgetOwnerChannel {
  constructor(private readonly budgetOwnerInbox: BudgetOwnerInbox) {}

  async send(ask: ChannelAsk<BudgetOwnerExternalTask>): Promise<ChannelOutcome<BudgetOwnerExternalTask>> {
    await this.budgetOwnerInbox.post(ask);
    return ChannelOutcome.awaitReply();
  }
}

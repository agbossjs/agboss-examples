import { Injectable, type ChannelAsk } from "@agboss/core";
import type { BudgetOwnerQuestion } from "../channels/budget-owner-question.channel-role.js";

/**
 * The budget owners' inbox — in production a chat app the owner answers in free text. It keeps
 * every question posted, with its pause's id (the channel's key: `app.resume({ pauseId, reply })`
 * takes it), so the demo and the tests answer by it and count how many times the owner was asked.
 */
@Injectable()
export class BudgetOwnerInbox {
  readonly asked: ChannelAsk<BudgetOwnerQuestion>[] = [];

  post(ask: ChannelAsk<BudgetOwnerQuestion>): Promise<void> {
    this.asked.push(ask);
    console.log(
      `[budget owner] raise ${ask.value.budgetLine} by $${String(ask.value.amountUsd)} for ${ask.value.requester}? — reply to ${ask.pauseId}`,
    );
    return Promise.resolve();
  }

  /** The pause id of the newest question posted. */
  latestPauseId(): string | undefined {
    return this.asked.at(-1)?.pauseId;
  }
}

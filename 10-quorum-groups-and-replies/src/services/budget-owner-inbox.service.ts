import { Injectable, type ChannelAsk } from "@agboss/core";
import type { BudgetOwnerQuestion } from "../channels/budget-owner-question.channel-role.js";

/** One question as the budget owners' inbox holds it: the pause it answers and what is asked. */
export type BudgetOwnerRequest = ChannelAsk<BudgetOwnerQuestion>;

/** The inbox's messages, in the order they were posted (a stand-in for a chat app's channel). */
const posted: BudgetOwnerRequest[] = [];

/**
 * The budget owners' inbox — in production a chat app the owner answers in free text. Here it
 * prints each question once and keeps it, with its pause's id (the channel's key:
 * `app.resume({ pauseId, reply })` takes it), so the demo answers by it. `InboxBudgetOwnerChannel`
 * posts to it; tests replace it (`mockOf`) and read what was posted.
 */
@Injectable()
export class BudgetOwnerInbox {
  post(request: BudgetOwnerRequest): Promise<void> {
    posted.push(request);
    const { budgetLine, amountUsd, requester } = request.value;
    console.log(
      `[budget owner] raise ${budgetLine} by $${String(amountUsd)} for ${requester}? — reply to ${request.pauseId}`,
    );
    return Promise.resolve();
  }

  /** How many questions were posted, and the newest one's pause id. */
  posted(): { readonly count: number; readonly latestPauseId: string | undefined } {
    return { count: posted.length, latestPauseId: posted.at(-1)?.pauseId };
  }
}

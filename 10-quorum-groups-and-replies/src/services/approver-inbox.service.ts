import { Injectable } from "@agboss/core";

/** One approval request as the approver's inbox holds it: the pause it answers and the question. */
export interface ApprovalRequest {
  /** The pause's id — what `app.resume({ pauseId, reply })` takes; the channel's own key. */
  readonly pauseId: string;
  readonly supplier: string;
  readonly itemDescription: string;
  readonly amountUsd: number;
}

/** The inbox's messages, in the order they were posted (a stand-in for a chat app's channel). */
const posted: ApprovalRequest[] = [];

/**
 * The approvers' inbox — in production a chat app or an e-mail queue that the person answers in
 * free text. Here it prints each request once and keeps it, so the demo and the tests can answer it
 * by its pause id. `ConsoleApproverChannel` posts to it; tests read or replace it (`mockOf`).
 */
@Injectable()
export class ApproverInbox {
  post(request: ApprovalRequest): Promise<void> {
    posted.push(request);
    console.log(
      `[approval] ${request.supplier}: ${request.itemDescription}, $${String(request.amountUsd)} — reply to ${request.pauseId}`,
    );
    return Promise.resolve();
  }

  /** The newest request posted, if any. */
  latest(): ApprovalRequest | undefined {
    return posted.at(-1);
  }
}

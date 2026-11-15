import { Injectable } from "@agboss/core";

export interface PostedApproval {
  readonly approver: "approver" | "senior-approver";
  /** The channel's right to answer: only the channel has it, never `result.pending`. */
  readonly pauseId: string;
  readonly orderId: string;
  readonly amountUsd: number;
}

/**
 * The approvers' inbox, standing in for a chat or a ticket queue: what each channel posted, in order.
 * A project's channel posts to Slack, mail or a ticket system with `pauseId` as the reply key.
 */
@Injectable()
export class ApprovalInboxService {
  readonly #posted: PostedApproval[] = [];
  readonly #notes: string[] = [];

  post(approval: PostedApproval): void {
    this.#posted.push(approval);
  }

  posted(): readonly PostedApproval[] {
    return [...this.#posted];
  }

  /** A reminder or a notice of an extension, as the approver's inbox shows it. */
  note(line: string): void {
    this.#notes.push(line);
  }

  notes(): readonly string[] {
    return [...this.#notes];
  }

  newest(approver: PostedApproval["approver"]): PostedApproval | undefined {
    return this.#posted.filter((entry) => entry.approver === approver).at(-1);
  }
}

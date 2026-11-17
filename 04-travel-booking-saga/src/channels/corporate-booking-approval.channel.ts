import {
  Channel,
  type ChannelAsk,
  type ChannelPauseClosedEvent,
  ChannelOutcome,
  type PauseClosedReason,
} from "@agboss/core";
import { BookingApprovalChannelRole } from "./booking-approval.channel-role.js";

export interface RecordedPauseAsk {
  readonly pauseId: string;
  readonly summary: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  /** Set only on the send of a reassignment (`ChannelAsk.assignee`): who the question is for now. */
  readonly assignee: string | undefined;
  /** Set only on the send of a reassignment (`ChannelAsk.replaces`): the old message's pause id. */
  readonly replacesPauseId: string | undefined;
}

/** What the approval message's owner learns when a pause closes: the reason, once per notice. */
export interface RecordedPauseClose {
  readonly pauseId: string;
  readonly reason: PauseClosedReason;
  readonly deliveryId: string;
}

const sentAsks: RecordedPauseAsk[] = [];
const closedAsks: RecordedPauseClose[] = [];
const seenDeliveries = new Set<string>();
let askWaiters: { readonly count: number; readonly resolve: () => void }[] = [];
let closeWaiters: (() => void)[] = [];

export function resetChannelRecords(): void {
  sentAsks.length = 0;
  closedAsks.length = 0;
  seenDeliveries.clear();
  askWaiters = [];
  closeWaiters = [];
}

/**
 * Resolves once the channel has been told of a close. A notice is delivered at least once, after the
 * transition that closed the pause — the run, the resume and the cancel never wait for it.
 */
export function waitForChannelClose(): Promise<void> {
  if (closedAsks.length > 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    closeWaiters.push(resolve);
  });
}

/** Resolves once the channel has been sent `count` asks: the first send, then each reassignment's. */
export function waitForChannelAskSent(count = 1): Promise<void> {
  if (sentAsks.length >= count) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    askWaiters.push({ count, resolve });
  });
}

export function getSentChannelAsks(): readonly RecordedPauseAsk[] {
  return [...sentAsks];
}

export function getClosedChannelAsks(): readonly RecordedPauseClose[] {
  return [...closedAsks];
}

@Channel({
  name: "corporate-booking-approval-channel",
  description: "Posts high-value travel hold approvals and closes the message when the pause closes, whoever closed it",
})
export class CorporateBookingApprovalChannel extends BookingApprovalChannelRole {
  override send(
    ask: ChannelAsk<BookingApprovalChannelRole>,
  ): Promise<ChannelOutcome<BookingApprovalChannelRole>> {
    sentAsks.push({
      pauseId: ask.pauseId,
      summary: ask.value.summary,
      arguments: { ...ask.value.arguments },
      assignee: ask.assignee,
      replacesPauseId: ask.replaces?.pauseId,
    });
    const ready = askWaiters.filter((waiter) => sentAsks.length >= waiter.count);
    askWaiters = askWaiters.filter((waiter) => sentAsks.length < waiter.count);
    for (const waiter of ready) {
      waiter.resolve();
    }
    return Promise.resolve(ChannelOutcome.awaitReply());
  }

  /**
   * At least once, for every close of a pause this channel sent: a cancel, a quorum decided
   * elsewhere, an answer, an expiry. `deliveryId` is the key to deduplicate by: a redelivered
   * notice closes the approval message once.
   */
  override onPauseClosed(event: ChannelPauseClosedEvent<BookingApprovalChannelRole>): Promise<void> {
    if (seenDeliveries.has(event.deliveryId)) {
      return Promise.resolve();
    }
    seenDeliveries.add(event.deliveryId);
    closedAsks.push({
      pauseId: event.pauseId,
      reason: event.reason,
      deliveryId: event.deliveryId,
    });
    for (const waiter of closeWaiters.splice(0)) {
      waiter();
    }
    return Promise.resolve();
  }
}

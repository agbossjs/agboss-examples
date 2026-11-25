import { Channel, ChannelSelector, type ChannelAsk, type ChannelPauseClosedEvent, ChannelOutcome, type PauseClosedReason } from "@agboss/core";
import { days } from "@agboss/core/units";
import { BookingApprovalToolApproval } from "./booking-approval.tool-approval.js";

export interface RecordedPauseAsk {
  readonly pauseId: string;
  readonly summary: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  /** Set only on the send of a reassignment (`ChannelAsk.assignees`): who the question is for now. */
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

/** What both approval channels do: record the ask, learn of every close. */
abstract class BookingApprovalChannelBase {
  send(
    ask: ChannelAsk<BookingApprovalToolApproval>,
  ): Promise<ChannelOutcome<BookingApprovalToolApproval>> {
    sentAsks.push({
      pauseId: ask.pauseId,
      summary: ask.toolCall?.summary ?? "",
      arguments: { ...ask.input },
      assignee: ask.assignees?.[0],
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
  onPauseClosed(event: ChannelPauseClosedEvent<BookingApprovalToolApproval>): Promise<void> {
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

@Channel({
  name: "corporate-booking-approval-channel",
  description: "Posts high-value travel hold approvals and closes the message when the pause closes, whoever closed it",
  target: BookingApprovalToolApproval,
  ttl: days(14), // how long a closed pause is kept for the channel
})
export class CorporateBookingApprovalChannel extends BookingApprovalChannelBase {}

/** The deputy's route: where `app.reassignPause({ channel })` moves an approval when the manager is away. */
@Channel({
  name: "deputy-booking-approval-channel",
  description: "Posts the high-value hold approval to the deputy when the travel manager is away",
  target: BookingApprovalToolApproval,
  ttl: days(14),
})
export class DeputyBookingApprovalChannel extends BookingApprovalChannelBase {}

/** New approvals go to the travel manager's channel; a reassignment names the deputy's. */
@ChannelSelector({
  name: "booking-approval-channel-selector",
  description: "Picks the travel manager's channel for a new approval",
  target: BookingApprovalToolApproval,
})
export class BookingApprovalChannelSelector {
  selectChannel(): typeof CorporateBookingApprovalChannel {
    return CorporateBookingApprovalChannel;
  }
}

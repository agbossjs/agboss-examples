import { ChannelListener, type ChannelListenerClosedEvent, type ChannelListenerHandler, type ChannelListenerOpenedEvent } from "@agboss/core";
import { OnCallLogService } from "../services/on-call-log.service.js";

/**
 * Every pause of the application, whoever asked it: two lines on the on-call log, "opened" and
 * "closed" with the reason (answered, expired, cancelled, …). A notice is delivered at least once,
 * so a redelivered one — the same `deliveryId` — is written once.
 */
@ChannelListener({ name: "refund-desk-pause-listener", deps: [OnCallLogService] })
export class RefundDeskPauseListener implements ChannelListenerHandler {
  readonly #seen = new Set<string>();

  constructor(private readonly log: OnCallLogService) {}

  onPauseOpened(event: ChannelListenerOpenedEvent): Promise<void> {
    if (this.#fresh(event.deliveryId)) {
      this.log.write(`opened ${event.channel ?? "-"} ${event.pauseKey}`);
    }
    return Promise.resolve();
  }

  onPauseClosed(event: ChannelListenerClosedEvent): Promise<void> {
    if (this.#fresh(event.deliveryId)) {
      const by = event.actor === undefined ? "" : ` by ${event.actor.id}`;
      this.log.write(`closed ${event.channel ?? "-"} ${event.pauseKey}: ${event.reason}${by}`);
    }
    return Promise.resolve();
  }

  #fresh(deliveryId: string): boolean {
    if (this.#seen.has(deliveryId)) {
      return false;
    }
    this.#seen.add(deliveryId);
    return true;
  }
}

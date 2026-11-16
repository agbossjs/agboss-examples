import {
  getWithdrawnChannelAsks,
  type RecordedPauseWithdrawal,
} from "../src/channels/corporate-booking-approval.channel.js";

/**
 * The notice of a closed pause is delivered at least once, after the close is written (#940): a
 * scenario that reads the records right after `app.cancel` or the quorum waits for it first.
 */
export async function waitForWithdrawnChannelAsks(
  count = 1,
  timeoutMs = 10_000,
): Promise<readonly RecordedPauseWithdrawal[]> {
  const deadline = Date.now() + timeoutMs;
  while (getWithdrawnChannelAsks().length < count && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 10));
  return getWithdrawnChannelAsks();
}

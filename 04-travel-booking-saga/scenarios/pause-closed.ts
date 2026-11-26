import "../src/scripts/offline-keys.js";
import { createApp, ExecutionStatus, PauseError, type PauseClosedReason } from "@agboss/core";
import { ToolCallApprovalDecisionDto } from "@agboss/core/dto";
import { getSentChannelAsks, getClosedChannelAsks, resetChannelRecords, waitForChannelClose } from "../src/channels/corporate-booking-approval.channel.js";
import { TravelBookingRequestDto } from "../src/dto/travel-booking-request.dto.js";
import { resetOperationLedger } from "../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../src/travel-booking-saga.application.js";
import { QuorumSagaWorkflowStart } from "../src/workflows/quorum-saga/quorum-saga.workflow-start.js";

export interface PauseClosedScenarioResult {
  readonly status: ExecutionStatus;
  readonly outcomeStatus: string | undefined;
  readonly sentPauseId: string;
  readonly closedPauseId: string | undefined;
  readonly closedReason: PauseClosedReason | undefined;
  readonly lateResumeRejectedWithPauseClosed: PauseClosedReason | undefined;
}

/**
 * Scenario F — The Approval Message Closes When the Quorum Finishes First:
 * 1. `FinanceReviewerAgent`, `ComplianceReviewerAgent`, and `RiskReviewerAgent` launch in parallel
 *    under a 2-of-3 quorum (`min: 2, max: 2`).
 * 2. `RiskReviewerAgent` calls `request-manager-approval-tool`, which sends an approval request
 *    to `CorporateBookingApprovalChannel` (`ChannelOutcome.awaitReply()`) and pauses Branch 3.
 * 3. `FinanceReviewerAgent` and `ComplianceReviewerAgent` both return approved votes, satisfying
 *    the 2-of-3 quorum (`max: 2`).
 * 4. AGBoss closes the superseded Branch 3 pause (`PauseResolution.Withdrawn`) and tells
 *    `CorporateBookingApprovalChannel.onPauseClosed()` once, `PauseClosedReason.Withdrawn`.
 * 5. A late `app.resume({ pauseId, decision })` on that pause is rejected with `PauseError.Closed`
 *    (`reason: withdrawn`).
 */
export async function runPauseClosedScenario(
  bookingId = "CLOSED-F1",
): Promise<PauseClosedScenarioResult> {
  resetOperationLedger();
  resetChannelRecords();
  const app = await createApp(TravelBookingSagaApplication);
  try {
    const result = await app.execute(
      QuorumSagaWorkflowStart,
      Object.assign(new TravelBookingRequestDto(), {
        bookingId,
        travelerId: "trav-06",
        flightCode: "ORD-ZRH-606",
        hotelCode: "ZURICH-BAUR-5",
        totalAmountUsd: 5200,
        simulatePaymentDecline: false,
      }),
    );

    const sent = getSentChannelAsks();
    await waitForChannelClose();
    const closed = getClosedChannelAsks();
    const sentPauseId = sent[0]?.pauseId ?? "";

    let lateResumeRejectedWithPauseClosed: PauseClosedReason | undefined;
    if (sentPauseId !== "") {
      try {
        await app.resume(
          {
            pauseId: sentPauseId,
            decision: Object.assign(new ToolCallApprovalDecisionDto(), {
              approved: true,
              reason: "Late click on an already-closed pause",
            }),
          },
          { actor: { id: "risk-manager-7" } },
        );
      } catch (error) {
        lateResumeRejectedWithPauseClosed = error instanceof PauseError.Closed ? error.reason : undefined;
      }
    }

    return {
      status: result.status,
      outcomeStatus: result.output?.status,
      sentPauseId,
      closedPauseId: closed[0]?.pauseId,
      closedReason: closed[0]?.reason,
      lateResumeRejectedWithPauseClosed,
    };
  } finally {
    await app.close();
  }
}

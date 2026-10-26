import {
  createApp,
  ExecutionStatus,
  NotPausedError,
} from "@agboss/core";
import { ToolCallApprovalDecisionDto } from "@agboss/core/dto";
import {
  getSentChannelAsks,
  getWithdrawnChannelAsks,
  resetChannelRecords,
} from "../src/channels/corporate-booking-approval.channel.js";
import { TravelBookingRequestDto } from "../src/dto/travel-booking-request.dto.js";
import { resetOperationLedger } from "../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../src/travel-booking-saga.application.js";
import { QuorumSagaWorkflowStart } from "../src/workflows/quorum-saga/quorum-saga.workflow-start.js";

export interface PauseWithdrawalScenarioResult {
  readonly status: ExecutionStatus;
  readonly outcomeStatus: string | undefined;
  readonly sentPauseId: string;
  readonly withdrawnPauseId: string | undefined;
  readonly withdrawnResolution: string | undefined;
  readonly lateResumeRejectedWithNotPaused: boolean;
}

/**
 * Scenario F — HITL Pause Withdrawal When Quorum Finishes First:
 * 1. `FinanceReviewerAgent`, `ComplianceReviewerAgent`, and `RiskReviewerAgent` launch in parallel
 *    under a 2-of-3 quorum (`min: 2, max: 2`).
 * 2. `RiskReviewerAgent` calls `request-manager-approval-tool`, which sends an approval request
 *    to `CorporateBookingApprovalChannel` (`ChannelOutcome.awaitReply()`) and pauses Branch 3.
 * 3. `FinanceReviewerAgent` and `ComplianceReviewerAgent` both return approved votes, satisfying
 *    the 2-of-3 quorum (`max: 2`).
 * 4. AGBoss automatically cancels the superseded Branch 3 pause and invokes
 *    `CorporateBookingApprovalChannel.withdraw()` with `PauseResolution.Withdrawn`.
 * 5. A late `app.resume({ pauseId, decision })` on the withdrawn pause is rejected with `NotPausedError`.
 */
export async function runPauseWithdrawalScenario(
  bookingId = "WITHDRAW-F1",
): Promise<PauseWithdrawalScenarioResult> {
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
    const withdrawn = getWithdrawnChannelAsks();
    const sentPauseId = sent[0]?.pauseId ?? "";

    let lateResumeRejectedWithNotPaused = false;
    if (sentPauseId !== "") {
      try {
        await app.resume(
          {
            pauseId: sentPauseId,
            decision: Object.assign(new ToolCallApprovalDecisionDto(), {
              approved: true,
              reason: "Late click on already-withdrawn pause",
            }),
          },
          { answeredBy: "risk-manager-7" },
        );
      } catch (error) {
        lateResumeRejectedWithNotPaused = error instanceof NotPausedError;
      }
    }

    return {
      status: result.status,
      outcomeStatus: result.output?.status,
      sentPauseId,
      withdrawnPauseId: withdrawn[0]?.pauseId,
      withdrawnResolution: withdrawn[0]?.resolution,
      lateResumeRejectedWithNotPaused,
    };
  } finally {
    await app.close();
  }
}

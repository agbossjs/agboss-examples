import "../src/scripts/offline-keys.js";
import { createApp, ExecutionStatus, PauseError, type PauseClosedReason } from "@agboss/core";
import { ToolCallApprovalDecisionDto } from "@agboss/core/dto";
import { getSentChannelAsks, getClosedChannelAsks, resetChannelRecords, waitForChannelClose } from "../src/channels/corporate-booking-approval.channel.js";
import { TravelBookingRequestDto } from "../src/dto/travel-booking-request.dto.js";
import { getOperationLedgerEntries, getResourceState, resetOperationLedger } from "../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../src/travel-booking-saga.application.js";
import { HitlHoldSagaWorkflowStart } from "../src/workflows/hitl-hold-saga/hitl-hold-saga.workflow-start.js";

export interface CancelAndRollbackScenarioResult {
  readonly initialStatus: ExecutionStatus;
  readonly cancelled: boolean;
  readonly pauseId: string;
  readonly closedCount: number;
  readonly closedReason: PauseClosedReason | undefined;
  readonly lateResumeRejectedWithPauseClosed: PauseClosedReason | undefined;
  readonly flightState: string | undefined;
  readonly hotelState: string | undefined;
  readonly ledgerEntries: ReturnType<typeof getOperationLedgerEntries>;
}

/**
 * Scenario C — Cancellation & Rollback of a Paused Execution:
 * 1. Flight and hotel reservations succeed.
 * 2. Workflow pauses waiting for manager approval (`CorporateBookingApprovalChannel`).
 * 3. Caller invokes `app.cancel(threadId)`.
 * 4. AGBoss closes the pause (`PauseResolution.Cancelled`), tells the channel once through
 *    `onPauseClosed` (`PauseClosedReason.Cancelled`) and runs open compensations
 *    (`CancelHotelCompensationAction` -> `CancelFlightCompensationAction`) in LIFO order.
 * 5. A late `app.resume({ pauseId, decision })` throws `PauseError.Closed` (`reason: cancelled`).
 */
export async function runCancelAndRollbackScenario(
  bookingId = "SCENARIO-C",
): Promise<CancelAndRollbackScenarioResult> {
  resetOperationLedger();
  resetChannelRecords();
  const app = await createApp(TravelBookingSagaApplication);
  try {
    const pausedRun = await app.execute(
      HitlHoldSagaWorkflowStart,
      Object.assign(new TravelBookingRequestDto(), {
        bookingId,
        travelerId: "trav-03",
        flightCode: "LAX-HND-303",
        hotelCode: "SHIBUYA-STAY-4",
        totalAmountUsd: 4200,
        simulatePaymentDecline: false,
      }),
    );

    const asks = getSentChannelAsks();
    const pauseId = asks[0]?.pauseId ?? "";

    const cancelRes = await app.cancel(pausedRun.threadId);
    await waitForChannelClose();
    const closed = getClosedChannelAsks();

    let lateResumeRejectedWithPauseClosed: PauseClosedReason | undefined;
    try {
      await app.resume(
        {
          pauseId,
          decision: Object.assign(new ToolCallApprovalDecisionDto(), {
            approved: true,
            reason: "Late manager click after cancellation",
          }),
        },
        { actor: { id: "manager-42" } },
      );
    } catch (error) {
      lateResumeRejectedWithPauseClosed = error instanceof PauseError.Closed ? error.reason : undefined;
    }

    return {
      initialStatus: pausedRun.status,
      cancelled: cancelRes.cancelled,
      pauseId,
      closedCount: closed.length,
      closedReason: closed[0]?.reason,
      lateResumeRejectedWithPauseClosed,
      flightState: getResourceState("airline", `FLIGHT-${bookingId}`),
      hotelState: getResourceState("hotel", `HOTEL-${bookingId}`),
      ledgerEntries: getOperationLedgerEntries(),
    };
  } finally {
    await app.close();
  }
}

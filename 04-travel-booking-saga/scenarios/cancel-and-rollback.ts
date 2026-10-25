import {
  createApp,
  ExecutionStatus,
  NotPausedError,
} from "agboss";
import { ToolCallApprovalDecisionDto } from "agboss/dto";
import {
  getSentChannelAsks,
  getWithdrawnChannelAsks,
  resetChannelRecords,
} from "../src/channels/corporate-booking-approval.channel.js";
import { TravelBookingRequestDto } from "../src/dto/travel-booking-request.dto.js";
import {
  getOperationLedgerEntries,
  getResourceState,
  resetOperationLedger,
} from "../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../src/travel-booking-saga.application.js";
import { HitlHoldSagaWorkflowStart } from "../src/workflow-starts/hitl-hold-saga.workflow-start.js";

export interface CancelAndRollbackScenarioResult {
  readonly initialStatus: ExecutionStatus;
  readonly cancelled: boolean;
  readonly pauseId: string;
  readonly withdrawnCount: number;
  readonly withdrawnResolution: string | undefined;
  readonly lateResumeRejectedWithNotPaused: boolean;
  readonly flightState: string | undefined;
  readonly hotelState: string | undefined;
  readonly ledgerEntries: ReturnType<typeof getOperationLedgerEntries>;
}

/**
 * Scenario C — Cancellation & Rollback of a Paused Execution:
 * 1. Flight and hotel reservations succeed.
 * 2. Workflow pauses waiting for manager approval (`CorporateBookingApprovalChannel`).
 * 3. Caller invokes `app.cancel(threadId)`.
 * 4. AGBoss withdraws the channel pause (`PauseResolution.Cancelled`) and runs open compensations
 *    (`CancelHotelCompensationAction` -> `CancelFlightCompensationAction`) in LIFO order.
 * 5. A late `app.resume({ pauseId, decision })` throws `NotPausedError`.
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
    const withdrawn = getWithdrawnChannelAsks();

    let lateResumeRejectedWithNotPaused = false;
    try {
      await app.resume(
        {
          pauseId,
          decision: Object.assign(new ToolCallApprovalDecisionDto(), {
            approved: true,
            reason: "Late manager click after cancellation",
          }),
        },
        { answeredBy: "manager-42" },
      );
    } catch (error) {
      lateResumeRejectedWithNotPaused = error instanceof NotPausedError;
    }

    return {
      initialStatus: pausedRun.status,
      cancelled: cancelRes.cancelled,
      pauseId,
      withdrawnCount: withdrawn.length,
      withdrawnResolution: withdrawn[0]?.resolution,
      lateResumeRejectedWithNotPaused,
      flightState: getResourceState("airline", `FLIGHT-${bookingId}`),
      hotelState: getResourceState("hotel", `HOTEL-${bookingId}`),
      ledgerEntries: getOperationLedgerEntries(),
    };
  } finally {
    await app.close();
  }
}

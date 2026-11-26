import "../src/scripts/offline-keys.js";
import { createApp, ExecutionStatus, PauseError, type PauseClosedReason } from "@agboss/core";
import { ToolCallApprovalDecisionDto } from "@agboss/core/dto";
import { hours } from "@agboss/core/units";
import { DeputyBookingApprovalChannel, getClosedChannelAsks, getSentChannelAsks, resetChannelRecords, waitForChannelAskSent, waitForChannelClose } from "../src/channels/corporate-booking-approval.channel.js";
import { TravelBookingRequestDto } from "../src/dto/travel-booking-request.dto.js";
import { getOperationLedgerEntries, resetOperationLedger } from "../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../src/travel-booking-saga.application.js";
import { HitlHoldSagaWorkflowStart } from "../src/workflows/hitl-hold-saga/hitl-hold-saga.workflow-start.js";

export interface ManagerAwayScenarioResult {
  readonly initialStatus: ExecutionStatus;
  readonly deadlineMovedForward: boolean;
  readonly sends: readonly {
    readonly pauseId: string;
    readonly assignee: string | undefined;
    readonly replacesPauseId: string | undefined;
  }[];
  readonly closedNotices: readonly { readonly pauseId: string; readonly reason: PauseClosedReason }[];
  readonly reassignmentExposesNewPauseId: boolean;
  readonly oldPauseAnswerRejectedWith: PauseClosedReason | undefined;
  readonly pendingAfterReassign: number;
  readonly pendingDeadlineIsTheExtendedOne: boolean;
  readonly finalStatus: ExecutionStatus;
  readonly outcomeStatus: string | undefined;
  readonly reservations: { readonly flights: number; readonly hotels: number };
}

const approval = (reason: string): ToolCallApprovalDecisionDto =>
  Object.assign(new ToolCallApprovalDecisionDto(), { approved: true, reason });

/** `resume` types its output as unknown: read the finish DTO's `status` without a cast. */
function statusOf(output: unknown): string | undefined {
  return typeof output === "object" && output !== null && "status" in output && typeof output.status === "string"
    ? output.status
    : undefined;
}

/**
 * Scenario G — The Manager Is Away: the Approval Moves to a Deputy:
 * 1. Flight and hotel are reserved, the approval is posted to the travel manager, the run pauses.
 * 2. `app.extendPause` gives the question 24 hours instead of the role's 4 (a pause with `expiresIn`).
 * 3. The manager is on leave: `app.reassignPause({ pauseId, assignees: ["deputy"] })` moves the open question.
 *    The agent and the reservations do not run again. The channel is sent again, with a new
 *    `pauseId`, `ChannelAsk.assignee` and `ChannelAsk.replaces`, and told `onPauseClosed` with
 *    `PauseClosedReason.Reassigned` for the old message.
 * 4. The old pause id answers nothing (`PauseError.Closed`, `reason: reassigned`); the call returned the new
 *    pause's key only — the new id is a capability that reached the channel alone.
 * 5. The deputy approves through the new id and the saga completes.
 */
export async function runManagerAwayScenario(bookingId = "AWAY-G1"): Promise<ManagerAwayScenarioResult> {
  resetOperationLedger();
  resetChannelRecords();
  const app = await createApp(TravelBookingSagaApplication);
  try {
    const pausedRun = await app.execute(
      HitlHoldSagaWorkflowStart,
      Object.assign(new TravelBookingRequestDto(), {
        bookingId,
        travelerId: "trav-07",
        flightCode: "JFK-CDG-707",
        hotelCode: "PARIS-RIVOLI-5",
        totalAmountUsd: 7400,
        simulatePaymentDecline: false,
      }),
    );
    const managerPauseId = getSentChannelAsks()[0]?.pauseId ?? "";
    const operator = { actor: { id: "travel-desk-operator" } };

    const extension = await app.extendPause({ pauseId: managerPauseId, expiresIn: hours(24) }, operator);

    const reassignment = await app.reassignPause({ pauseId: managerPauseId, channel: DeputyBookingApprovalChannel, assignees: ["deputy"] }, operator);
    await waitForChannelAskSent(2);
    await waitForChannelClose();

    const sends = getSentChannelAsks().map(({ pauseId, assignee, replacesPauseId }) => ({
      pauseId,
      assignee,
      replacesPauseId,
    }));
    const closedNotices = getClosedChannelAsks().map(({ pauseId, reason }) => ({ pauseId, reason }));
    const deputyPauseId = sends[1]?.pauseId ?? "";

    let oldPauseAnswerRejectedWith: PauseClosedReason | undefined;
    try {
      await app.resume({ pauseId: managerPauseId, decision: approval("Manager clicks from the airport") }, operator);
    } catch (error) {
      oldPauseAnswerRejectedWith = error instanceof PauseError.Closed ? error.reason : undefined;
    }

    const pending = await app.listPauses({ tenantId: "default" });
    const finished = await app.resume(
      { pauseId: deputyPauseId, decision: approval("Deputy approves the hold") },
      { actor: { id: "deputy" } },
    );

    const ledger = getOperationLedgerEntries();
    return {
      initialStatus: pausedRun.status,
      deadlineMovedForward: Date.parse(extension.expiresAt) > Date.parse(extension.previousExpiresAt),
      sends,
      closedNotices,
      reassignmentExposesNewPauseId: JSON.stringify(reassignment).includes(deputyPauseId),
      oldPauseAnswerRejectedWith,
      pendingAfterReassign: pending.pauses.length,
      pendingDeadlineIsTheExtendedOne: pending.pauses.every((pause) => pause.expiresAt === extension.expiresAt),
      finalStatus: finished.status,
      outcomeStatus: statusOf(finished.output),
      reservations: {
        flights: ledger.filter((entry) => entry.service === "airline" && entry.operation === "reserve" && !entry.deduplicated).length,
        hotels: ledger.filter((entry) => entry.service === "hotel" && entry.operation === "reserve" && !entry.deduplicated).length,
      },
    };
  } finally {
    await app.close();
  }
}

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CompensationFailedError,
  CompensationStatus,
  createApp,
  ExecutionStatus,
} from "@agboss/core";
import { ToolCallApprovalDecisionDto } from "@agboss/core/dto";
import {
  getSentChannelAsks,
  resetChannelRecords,
} from "../src/channels/corporate-booking-approval.channel.js";
import { TravelBookingRequestDto } from "../src/dto/travel-booking-request.dto.js";
import { FakeAirlineService } from "../src/services/fake-airline.service.js";
import { FakeHotelService } from "../src/services/fake-hotel.service.js";
import {
  getOperationLedgerEntries,
  getResourceState,
  injectTransientCancelFailureOnce,
  resetOperationLedger,
} from "../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../src/travel-booking-saga.application.js";
import { BudgetSagaWorkflowStart } from "../src/workflows/budget-saga/budget-saga.workflow-start.js";
import { HitlHoldSagaWorkflowStart } from "../src/workflows/hitl-hold-saga/hitl-hold-saga.workflow-start.js";

export interface RollbackCrashScenarioResult {
  readonly compensationFailedErrorSurfaced: boolean;
  readonly failedCompensatorName: string | undefined;
  readonly failedCompensationIdempotencyKey: string | undefined;
  readonly hotelStateAfterFirstAttempt: string | undefined;
  readonly flightStateAfterFirstAttempt: string | undefined;
  readonly flightStateAfterRecoveryReplay: string | undefined;
  readonly hotelStateAfterRecoveryReplay: string | undefined;
  readonly sqliteResumedAcrossRestartStatus: ExecutionStatus;
  readonly sqliteResumedOutputStatus: string | undefined;
  readonly ledgerEntries: ReturnType<typeof getOperationLedgerEntries>;
}

/**
 * Scenario D — Crash During Compensation & SQLite Cross-Restart Recovery:
 * Part 1: Injects a transient failure into `FakeAirlineService.releaseSeat` during automatic rollback.
 *   - Verifies that `CancelHotelCompensationAction` still succeeds (`HOTEL` -> `RELEASED`),
 *   - `CompensationFailedError` is surfaced with the exact failed `CompensationRecord` and step idempotency key,
 *   - Re-running the compensation sequence with the deterministic idempotency keys deduplicates the
 *     already-released hotel (`deduplicated: true`) and completes the airline release (`FLIGHT` -> `RELEASED`).
 * Part 2: Runs `TravelBookingSqliteApplication` against a real SQLite database file on disk, pauses on
 *   Instance 1, closes Instance 1 (simulating process restart), opens Instance 2 on the same SQLite file,
 *   and resumes the paused execution to `CONFIRMED` without re-executing `ReserveFlightAction` or `ReserveHotelAction`.
 */
export async function runRollbackCrashScenario(
  bookingId = "BUDGET-EXCEED-CRASH-D1",
): Promise<RollbackCrashScenarioResult> {
  resetOperationLedger();
  injectTransientCancelFailureOnce(bookingId);

  const app = await createApp(TravelBookingSagaApplication);
  let compensationFailedErrorSurfaced = false;
  let failedCompensatorName: string | undefined;
  let failedCompensationIdempotencyKey: string | undefined;
  let hotelCompensationIdempotencyKey = "";

  try {
    try {
      await app.execute(
        BudgetSagaWorkflowStart,
        Object.assign(new TravelBookingRequestDto(), {
          bookingId,
          travelerId: "trav-04",
          flightCode: "SEA-ICN-404",
          hotelCode: "SEOUL-LOTTE-5",
          totalAmountUsd: 2900,
          simulatePaymentDecline: false,
        }),
      );
    } catch (error) {
      if (error instanceof CompensationFailedError) {
        compensationFailedErrorSurfaced = true;
        const firstFailure = error.failures[0];
        if (firstFailure?.status === CompensationStatus.Failed) {
          failedCompensatorName = firstFailure.compensator.name;
          failedCompensationIdempotencyKey = `${firstFailure.compensated.idempotencyKey}:compensation`;
        }
      }
    }

    const entriesAfterCrash = getOperationLedgerEntries();
    const hotelReleaseEntry = entriesAfterCrash.find(
      (e) => e.service === "hotel" && e.operation === "release",
    );
    hotelCompensationIdempotencyKey = hotelReleaseEntry?.idempotencyKey ?? "";

    const hotelStateAfterFirstAttempt = getResourceState("hotel", `HOTEL-${bookingId}`);
    const flightStateAfterFirstAttempt = getResourceState("airline", `FLIGHT-${bookingId}`);

    // Replay both compensations using their deterministic step idempotency keys:
    // Hotel release is deduplicated; Airline release succeeds on retry.
    const hotelService = app.resolve(FakeHotelService);
    const airlineService = app.resolve(FakeAirlineService);

    hotelService.releaseRoom({
      bookingId,
      hotelReservationId: `HOTEL-${bookingId}`,
      idempotencyKey: hotelCompensationIdempotencyKey,
    });
    airlineService.releaseSeat({
      bookingId,
      flightReservationId: `FLIGHT-${bookingId}`,
      idempotencyKey: failedCompensationIdempotencyKey ?? "fallback-key",
    });

    const flightStateAfterRecoveryReplay = getResourceState("airline", `FLIGHT-${bookingId}`);
    const hotelStateAfterRecoveryReplay = getResourceState("hotel", `HOTEL-${bookingId}`);

    // Part 2: SQLite Cross-Restart Pause & Resume Recovery
    const tempDir = mkdtempSync(join(tmpdir(), "agboss-saga-sqlite-"));
    const sqliteFile = join(tempDir, "saga-recovery.sqlite");
    const previousSqliteEnv = process.env["SQLITE_PATH"];
    process.env["SQLITE_PATH"] = sqliteFile;
    resetChannelRecords();

    let sqliteResumedAcrossRestartStatus = ExecutionStatus.Paused;
    let sqliteResumedOutputStatus: string | undefined;

    try {
      const sqliteBookingId = "SQLITE-RESTART-D2";
      const instance1 = await createApp(TravelBookingSagaApplication);
      const paused = await instance1.execute(
        HitlHoldSagaWorkflowStart,
        Object.assign(new TravelBookingRequestDto(), {
          bookingId: sqliteBookingId,
          travelerId: "trav-04-sqlite",
          flightCode: "BOS-CDG-405",
          hotelCode: "PARIS-RITZ-5",
          totalAmountUsd: 3500,
          simulatePaymentDecline: false,
        }),
      );
      expectPaused(paused.status);
      const pauseId = getSentChannelAsks()[0]?.pauseId ?? "";
      // Shut down Instance 1 completely
      await instance1.close();

      // Start fresh Instance 2 pointing at the same SQLite database file
      const instance2 = await createApp(TravelBookingSagaApplication);
      try {
        const resumed = await instance2.resume(
          {
            pauseId,
            decision: Object.assign(new ToolCallApprovalDecisionDto(), {
              approved: true,
              reason: "Approved after process restart on Instance 2",
            }),
          },
          { answeredBy: "director-99" },
        );
        sqliteResumedAcrossRestartStatus = resumed.status;
        sqliteResumedOutputStatus = (resumed.output as { status?: string } | undefined)?.status;
      } finally {
        await instance2.close();
      }
    } finally {
      if (previousSqliteEnv === undefined) {
        delete process.env["SQLITE_PATH"];
      } else {
        process.env["SQLITE_PATH"] = previousSqliteEnv;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }

    return {
      compensationFailedErrorSurfaced,
      failedCompensatorName,
      failedCompensationIdempotencyKey,
      hotelStateAfterFirstAttempt,
      flightStateAfterFirstAttempt,
      flightStateAfterRecoveryReplay,
      hotelStateAfterRecoveryReplay,
      sqliteResumedAcrossRestartStatus,
      sqliteResumedOutputStatus,
      ledgerEntries: getOperationLedgerEntries(),
    };
  } finally {
    await app.close();
  }
}

function expectPaused(status: ExecutionStatus): void {
  if (status !== ExecutionStatus.Paused) {
    throw new Error(`Expected ExecutionStatus.Paused, got ${status}`);
  }
}

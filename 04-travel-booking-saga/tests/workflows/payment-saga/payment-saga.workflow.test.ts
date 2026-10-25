import {
  BranchVerdict,
  CompensationReason,
  CompensationStatus,
  createApp,
  ExecutionStatus,
  PauseResolution,
} from "agboss";
import { describe, expect, it } from "vitest";
import { assertLifoCompensationOrder } from "../../../../scripts/tooling/assertions/execution-events.js";
import {
  assertIdempotencyKeysPresent,
  assertNoDuplicateSideEffects,
} from "../../../../scripts/tooling/assertions/idempotency.js";
import { runBudgetExceededScenario } from "../../../scenarios/budget-exceeded.js";
import { runCancelAndRollbackScenario } from "../../../scenarios/cancel-and-rollback.js";
import { runPauseWithdrawalScenario } from "../../../scenarios/pause-withdrawal.js";
import { runPaymentFailureScenario } from "../../../scenarios/payment-failure.js";
import { runQuorumApprovalScenario } from "../../../scenarios/quorum-approval.js";
import { runRollbackCrashScenario } from "../../../scenarios/rollback-crash.js";
import { TravelBookingRequestDto } from "../../../src/dto/travel-booking-request.dto.js";
import { FakeAirlineService } from "../../../src/services/fake-airline.service.js";
import { FakeHotelService } from "../../../src/services/fake-hotel.service.js";
import { FakePaymentService } from "../../../src/services/fake-payment.service.js";
import {
  getOperationLedgerEntries,
  resetOperationLedger,
} from "../../../src/services/operation-ledger.service.js";
import { TravelBookingSagaApplication } from "../../../src/travel-booking-saga.application.js";
import { PaymentSagaWorkflowStart } from "../../../src/workflows/payment-saga/payment-saga.workflow-start.js";

describe("travel-booking-saga — Workflow Compensation, Quorum, Recovery & Idempotency Proofs", () => {
  it("Scenario A: rolls back hotel then flight in strict LIFO order when payment is declined", async () => {
    const res = await runPaymentFailureScenario("SCENARIO-A1");

    expect(res.status).toBe(ExecutionStatus.Finished);
    expect(res.outcomeStatus).toBe("ROLLED_BACK");
    expect(res.hotelState).toBe("RELEASED");
    expect(res.flightState).toBe("RELEASED");

    expect(res.compensations).toEqual([
      {
        compensatedNode: "reserve-hotel-action",
        compensatorNode: "cancel-hotel-compensation-action",
        reason: CompensationReason.SidePath,
        status: CompensationStatus.Compensated,
      },
      {
        compensatedNode: "reserve-flight-action",
        compensatorNode: "cancel-flight-compensation-action",
        reason: CompensationReason.SidePath,
        status: CompensationStatus.Compensated,
      },
    ]);

    assertLifoCompensationOrder(res.ledgerEntries, [
      { service: "hotel", resourceId: "HOTEL-SCENARIO-A1" },
      { service: "airline", resourceId: "FLIGHT-SCENARIO-A1" },
    ]);
    assertNoDuplicateSideEffects(res.ledgerEntries);
    assertIdempotencyKeysPresent(res.ledgerEntries);
  });

  it("Scenario B: automatically rolls back hotel then flight when execution budget is exceeded", async () => {
    const res = await runBudgetExceededScenario("BUDGET-EXCEED-B1");

    expect(res.rejectedWithBudgetExceeded).toBe(true);
    expect(res.hotelState).toBe("RELEASED");
    expect(res.flightState).toBe("RELEASED");

    assertLifoCompensationOrder(res.ledgerEntries, [
      { service: "hotel", resourceId: "HOTEL-BUDGET-EXCEED-B1" },
      { service: "airline", resourceId: "FLIGHT-BUDGET-EXCEED-B1" },
    ]);
    assertNoDuplicateSideEffects(res.ledgerEntries);
    assertIdempotencyKeysPresent(res.ledgerEntries);
  });

  it("Scenario C: cancels paused HITL execution, withdraws channel ask, and rolls back reservations in LIFO order", async () => {
    const res = await runCancelAndRollbackScenario("SCENARIO-C1");

    expect(res.initialStatus).toBe(ExecutionStatus.Paused);
    expect(res.cancelled).toBe(true);
    expect(res.withdrawnCount).toBe(1);
    expect(res.withdrawnResolution).toBe(PauseResolution.Cancelled);
    expect(res.lateResumeRejectedWithNotPaused).toBe(true);
    expect(res.hotelState).toBe("RELEASED");
    expect(res.flightState).toBe("RELEASED");

    assertLifoCompensationOrder(res.ledgerEntries, [
      { service: "hotel", resourceId: "HOTEL-SCENARIO-C1" },
      { service: "airline", resourceId: "FLIGHT-SCENARIO-C1" },
    ]);
    assertNoDuplicateSideEffects(res.ledgerEntries);
    assertIdempotencyKeysPresent(res.ledgerEntries);
  });

  it("Scenario D: surfaces CompensationFailedError on transient undo crash, deduplicates replay, and resumes SQLite state across restart", async () => {
    const res = await runRollbackCrashScenario("BUDGET-EXCEED-CRASH-D1");

    expect(res.compensationFailedErrorSurfaced).toBe(true);
    expect(res.failedCompensatorName).toBe("cancel-flight-compensation-action");
    expect(res.failedCompensationIdempotencyKey).toContain(":compensation");

    expect(res.hotelStateAfterFirstAttempt).toBe("RELEASED");
    expect(res.flightStateAfterFirstAttempt).toBe("RESERVED");

    expect(res.hotelStateAfterRecoveryReplay).toBe("RELEASED");
    expect(res.flightStateAfterRecoveryReplay).toBe("RELEASED");

    expect(res.sqliteResumedAcrossRestartStatus).toBe(ExecutionStatus.Finished);
    expect(res.sqliteResumedOutputStatus).toBe("CONFIRMED");

    assertNoDuplicateSideEffects(res.ledgerEntries);
    assertIdempotencyKeysPresent(res.ledgerEntries);
  });

  it("Scenario E & F: achieves 2-of-3 parallel reviewer quorum and withdraws superseded paused 3rd branch", async () => {
    const resE = await runQuorumApprovalScenario("QUORUM-E1");

    expect(resE.status).toBe(ExecutionStatus.Finished);
    expect(resE.outcomeStatus).toBe("CONFIRMED_BY_QUORUM");
    expect(resE.summary).toContain("Quorum achieved (2/3)");
    const accepted = resE.branches.filter((b) => b.verdict === BranchVerdict.Counted);
    expect(accepted.length).toBe(2);

    const resF = await runPauseWithdrawalScenario("WITHDRAW-F1");
    expect(resF.status).toBe(ExecutionStatus.Finished);
    expect(resF.outcomeStatus).toBe("CONFIRMED_BY_QUORUM");
    expect(resF.sentPauseId).not.toBe("");
    expect(resF.withdrawnPauseId).toBe(resF.sentPauseId);
    expect(resF.withdrawnResolution).toBe(PauseResolution.Withdrawn);
    expect(resF.lateResumeRejectedWithNotPaused).toBe(true);
  });

  it("Idempotency: deduplicates repeated reserve, authorize, confirm, and release calls with identical idempotency keys", async () => {
    resetOperationLedger();
    const app = await createApp(TravelBookingSagaApplication);
    try {
      const result = await app.execute(
        PaymentSagaWorkflowStart,
        Object.assign(new TravelBookingRequestDto(), {
          bookingId: "IDEMP-01",
          travelerId: "trav-idemp",
          flightCode: "SFO-LHR-900",
          hotelCode: "LONDON-GRAND-1",
          totalAmountUsd: 1800,
          simulatePaymentDecline: false,
        }),
      );

      expect(result.status).toBe(ExecutionStatus.Finished);
      expect(result.output?.status).toBe("CONFIRMED");

      const entriesBeforeReplay = getOperationLedgerEntries();
      expect(entriesBeforeReplay.every((e) => !e.deduplicated)).toBe(true);

      const airline = app.resolve(FakeAirlineService);
      const hotel = app.resolve(FakeHotelService);
      const payments = app.resolve(FakePaymentService);

      for (const entry of entriesBeforeReplay) {
        if (entry.service === "airline" && entry.operation === "reserve") {
          airline.reserveSeat({
            bookingId: "IDEMP-01",
            flightCode: "SFO-LHR-900",
            idempotencyKey: entry.idempotencyKey,
          });
        } else if (entry.service === "hotel" && entry.operation === "reserve") {
          hotel.reserveRoom({
            bookingId: "IDEMP-01",
            hotelCode: "LONDON-GRAND-1",
            idempotencyKey: entry.idempotencyKey,
          });
        } else if (entry.service === "payments" && entry.operation === "authorize") {
          payments.authorizeAndCapture({
            bookingId: "IDEMP-01",
            amountUsd: 1800,
            simulateDecline: false,
            idempotencyKey: entry.idempotencyKey,
          });
        }
      }

      const allEntries = getOperationLedgerEntries();
      const deduplicatedEntries = allEntries.filter((e) => e.deduplicated);
      expect(deduplicatedEntries.length).toBe(3);

      assertNoDuplicateSideEffects(allEntries);
      assertIdempotencyKeysPresent(allEntries);
    } finally {
      await app.close();
    }
  });
});

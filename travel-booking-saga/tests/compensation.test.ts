import {
  CompensationReason,
  CompensationStatus,
  ExecutionStatus,
  PauseResolution,
} from "agboss";
import { describe, expect, it } from "vitest";
import { assertLifoCompensationOrder } from "../../tooling/assertions/execution-events.js";
import {
  assertIdempotencyKeysPresent,
  assertNoDuplicateSideEffects,
} from "../../tooling/assertions/idempotency.js";
import { runBudgetExceededScenario } from "../scenarios/budget-exceeded.js";
import { runCancelAndRollbackScenario } from "../scenarios/cancel-and-rollback.js";
import { runPaymentFailureScenario } from "../scenarios/payment-failure.js";

describe("travel-booking-saga — Saga Compensation Proofs (Scenarios A, B, C)", () => {
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
});

import { ExecutionStatus } from "agboss";
import { describe, expect, it } from "vitest";
import {
  assertIdempotencyKeysPresent,
  assertNoDuplicateSideEffects,
} from "../../scripts/tooling/assertions/idempotency.js";
import { runRollbackCrashScenario } from "../scenarios/rollback-crash.js";

describe("travel-booking-saga — Crash During Rollback & SQLite Cross-Restart Recovery (Scenario D)", () => {
  it("Scenario D: surfaces CompensationFailedError on transient undo crash, deduplicates replay, and resumes SQLite state across restart", async () => {
    const res = await runRollbackCrashScenario("BUDGET-EXCEED-CRASH-D1");

    expect(res.compensationFailedErrorSurfaced).toBe(true);
    expect(res.failedCompensatorName).toBe("cancel-flight-compensation-action");
    expect(res.failedCompensationIdempotencyKey).toContain(":compensation");

    // Hotel compensation succeeded on first attempt even though flight compensation crashed
    expect(res.hotelStateAfterFirstAttempt).toBe("RELEASED");
    expect(res.flightStateAfterFirstAttempt).toBe("RESERVED");

    // After replaying compensations with deterministic step idempotency keys:
    expect(res.hotelStateAfterRecoveryReplay).toBe("RELEASED");
    expect(res.flightStateAfterRecoveryReplay).toBe("RELEASED");

    // SQLite cross-restart pause & resume:
    expect(res.sqliteResumedAcrossRestartStatus).toBe(ExecutionStatus.Finished);
    expect(res.sqliteResumedOutputStatus).toBe("CONFIRMED");

    assertNoDuplicateSideEffects(res.ledgerEntries);
    assertIdempotencyKeysPresent(res.ledgerEntries);
  });
});

import { PauseClosedReason } from "@agboss/core";
import { installOfflineNetworkGuard } from "../../scripts/tooling/offline-transports.js";
import { runBudgetExceededScenario } from "../scenarios/budget-exceeded.js";
import { runCancelAndRollbackScenario } from "../scenarios/cancel-and-rollback.js";
import { runPauseClosedScenario } from "../scenarios/pause-closed.js";
import { runPaymentFailureScenario } from "../scenarios/payment-failure.js";
import { runQuorumApprovalScenario } from "../scenarios/quorum-approval.js";
import { runRollbackCrashScenario } from "../scenarios/rollback-crash.js";

async function main(): Promise<void> {
  const restoreFetch = installOfflineNetworkGuard();
  try {
    const scenarioA = await runPaymentFailureScenario();
    const scenarioB = await runBudgetExceededScenario();
    const scenarioC = await runCancelAndRollbackScenario();
    const scenarioD = await runRollbackCrashScenario();
    const scenarioE = await runQuorumApprovalScenario();
    const scenarioF = await runPauseClosedScenario();

    if (
      !scenarioB.rejectedWithBudgetExceeded ||
      !scenarioC.cancelled ||
      !scenarioD.compensationFailedErrorSurfaced ||
      scenarioF.lateResumeRejectedWithPauseClosed !== PauseClosedReason.Withdrawn
    ) {
      throw new Error("One or more Travel Booking Saga demo assertions failed.");
    }

    console.log(
      JSON.stringify(
        {
          scenarioA_PaymentFailure: {
            outcomeStatus: scenarioA.outcomeStatus,
            compensations: scenarioA.compensations,
            flightState: scenarioA.flightState,
            hotelState: scenarioA.hotelState,
          },
          scenarioB_BudgetExceeded: {
            rejectedWithBudgetExceeded: scenarioB.rejectedWithBudgetExceeded,
            flightState: scenarioB.flightState,
            hotelState: scenarioB.hotelState,
          },
          scenarioC_CancelAndRollback: {
            cancelled: scenarioC.cancelled,
            closedCount: scenarioC.closedCount,
            closedReason: scenarioC.closedReason,
            lateResumeRejectedWithPauseClosed: scenarioC.lateResumeRejectedWithPauseClosed,
            flightState: scenarioC.flightState,
            hotelState: scenarioC.hotelState,
          },
          scenarioD_RollbackCrashAndSqliteRecovery: {
            compensationFailedErrorSurfaced: scenarioD.compensationFailedErrorSurfaced,
            flightStateAfterRecoveryReplay: scenarioD.flightStateAfterRecoveryReplay,
            sqliteResumedAcrossRestartStatus: scenarioD.sqliteResumedAcrossRestartStatus,
            sqliteResumedOutputStatus: scenarioD.sqliteResumedOutputStatus,
          },
          scenarioE_QuorumApproval: {
            outcomeStatus: scenarioE.outcomeStatus,
            summary: scenarioE.summary,
            branches: scenarioE.branches,
          },
          scenarioF_PauseClosed: {
            outcomeStatus: scenarioF.outcomeStatus,
            closedReason: scenarioF.closedReason,
            lateResumeRejectedWithPauseClosed: scenarioF.lateResumeRejectedWithPauseClosed,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    restoreFetch();
  }
}

await main();

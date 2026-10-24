import { runBudgetExceededScenario } from "../scenarios/budget-exceeded.js";
import { runCancelAndRollbackScenario } from "../scenarios/cancel-and-rollback.js";
import { runPauseWithdrawalScenario } from "../scenarios/pause-withdrawal.js";
import { runPaymentFailureScenario } from "../scenarios/payment-failure.js";
import { runQuorumApprovalScenario } from "../scenarios/quorum-approval.js";
import { runRollbackCrashScenario } from "../scenarios/rollback-crash.js";

async function main(): Promise<void> {
  const scenarioA = await runPaymentFailureScenario();
  const scenarioB = await runBudgetExceededScenario();
  const scenarioC = await runCancelAndRollbackScenario();
  const scenarioD = await runRollbackCrashScenario();
  const scenarioE = await runQuorumApprovalScenario();
  const scenarioF = await runPauseWithdrawalScenario();

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
          withdrawnResolution: scenarioC.withdrawnResolution,
          lateResumeRejectedWithNotPaused: scenarioC.lateResumeRejectedWithNotPaused,
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
        scenarioF_PauseWithdrawal: {
          outcomeStatus: scenarioF.outcomeStatus,
          withdrawnResolution: scenarioF.withdrawnResolution,
          lateResumeRejectedWithNotPaused: scenarioF.lateResumeRejectedWithNotPaused,
        },
      },
      null,
      2,
    ),
  );
}

await main();

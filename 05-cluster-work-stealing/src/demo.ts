import { ExecutionStatus, HealthStatus } from "agboss";
import { installOfflineNetworkGuard } from "../../scripts/tooling/offline-transports.js";
import { runBackpressureAndReadinessScenario } from "../scenarios/backpressure-and-readiness.js";
import { runWorkStealingAndRecursionScenario } from "../scenarios/work-stealing-and-recursion.js";

const restoreFetch = installOfflineNetworkGuard();
try {
  const workStealing = await runWorkStealingAndRecursionScenario();
  const health = await runBackpressureAndReadinessScenario();

  if (
    workStealing.batchStatus !== ExecutionStatus.Finished ||
    workStealing.batchSummary.succeededCount !== 4 ||
    workStealing.batchSummary.failedCount !== 0 ||
    workStealing.committedChunkEffects !== 4
  ) {
    throw new Error(
      `Expected 4 succeeded chunks and 0 failed chunks in cluster demo, got: ${JSON.stringify(workStealing)}`,
    );
  }

  if (workStealing.recursiveStatus !== ExecutionStatus.Finished) {
    throw new Error(
      `Expected recursive decomposer to finish cleanly, got: ${String(workStealing.recursiveStatus)}`,
    );
  }

  if (
    health.livenessStatus !== HealthStatus.Healthy ||
    health.readinessStatus !== HealthStatus.Healthy ||
    !health.hasStepSlotsComponent ||
    !health.hasProjectHealthCheckComponent
  ) {
    throw new Error(
      `Expected healthy liveness/readiness with StepSlots and ProjectHealthCheck, got: ${JSON.stringify(health)}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        project: "cluster-work-stealing",
        status: "passed",
        workStealing,
        health,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  restoreFetch();
}

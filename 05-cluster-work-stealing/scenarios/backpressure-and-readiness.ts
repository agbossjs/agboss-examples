import {
  createApp,
  HealthComponentKind,
  HealthStatus,
  type HealthReport,
} from "@agboss/core";
import { ClusterWorkStealingApplication } from "../src/cluster-work-stealing.application.js";

export interface BackpressureHealthSummary {
  readonly livenessStatus: HealthStatus;
  readonly readinessStatus: HealthStatus;
  readonly hasStepSlotsComponent: boolean;
  readonly hasProjectHealthCheckComponent: boolean;
}

export function summarizeHealthReport(
  liveness: HealthReport,
  readiness: HealthReport,
): BackpressureHealthSummary {
  return {
    livenessStatus: liveness.status,
    readinessStatus: readiness.status,
    hasStepSlotsComponent: readiness.components.some(
      (c) => c.kind === HealthComponentKind.StepSlots,
    ),
    hasProjectHealthCheckComponent: readiness.components.some(
      (c) =>
        c.kind === HealthComponentKind.Project &&
        c.name === "storage-cluster-health-check",
    ),
  };
}

export async function runBackpressureAndReadinessScenario(): Promise<BackpressureHealthSummary> {
  const app = await createApp(ClusterWorkStealingApplication);
  const liveness = await app.checkLiveness();
  const readiness = await app.checkReadiness();
  await app.close();
  return summarizeHealthReport(liveness, readiness);
}

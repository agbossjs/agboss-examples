import {
  Application,
  SqliteCheckpointSaver,
  SqliteChildExecutionQueueRepository,
  SqliteConnection,
  SqliteCostLedgerRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
} from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { ScalingAppDailyBudget } from "./budgets/scaling-app-daily.budget.js";
import { ScalingExecutionBudget } from "./budgets/scaling-execution.budget.js";
import { ScalingTenantDailyBudget } from "./budgets/scaling-tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { BatchWorkflow } from "./workflows/batch/batch.workflow.js";
import { JobWorkflow } from "./workflows/job/job.workflow.js";

/**
 * The worker: four step slots per pod (`maxConcurrentSteps`, the target of the scale rule:
 * Wiki → Autoscaling), a 30 s graceful stop (`shutdownTimeout`, below the pod's
 * `terminationGracePeriodSeconds`), the shared stores on SQLite here — #487 lists the PostgreSQL
 * ones of `@agboss/postgres` instead, nothing else changes.
 */
@Application({
  name: "kubernetes-scaling-application",
  version: "1.0.0",
  environment: AppEnvironment,
  workflows: [BatchWorkflow, JobWorkflow],
  budgets: [
    ScalingAppDailyBudget,
    ScalingTenantDailyBudget,
    ScalingExecutionBudget,
  ],
  maxConcurrentSteps: 4,
  shutdownTimeout: seconds(30),
  providers: [
    SqliteConnection,
    SqliteCheckpointSaver,
    SqliteCostLedgerRepository,
    SqliteChildExecutionQueueRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionTreeRepository,
    SqlitePausedExecutionRepository,
    SqliteRateLimitRepository,
  ],
})
export class KubernetesScalingApplication {}

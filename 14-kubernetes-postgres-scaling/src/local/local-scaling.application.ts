import {
  Application,
  SqliteCheckpointSaver,
  SqliteChildExecutionQueueRepository,
  SqliteConnection,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseEventRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqliteFencedEffectRepository,
  SqliteOutboundCallRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
} from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { ScalingAppDailyBudget } from "../budgets/scaling-app-daily.budget.js";
import { ScalingExecutionBudget } from "../budgets/scaling-execution.budget.js";
import { ScalingTenantDailyBudget } from "../budgets/scaling-tenant-daily.budget.js";
import { BatchWorkflow } from "../workflows/batch/batch.workflow.js";
import { JobWorkflow } from "../workflows/job/job.workflow.js";
import { LocalEnvironment } from "./environments/app.environment.js";
import { SqliteDeliveries } from "./sqlite-deliveries.js";

/**
 * The same workflows on one machine (`npm test`, `npm run demo`, offline, R4): the SQLite stores in
 * one file instead of PostgreSQL. The job step depends only on the contracts
 * (`FencedEffectRepository`, `OutboundCalls`), so it is the cluster's code that runs here.
 */
@Application({
  name: "local-scaling-application",
  version: "1.0.0",
  environment: LocalEnvironment,
  workflows: [BatchWorkflow, JobWorkflow],
  budgets: [ScalingAppDailyBudget, ScalingTenantDailyBudget, ScalingExecutionBudget],
  maxConcurrentSteps: 4,
  shutdownTimeout: seconds(30),
  retention: { executionRecords: hours(24) },
  // one key on every pod: business-key handles and fingerprints agree across instances (Guarantees A8)
  piiKeyField: "piiPseudonymKey",
  idempotencyKeyField: "idempotencyKey", // agbossjs/agboss#825: business-key fingerprints, a Secret of their own
  providers: [
    SqliteConnection,
    SqliteCheckpointSaver,
    SqliteChildExecutionQueueRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionHistoryRepository,
    SqliteExecutionLeaseEventRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionTreeRepository,
    SqliteFencedEffectRepository,
    SqliteOutboundCallRepository,
    SqlitePausedExecutionRepository,
    SqliteRateLimitRepository,
    SqliteDeliveries, // the job's delivery on the fenced-effect store above
  ],
})
export class LocalScalingApplication {}

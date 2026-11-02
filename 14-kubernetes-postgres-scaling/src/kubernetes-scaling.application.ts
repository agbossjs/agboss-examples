import { Application } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import {
  PostgresCheckpointSaver,
  PostgresChildExecutionQueueRepository,
  PostgresCostLedgerRepository,
  PostgresExecutionHistoryRepository,
  PostgresExecutionLeaseEventRepository,
  PostgresExecutionLeaseRepository,
  PostgresExecutionRecordRepository,
  PostgresExecutionTreeRepository,
  PostgresFencedEffectRepository,
  PostgresMeshRequestRepository,
  PostgresOutboundCallRepository,
  PostgresPausedExecutionRepository,
  PostgresRateLimitRepository,
} from "@agboss/postgres";
import { ScalingAppDailyBudget } from "./budgets/scaling-app-daily.budget.js";
import { ScalingExecutionBudget } from "./budgets/scaling-execution.budget.js";
import { ScalingTenantDailyBudget } from "./budgets/scaling-tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { PostgresDeliveries } from "./services/postgres-deliveries.js";
import { BatchWorkflow } from "./workflows/batch/batch.workflow.js";
import { JobWorkflow } from "./workflows/job/job.workflow.js";

/**
 * The worker of the cluster (agbossjs/agboss#487): every store on one PostgreSQL database
 * (`@agboss/postgres`) — no shared disk, so any pod on any node continues any tree. Four step slots
 * per pod (`maxConcurrentSteps`, the target of the scale rule: Wiki → Autoscaling), a 30 s graceful
 * stop (`shutdownTimeout`, below the pod's `terminationGracePeriodSeconds`), and the history the
 * verification reads (`executionRecordRetention`). `LocalScalingApplication` is the same workflows
 * on SQLite, for the offline tests and the demo.
 */
@Application({
  name: "kubernetes-scaling-application",
  version: "1.0.0",
  environment: AppEnvironment,
  workflows: [BatchWorkflow, JobWorkflow],
  budgets: [ScalingAppDailyBudget, ScalingTenantDailyBudget, ScalingExecutionBudget],
  maxConcurrentSteps: 4,
  shutdownTimeout: seconds(30),
  executionRecordRetention: hours(24),
  // one key on every pod: business-key handles and fingerprints agree across instances (Guarantees A8)
  pseudonymKey: "piiPseudonymKey",
  providers: [
    PostgresCheckpointSaver,
    PostgresChildExecutionQueueRepository,
    PostgresCostLedgerRepository,
    PostgresExecutionHistoryRepository,
    PostgresExecutionLeaseEventRepository,
    PostgresExecutionLeaseRepository,
    PostgresExecutionRecordRepository,
    PostgresExecutionTreeRepository,
    PostgresFencedEffectRepository,
    PostgresMeshRequestRepository,
    PostgresOutboundCallRepository,
    PostgresPausedExecutionRepository,
    PostgresRateLimitRepository,
    PostgresDeliveries, // the job's delivery on the fenced-effect store above
  ],
})
export class KubernetesScalingApplication {}

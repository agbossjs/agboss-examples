import { Application } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { ScalingAppDailyBudget } from "./budgets/scaling-app-daily.budget.js";
import { ScalingExecutionBudget } from "./budgets/scaling-execution.budget.js";
import { ScalingTenantDailyBudget } from "./budgets/scaling-tenant-daily.budget.js";
import { KubernetesDatabaseStorage } from "./storages/kubernetes.database-storage.js";
import { BatchWorkflow } from "./workflows/batch/batch.workflow.js";
import { JobWorkflow } from "./workflows/job/job.workflow.js";

/**
 * The worker of the cluster (agbossjs/agboss#487): every store on one PostgreSQL database
 * (`KubernetesDatabaseStorage`, `@agboss/postgres`) — no shared disk, so any pod on any node continues
 * any tree. Four step slots per pod (`executionLimits.maxConcurrentSteps`, the target of the scale
 * rule: Wiki → Autoscaling), a 30 s graceful stop (`shutdownTimeout`, below the pod's
 * `terminationGracePeriodSeconds`), and the history the verification reads (`retention.executionRecords`).
 * `LocalScalingApplication` is the same workflows on SQLite, for the offline tests and the demo.
 */
@Application({
  name: "kubernetes-scaling-application",
  version: "1.0.0",
  storage: KubernetesDatabaseStorage, // every store, the PII key and the idempotency key: one storage
  workflows: [BatchWorkflow, JobWorkflow],
  budgets: [ScalingAppDailyBudget, ScalingTenantDailyBudget, ScalingExecutionBudget],
  executionLimits: { maxConcurrentSteps: 4, shutdownTimeout: seconds(30) },
  retention: { executionRecords: hours(24) },
})
export class KubernetesScalingApplication {}

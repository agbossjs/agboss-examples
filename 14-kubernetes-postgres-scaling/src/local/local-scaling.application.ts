import { Application } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { ScalingAppDailyBudget } from "../budgets/scaling-app-daily.budget.js";
import { ScalingExecutionBudget } from "../budgets/scaling-execution.budget.js";
import { ScalingTenantDailyBudget } from "../budgets/scaling-tenant-daily.budget.js";
import { BatchWorkflow } from "../workflows/batch/batch.workflow.js";
import { JobWorkflow } from "../workflows/job/job.workflow.js";
import { LocalDatabaseStorage } from "./local.database-storage.js";

/**
 * The same workflows on one machine (`npm test`, `npm run demo`, offline, R4): the SQLite stores in
 * one file instead of PostgreSQL. The job step depends only on the core's `Idempotency` service, so
 * it is the cluster's code that runs here.
 */
@Application({
  name: "local-scaling-application",
  version: "1.0.0",
  storage: LocalDatabaseStorage,
  workflows: [BatchWorkflow, JobWorkflow],
  budgets: [ScalingAppDailyBudget, ScalingTenantDailyBudget, ScalingExecutionBudget],
  executionLimits: { maxConcurrentSteps: 4, shutdownTimeout: seconds(30) },
  retention: { executionRecords: hours(24) },
})
export class LocalScalingApplication {}

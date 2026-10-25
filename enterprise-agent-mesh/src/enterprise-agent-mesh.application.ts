import {
  Application,
  SqliteCheckpointSaver,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqliteMeshRequestRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
} from "agboss";
import { hours, seconds } from "agboss/units";
import { TriageAppDailyBudget } from "./budgets/triage-app-daily.budget.js";
import { TriageExecutionBudget } from "./budgets/triage-execution.budget.js";
import { TriageTenantDailyBudget } from "./budgets/triage-tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { TriageWorkflow } from "./workflows/triage.workflow.js";

export { BillingWorkflow } from "../billing-service/billing.application.js";
export { CatalogWorkflow } from "../catalog-mcp/catalog.application.js";
export { TriageWorkflow } from "./workflows/triage.workflow.js";

@Application({
  name: "triage-gateway-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [TriageWorkflow],
  budgets: [TriageAppDailyBudget, TriageTenantDailyBudget, TriageExecutionBudget],
  mesh: {
    signingKey: "meshSigningKey",
    peers: [
      { application: "billing-application", verifyKey: "billingVerifyKey" },
    ],
  },
  providers: [
    SqliteCheckpointSaver,
    SqlitePausedExecutionRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionTreeRepository,
    SqliteRateLimitRepository,
    SqliteExecutionHistoryRepository,
    SqliteMeshRequestRepository,
  ],
  executionRecordRetention: hours(24 * 30),
  pauseRecordRetention: hours(24),
  shutdownTimeout: seconds(15),
})
export class TriageGatewayApplication {}

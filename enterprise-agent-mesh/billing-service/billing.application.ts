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
import { AppEnvironment } from "../src/environments/app.environment.js";
import { BillingA2AExpose } from "./a2a/billing.a2a-expose.js";
import { BillingAppDailyBudget } from "./budgets/billing-app-daily.budget.js";
import { BillingExecutionBudget } from "./budgets/billing-execution.budget.js";
import { BillingTenantDailyBudget } from "./budgets/billing-tenant-daily.budget.js";
import { BillingOfflineModelProvider } from "./model-providers/billing-offline.model-provider.js";
import { BillingA2aCallerResolver } from "./services/billing-a2a-caller-resolver.service.js";
import { BillingApiKeyDirectory } from "./services/billing-api-key-directory.service.js";
import { BillingWorkflow } from "./workflows/billing.workflow.js";

export { BillingInquiryDto } from "../src/dto/billing-inquiry.dto.js";
export { BillingResolutionDto } from "../src/dto/billing-resolution.dto.js";
export { BillingA2AExpose } from "./a2a/billing.a2a-expose.js";
export { ResolveBillingInquiryAction } from "./actions/resolve-billing-inquiry.action.js";
export { BillingAppDailyBudget } from "./budgets/billing-app-daily.budget.js";
export { BillingExecutionBudget } from "./budgets/billing-execution.budget.js";
export { BillingTenantDailyBudget } from "./budgets/billing-tenant-daily.budget.js";
export { BillingOfflineModelProvider } from "./model-providers/billing-offline.model-provider.js";
export { BillingA2aCallerResolver } from "./services/billing-a2a-caller-resolver.service.js";
export {
  BillingApiKeyDirectory,
  type BillingApiKeyGrant,
} from "./services/billing-api-key-directory.service.js";
export { BillingWorkflowFinish } from "./workflow-finishes/billing.workflow-finish.js";
export { BillingWorkflowStart } from "./workflow-starts/billing.workflow-start.js";
export { BillingWorkflow } from "./workflows/billing.workflow.js";

@Application({
  name: "billing-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [BillingWorkflow],
  budgets: [BillingAppDailyBudget, BillingTenantDailyBudget, BillingExecutionBudget],
  exposes: [BillingA2AExpose],
  maxMeshHops: 3,
  mesh: {
    signingKey: "meshSigningKey",
    peers: [
      {
        application: "triage-gateway-application",
        verifyKey: "triageVerifyKey",
      },
    ],
  },
  providers: [
    BillingOfflineModelProvider,
    BillingApiKeyDirectory,
    BillingA2aCallerResolver,
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
export class BillingApplication {}

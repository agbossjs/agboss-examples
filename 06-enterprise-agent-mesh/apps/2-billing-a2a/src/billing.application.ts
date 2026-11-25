import { Application, EmptyEnvironment } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { BillingA2AEndpoint } from "./a2a/billing.a2a-endpoint.js";
import { BillingHttpAuthenticator } from "./a2a/billing.http-authenticator.js";
import { BillingAppDailyBudget } from "./budgets/billing-app-daily.budget.js";
import { BillingExecutionBudget } from "./budgets/billing-execution.budget.js";
import { BillingTenantDailyBudget } from "./budgets/billing-tenant-daily.budget.js";
import { BillingMesh } from "./config/billing.mesh.js";
import { InvoiceReviewerOfflineModelProvider } from "./model-providers/invoice-reviewer-offline.model-provider.js";
import { BillingApiKeyDirectory } from "./services/billing-api-key-directory.service.js";
import { BillingDatabaseStorage } from "./storages/billing.database-storage.js";
import { BillingWorkflow } from "./workflows/billing/billing.workflow.js";
import { InvoiceReviewWorkflow } from "./workflows/invoice-review/invoice-review.workflow.js";

export { BillingA2AEndpoint } from "./a2a/billing.a2a-endpoint.js";
export { BillingHttpAuthenticator } from "./a2a/billing.http-authenticator.js";
export { ResolveBillingInquiryAction } from "./actions/resolve-billing-inquiry.action.js";
export { BillingAppDailyBudget } from "./budgets/billing-app-daily.budget.js";
export { BillingExecutionBudget } from "./budgets/billing-execution.budget.js";
export { BillingTenantDailyBudget } from "./budgets/billing-tenant-daily.budget.js";
export { BillingInquiryDto } from "./dto/billing-inquiry.dto.js";
export { BillingResolutionDto } from "./dto/billing-resolution.dto.js";
export {
  BillingApiKeyDirectory,
  type BillingApiKeyGrant,
} from "./services/billing-api-key-directory.service.js";
export { BillingWorkflowFinish } from "./workflows/billing/billing.workflow-finish.js";
export { BillingWorkflowStart } from "./workflows/billing/billing.workflow-start.js";
export { BillingWorkflow } from "./workflows/billing/billing.workflow.js";
export { InvoiceReviewWorkflowStart } from "./workflows/invoice-review/invoice-review.workflow-start.js";

/**
 * The billing service: two workflows served over A2A v1.0 (`BillingA2AEndpoint`, listed in `endpoints`), callers
 * authenticated by `BillingHttpAuthenticator`, the triage gateway its one mesh peer. Its only model is the
 * offline stand-in of the invoice reviewer (`billing.live.app.ts` puts OpenRouter in its place).
 */
@Application({
  name: "billing-application",
  version: "1.0.0",
  environment: EmptyEnvironment,
  storage: BillingDatabaseStorage,
  modelProvider: InvoiceReviewerOfflineModelProvider,
  workflows: [BillingWorkflow, InvoiceReviewWorkflow],
  budgets: [BillingAppDailyBudget, BillingTenantDailyBudget, BillingExecutionBudget],
  endpoints: [BillingA2AEndpoint],
  mesh: BillingMesh,
  providers: [InvoiceReviewerOfflineModelProvider, BillingApiKeyDirectory, BillingHttpAuthenticator],
  retention: { executionRecords: hours(24 * 30), pauseRecords: hours(24) },
  executionLimits: { shutdownTimeout: seconds(15) },
})
export class BillingApplication {}

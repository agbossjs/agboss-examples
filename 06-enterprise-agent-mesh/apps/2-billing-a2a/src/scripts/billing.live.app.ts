import { Application, EmptyEnvironment } from "@agboss/core";
import { BillingA2AEndpoint } from "../a2a/billing.a2a-endpoint.js";
import { BillingHttpAuthenticator } from "../a2a/billing.http-authenticator.js";
import { BillingAppDailyBudget } from "../budgets/billing-app-daily.budget.js";
import { BillingExecutionBudget } from "../budgets/billing-execution.budget.js";
import { BillingTenantDailyBudget } from "../budgets/billing-tenant-daily.budget.js";
import { OpenRouterModelProvider } from "./openrouter.model-provider.js";
import { BillingApiKeyDirectory } from "../services/billing-api-key-directory.service.js";
import { BillingDatabaseStorage } from "../storages/billing.database-storage.js";
import { BillingWorkflow } from "../workflows/billing/billing.workflow.js";
import { InvoiceReviewWorkflow } from "../workflows/invoice-review/invoice-review.workflow.js";

/**
 * The billing agent on a real model (`npm run demo:stream` with OPENROUTER_API_KEY): the same
 * workflows and A2A endpoint, OpenRouter in place of the offline stand-in, in-memory stores. It lives in
 * `src/scripts/`, which `agboss check` does not load: a second application beside the project's.
 */
@Application({
  name: "billing-live-application",
  version: "1.0.0",
  environment: EmptyEnvironment,
  storage: BillingDatabaseStorage,
  modelProvider: OpenRouterModelProvider,
  workflows: [BillingWorkflow, InvoiceReviewWorkflow],
  budgets: [BillingAppDailyBudget, BillingTenantDailyBudget, BillingExecutionBudget],
  endpoints: [BillingA2AEndpoint],
  providers: [OpenRouterModelProvider, BillingApiKeyDirectory, BillingHttpAuthenticator],
})
export class BillingLiveApplication {}

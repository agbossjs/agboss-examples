import { Application } from "@agboss/core";
import { OpenRouterModelProvider } from "@agboss/core/models";
import { BillingA2AExpose } from "./a2a/billing.a2a-expose.js";
import { BillingAppDailyBudget } from "./budgets/billing-app-daily.budget.js";
import { BillingExecutionBudget } from "./budgets/billing-execution.budget.js";
import { BillingTenantDailyBudget } from "./budgets/billing-tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { BillingA2aCallerResolver } from "./services/billing-a2a-caller-resolver.service.js";
import { BillingApiKeyDirectory } from "./services/billing-api-key-directory.service.js";
import { BillingWorkflow } from "./workflows/billing/billing.workflow.js";
import { InvoiceReviewWorkflow } from "./workflows/invoice-review/invoice-review.workflow.js";

/**
 * The billing agent on a real model (`npm run demo:stream` with OPENROUTER_API_KEY): the same
 * workflows and A2A expose, OpenRouter in place of the offline stand-in, in-memory stores. Named
 * `.app.ts`, not `.application.ts`: `agboss check` takes the files named `.application.ts` for the
 * project's applications.
 */
@Application({
  name: "billing-live-application",
  version: "1.0.0",
  environment: AppEnvironment,
  piiKeyField: "piiPseudonymKey",
  workflows: [BillingWorkflow, InvoiceReviewWorkflow],
  budgets: [BillingAppDailyBudget, BillingTenantDailyBudget, BillingExecutionBudget],
  exposes: [BillingA2AExpose],
  providers: [OpenRouterModelProvider, BillingApiKeyDirectory, BillingA2aCallerResolver],
})
export class BillingLiveApplication {}

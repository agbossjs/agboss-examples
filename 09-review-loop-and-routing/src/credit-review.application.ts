import { Application, SqliteCostLedgerRepository } from "@agboss/core";
import { DecisionsModelProvider } from "@agboss/core/models";
import { CreditReviewApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { CreditReviewExecutionBudget } from "./budgets/execution.budget.js";
import { CreditReviewTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { OpenRouterModelProvider } from "./model-providers/openrouter.model-provider.js";
import { CreditReviewWorkflow } from "./workflows/credit-review/credit-review.workflow.js";

/**
 * The credit desk: one workflow (two starts, one review loop), its model providers — OpenRouter
 * for the agents, the Decisions API for the model router, the same in every environment — and its
 * budgets. `npm test` scripts every model (`testWith`); `npm run demo` scripts the wire
 * (`createApp({ providerFetch })`); `npm run demo:live` calls OpenRouter.
 */
@Application({
  name: "credit-review-application",
  version: "1.0.0",
  environment: AppEnvironment,
  workflows: [CreditReviewWorkflow],
  // the ledger the tenant and application budgets count in: SQLite on sqlitePath (":memory:" here)
  providers: [OpenRouterModelProvider, DecisionsModelProvider, SqliteCostLedgerRepository],
  budgets: [
    CreditReviewApplicationDailyBudget,
    CreditReviewTenantDailyBudget,
    CreditReviewExecutionBudget,
  ],
})
export class CreditReviewApplication {}

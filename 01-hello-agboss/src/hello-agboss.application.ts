import { Application, SqliteCostLedgerRepository } from "agboss";
import { HelloApplicationDailyBudget } from "./budgets/hello-application-daily.budget.js";
import { HelloExecutionBudget } from "./budgets/hello-execution.budget.js";
import { HelloTenantDailyBudget } from "./budgets/hello-tenant-daily.budget.js";
import { HelloExecutionContext } from "./contexts/hello-execution.context.js";
import { HelloTenantContext } from "./contexts/hello-tenant.context.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { OpenRouterChatModelProvider } from "./model-providers/openrouter-chat.model-provider.js";
import { HelloAgbossWorkflow } from "./workflows/hello-agboss/hello-agboss.workflow.js";

@Application({
  name: "hello-agboss-application",
  version: "0.1.0",
  environment: AppEnvironment,
  tenantContext: HelloTenantContext,
  executionContext: HelloExecutionContext,
  pseudonymKey: "openRouterApiKey",
  workflows: [HelloAgbossWorkflow],
  providers: [OpenRouterChatModelProvider, SqliteCostLedgerRepository],
  budgets: [HelloApplicationDailyBudget, HelloTenantDailyBudget, HelloExecutionBudget],
})
export class HelloAgbossApplication {}

import { Application, SqliteCostLedgerRepository } from "agboss";
import { HelloApplicationDailyBudget } from "./budgets/hello-application-daily.budget.js";
import { HelloExecutionBudget } from "./budgets/hello-execution.budget.js";
import { HelloTenantDailyBudget } from "./budgets/hello-tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { OfflineDemoModelProvider } from "./model-providers/offline-demo.model-provider.js";
import { HelloAgbossWorkflow } from "./workflows/hello-agboss.workflow.js";

@Application({
  name: "hello-agboss-application",
  version: "0.1.0",
  environment: AppEnvironment,
  pseudonymKey: "openRouterApiKey",
  workflows: [HelloAgbossWorkflow],
  providers: [OfflineDemoModelProvider, SqliteCostLedgerRepository],
  budgets: [HelloApplicationDailyBudget, HelloTenantDailyBudget, HelloExecutionBudget],
})
export class HelloAgbossApplication {}

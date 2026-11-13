import { Application, SqliteCostLedgerRepository } from "@agboss/core";
import { CodexCliModelProvider } from "./cli-providers/codex-cli.provider.js";
import { HelloApplicationDailyBudget } from "./budgets/hello-application-daily.budget.js";
import { HelloExecutionBudget } from "./budgets/hello-execution.budget.js";
import { HelloTenantDailyBudget } from "./budgets/hello-tenant-daily.budget.js";
import { HelloExecutionContext } from "./contexts/hello-execution.context.js";
import { HelloTenantContext } from "./contexts/hello-tenant.context.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { HelloAgbossWorkflow } from "./workflows/hello-agboss/hello-agboss.workflow.js";

/**
 * The hello-agboss workflow on your own Codex CLI (`npm run demo:codex-cli`). Demo / local only.
 * Named `.app.ts`, not `.application.ts`: `agboss check` takes the files named `.application.ts` for
 * the project's applications, and a workflow two applications list loses its typed contexts.
 */
@Application({
  name: "hello-agboss-codex-cli-application",
  version: "0.1.0",
  environment: AppEnvironment,
  tenantContext: HelloTenantContext,
  executionContext: HelloExecutionContext,
  piiKeyField: "piiPseudonymKey",
  workflows: [HelloAgbossWorkflow],
  providers: [CodexCliModelProvider, SqliteCostLedgerRepository],
  budgets: [HelloApplicationDailyBudget, HelloTenantDailyBudget, HelloExecutionBudget],
})
export class HelloAgbossCodexCliApplication {}

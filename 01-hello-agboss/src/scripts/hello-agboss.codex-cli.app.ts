import { Application } from "@agboss/core";
import { CodexCliModelProvider } from "../cli-providers/codex-cli.provider.js";
import { HelloApplicationDailyBudget } from "../budgets/hello-application-daily.budget.js";
import { HelloExecutionBudget } from "../budgets/hello-execution.budget.js";
import { HelloTenantDailyBudget } from "../budgets/hello-tenant-daily.budget.js";
import { HelloExecutionContext } from "../contexts/hello-execution.context.js";
import { HelloTenantContext } from "../contexts/hello-tenant.context.js";
import { HelloDatabaseStorage } from "../storages/hello.database-storage.js";
import { HelloAgbossWorkflow } from "../workflows/hello-agboss/hello-agboss.workflow.js";

/**
 * The hello-agboss workflow on your own Codex CLI (`npm run demo:codex-cli`). Demo / local only.
 * Named `.app.ts`, not `.application.ts`: `agboss check` takes the files named `.application.ts` for
 * the project's applications, and a workflow two applications list loses its typed contexts.
 */
@Application({
  name: "hello-agboss-codex-cli-application",
  version: "0.1.1",
  tenantContext: HelloTenantContext,
  executionContext: HelloExecutionContext,
  workflows: [HelloAgbossWorkflow],
  storage: HelloDatabaseStorage,
  modelProvider: CodexCliModelProvider,
  providers: [CodexCliModelProvider],
  budgets: [HelloApplicationDailyBudget, HelloTenantDailyBudget, HelloExecutionBudget],
})
export class HelloAgbossCodexCliApplication {}

import { Application, SqliteCostLedgerRepository } from "@agboss/core";
import { geminiCliModelProvider } from "./cli-providers/gemini-cli.provider.js";
import { HelloApplicationDailyBudget } from "./budgets/hello-application-daily.budget.js";
import { HelloExecutionBudget } from "./budgets/hello-execution.budget.js";
import { HelloTenantDailyBudget } from "./budgets/hello-tenant-daily.budget.js";
import { HelloExecutionContext } from "./contexts/hello-execution.context.js";
import { HelloTenantContext } from "./contexts/hello-tenant.context.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { HelloAgbossWorkflow } from "./workflows/hello-agboss/hello-agboss.workflow.js";

// Google's Gemini CLI terms prohibit this for third-party tools: read the startup warning, then decide
const GeminiCliModelProvider = geminiCliModelProvider({ acknowledgeVendorTermsRisk: true });

/**
 * The hello-agboss workflow on your own Gemini CLI (`npm run demo:gemini-cli`). Demo / local only.
 * Named `.app.ts`, not `.application.ts`: `agboss check` takes the files named `.application.ts` for
 * the project's applications, and a workflow two applications list loses its typed contexts.
 */
@Application({
  name: "hello-agboss-gemini-cli-application",
  version: "0.1.0",
  environment: AppEnvironment,
  tenantContext: HelloTenantContext,
  executionContext: HelloExecutionContext,
  piiKeyField: "piiPseudonymKey",
  workflows: [HelloAgbossWorkflow],
  providers: [GeminiCliModelProvider, SqliteCostLedgerRepository],
  budgets: [HelloApplicationDailyBudget, HelloTenantDailyBudget, HelloExecutionBudget],
})
export class HelloAgbossGeminiCliApplication {}

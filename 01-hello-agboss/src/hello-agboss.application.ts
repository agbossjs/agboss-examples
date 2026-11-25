import { Application } from "@agboss/core";
import { HelloApplicationDailyBudget } from "./budgets/hello-application-daily.budget.js";
import { HelloExecutionBudget } from "./budgets/hello-execution.budget.js";
import { HelloTenantDailyBudget } from "./budgets/hello-tenant-daily.budget.js";
import { HelloExecutionContext } from "./contexts/hello-execution.context.js";
import { HelloTenantContext } from "./contexts/hello-tenant.context.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { OpenRouterChatModelProvider } from "./model-providers/openrouter-chat.model-provider.js";
import { HelloDatabaseStorage } from "./storages/hello.database-storage.js";
import { StreamingAnswerWorkflow } from "./workflows/streaming-answer/streaming-answer.workflow.js";
import { HelloAgbossWorkflow } from "./workflows/hello-agboss/hello-agboss.workflow.js";

@Application({
  name: "hello-agboss-application",
  version: "0.1.1",
  environment: AppEnvironment,
  tenantContext: HelloTenantContext,
  executionContext: HelloExecutionContext,
  workflows: [HelloAgbossWorkflow, StreamingAnswerWorkflow],
  storage: HelloDatabaseStorage, // its own PII key (#825): never the provider's apiKey
  modelProvider: OpenRouterChatModelProvider, // every model of the application: explicit, no default
  providers: [OpenRouterChatModelProvider],
  budgets: [HelloApplicationDailyBudget, HelloTenantDailyBudget, HelloExecutionBudget],
})
export class HelloAgbossApplication {}

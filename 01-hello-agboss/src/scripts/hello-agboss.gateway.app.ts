import { Application } from "@agboss/core";
import { HelloApplicationDailyBudget } from "../budgets/hello-application-daily.budget.js";
import { HelloExecutionBudget } from "../budgets/hello-execution.budget.js";
import { HelloTenantDailyBudget } from "../budgets/hello-tenant-daily.budget.js";
import { HelloExecutionContext } from "../contexts/hello-execution.context.js";
import { HelloTenantContext } from "../contexts/hello-tenant.context.js";
import { HelloDatabaseStorage } from "../storages/hello.database-storage.js";
import { GatewayStreamModelProvider } from "../model-providers/gateway-stream.model-provider.js";
import { StreamingAnswerWorkflow } from "../workflows/streaming-answer/streaming-answer.workflow.js";

/**
 * The streaming answer through the company LLM gateway, a transport provider that streams
 * (`GatewayStreamModelProvider`). Named `.app.ts`, not `.application.ts`: `agboss check` takes the
 * files named `.application.ts` for the project's applications.
 */
@Application({
  name: "hello-agboss-gateway-application",
  version: "0.1.1",
  tenantContext: HelloTenantContext,
  executionContext: HelloExecutionContext,
  workflows: [StreamingAnswerWorkflow],
  storage: HelloDatabaseStorage,
  modelProvider: GatewayStreamModelProvider,
  providers: [GatewayStreamModelProvider],
  budgets: [HelloApplicationDailyBudget, HelloTenantDailyBudget, HelloExecutionBudget],
})
export class HelloAgbossGatewayApplication {}

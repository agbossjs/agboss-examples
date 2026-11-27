import { Application } from "@agboss/core";
import { OpenRouterModelProvider } from "./model-providers/openrouter.model-provider.js";
import { HandbookDatabaseStorage } from "./storages/handbook.database-storage.js";
import { HandbookApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { HandbookExecutionBudget } from "./budgets/execution.budget.js";
import { HandbookTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { HandbookWorkflow } from "./workflows/handbook/handbook.workflow.js";

/**
 * The handbook desk: one workflow, one reranked knowledge base, its budgets in a SQLite ledger. OpenRouter
 * serves the agents (and the LLM reranker when it is swapped in): the explicit `modelProvider`.
 * `npm test` scripts the models and points the Cohere SDK at a local stub of its rerank API.
 */
@Application({
  name: "handbook-application",
  version: "1.0.0",
  storage: HandbookDatabaseStorage,
  modelProvider: OpenRouterModelProvider,
  // the storage's PII key: one token per value on every instance and in every process
  workflows: [HandbookWorkflow],
  providers: [OpenRouterModelProvider],
  budgets: [HandbookApplicationDailyBudget, HandbookTenantDailyBudget, HandbookExecutionBudget],
})
export class HandbookApplication {}

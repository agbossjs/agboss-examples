import { Application, SqliteCostLedgerRepository } from "@agboss/core";
import { HandbookApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { HandbookExecutionBudget } from "./budgets/execution.budget.js";
import { HandbookTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { HandbookWorkflow } from "./workflows/handbook/handbook.workflow.js";

/**
 * The handbook desk: one workflow, one reranked knowledge base, its budgets in a SQLite ledger. No
 * model provider is listed: the built-in OpenRouter serves the agents (and the LLM reranker when it
 * is swapped in).
 * `npm test` scripts the models and points the Cohere SDK at a local stub of its rerank API.
 */
@Application({
  name: "handbook-application",
  version: "1.0.0",
  environment: AppEnvironment,
  // one PII key for every instance and process: the same token for one value everywhere
  piiKeyField: "piiPseudonymKey",
  workflows: [HandbookWorkflow],
  defaults: { router: { model: "typesafe/jev-1.13" } },
  // the ledger the tenant and application budgets count in: SQLite on sqlitePath (":memory:" offline)
  providers: [SqliteCostLedgerRepository],
  budgets: [HandbookApplicationDailyBudget, HandbookTenantDailyBudget, HandbookExecutionBudget],
})
export class HandbookApplication {}

import {
  Application,
  SqliteCheckpointSaver,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqliteMeshRequestRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
} from "agboss";
import { hours, seconds } from "agboss/units";
import { CatalogAppDailyBudget } from "./budgets/catalog-app-daily.budget.js";
import { CatalogExecutionBudget } from "./budgets/catalog-execution.budget.js";
import { CatalogTenantDailyBudget } from "./budgets/catalog-tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { CatalogMcp } from "./mcp/catalog.mcp-expose.js";
import { CatalogInventoryService } from "./services/catalog-inventory.service.js";
import { CatalogWorkflow } from "./workflows/catalog/catalog.workflow.js";

export { LookupSkuAgent } from "./agents/lookup-sku/lookup-sku.agent.js";
export { CatalogAppDailyBudget } from "./budgets/catalog-app-daily.budget.js";
export { CatalogExecutionBudget } from "./budgets/catalog-execution.budget.js";
export { CatalogTenantDailyBudget } from "./budgets/catalog-tenant-daily.budget.js";
export { SkuDetailsDto } from "./dto/sku-details.dto.js";
export { SkuLookupInputDto } from "./dto/sku-lookup-input.dto.js";
export { CatalogMcp } from "./mcp/catalog.mcp-expose.js";
export { CatalogOfflineModelProvider } from "./model-providers/catalog-offline.model-provider.js";
export {
  CatalogInventoryService,
  getCatalogExecutionCount,
  resetCatalogExecutionCount,
} from "./services/catalog-inventory.service.js";
export { LookupSkuTool } from "./tools/lookup-sku.tool.js";
export { CatalogWorkflowFinish } from "./workflows/catalog/catalog.workflow-finish.js";
export { CatalogWorkflowStart } from "./workflows/catalog/catalog.workflow-start.js";
export { CatalogWorkflow } from "./workflows/catalog/catalog.workflow.js";

@Application({
  name: "catalog-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [CatalogWorkflow],
  budgets: [CatalogAppDailyBudget, CatalogTenantDailyBudget, CatalogExecutionBudget],
  exposes: [CatalogMcp],
  maxMeshHops: 3,
  mesh: {
    signingKey: "meshSigningKey",
    peers: [
      {
        application: "triage-gateway-application",
        verifyKey: "triageVerifyKey",
      },
    ],
  },
  providers: [
    CatalogInventoryService,
    SqliteCheckpointSaver,
    SqlitePausedExecutionRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionTreeRepository,
    SqliteRateLimitRepository,
    SqliteExecutionHistoryRepository,
    SqliteMeshRequestRepository,
  ],
  executionRecordRetention: hours(24 * 30),
  pauseRecordRetention: hours(24),
  shutdownTimeout: seconds(15),
})
export class CatalogApplication {}

import { Application, EmptyEnvironment } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { CatalogAppDailyBudget } from "./budgets/catalog-app-daily.budget.js";
import { CatalogExecutionBudget } from "./budgets/catalog-execution.budget.js";
import { CatalogTenantDailyBudget } from "./budgets/catalog-tenant-daily.budget.js";
import { CatalogMesh } from "./config/catalog.mesh.js";
import { CatalogHttpAuthenticator } from "./mcp/catalog.http-authenticator.js";
import { CatalogMcp } from "./mcp/catalog.mcp-endpoint.js";
import { CatalogOfflineModelProvider } from "./model-providers/catalog-offline.model-provider.js";
import { CatalogApiKeyDirectory } from "./services/catalog-api-key-directory.service.js";
import { CatalogInventoryService } from "./services/catalog-inventory.service.js";
import { CatalogDatabaseStorage } from "./storages/catalog.database-storage.js";
import { CatalogWorkflow } from "./workflows/catalog/catalog.workflow.js";

export { LookupSkuAgent } from "./agents/lookup-sku/lookup-sku.agent.js";
export { CatalogAppDailyBudget } from "./budgets/catalog-app-daily.budget.js";
export { CatalogExecutionBudget } from "./budgets/catalog-execution.budget.js";
export { CatalogTenantDailyBudget } from "./budgets/catalog-tenant-daily.budget.js";
export { SkuDetailsDto } from "./dto/sku-details.dto.js";
export { SkuLookupInputDto } from "./dto/sku-lookup-input.dto.js";
export { CatalogHttpAuthenticator } from "./mcp/catalog.http-authenticator.js";
export { CatalogMcp } from "./mcp/catalog.mcp-endpoint.js";
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

/**
 * The catalog service: one workflow whose SKU lookup tool is offered over MCP (`CatalogMcp`, listed in
 * `endpoints`); the triage gateway is its one mesh peer.
 */
@Application({
  name: "catalog-application",
  version: "1.0.0",
  environment: EmptyEnvironment,
  storage: CatalogDatabaseStorage,
  modelProvider: CatalogOfflineModelProvider,
  workflows: [CatalogWorkflow],
  budgets: [CatalogAppDailyBudget, CatalogTenantDailyBudget, CatalogExecutionBudget],
  endpoints: [CatalogMcp],
  mesh: CatalogMesh,
  providers: [
    CatalogOfflineModelProvider,
    CatalogInventoryService,
    CatalogApiKeyDirectory,
    CatalogHttpAuthenticator,
  ],
  retention: { executionRecords: hours(24 * 30), pauseRecords: hours(24) },
  executionLimits: { shutdownTimeout: seconds(15) },
})
export class CatalogApplication {}

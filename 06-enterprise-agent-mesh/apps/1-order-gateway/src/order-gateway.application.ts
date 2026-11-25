import { Application, EmptyEnvironment } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { TriageAppDailyBudget } from "./budgets/triage-app-daily.budget.js";
import { TriageExecutionBudget } from "./budgets/triage-execution.budget.js";
import { TriageTenantDailyBudget } from "./budgets/triage-tenant-daily.budget.js";
import { TriageMesh } from "./config/triage.mesh.js";
import { TriageOfflineModelProvider } from "./model-providers/triage-offline.model-provider.js";
import { TriageDatabaseStorage } from "./storages/triage.database-storage.js";
import { TriageWorkflow } from "./workflows/triage/triage.workflow.js";

export {
  BillingA2AAgent,
  configureTriageMeshTarget,
} from "./a2a/billing.a2a-agent.js";
export { TriageAgent } from "./agents/triage/triage.agent.js";
export { TriageAppDailyBudget } from "./budgets/triage-app-daily.budget.js";
export { TriageExecutionBudget } from "./budgets/triage-execution.budget.js";
export { TriageTenantDailyBudget } from "./budgets/triage-tenant-daily.budget.js";
export { TriageRequestDto } from "./dto/triage-request.dto.js";
export { TriageResponseDto } from "./dto/triage-response.dto.js";
export { CatalogMcpServer } from "./mcp/catalog.mcp-server.js";
export { SearchCatalogTool } from "./tools/search-catalog.tool.js";
export { TriageOfflineModelProvider } from "./model-providers/triage-offline.model-provider.js";
export { AskBillingTool } from "./tools/ask-billing.tool.js";
export { BillingWorkflow } from "../../2-billing-a2a/src/billing.application.js";
export { CatalogWorkflow } from "../../3-catalog-mcp/src/catalog.application.js";
export { MeshLoopFallbackWorkflowFinish } from "./workflows/triage/mesh-loop-fallback.workflow-finish.js";
export { TriageWorkflowFinish } from "./workflows/triage/triage.workflow-finish.js";
export { TriageWorkflowStart } from "./workflows/triage/triage.workflow-start.js";
export { TriageWorkflow } from "./workflows/triage/triage.workflow.js";

/**
 * The triage gateway: one workflow whose agent calls the catalog over MCP and billing over A2A v1.0. It signs
 * its mesh envelopes and trusts billing's signed run reports; it serves no endpoint itself.
 */
@Application({
  name: "triage-gateway-application",
  version: "1.0.0",
  environment: EmptyEnvironment,
  storage: TriageDatabaseStorage,
  modelProvider: TriageOfflineModelProvider,
  workflows: [TriageWorkflow],
  budgets: [TriageAppDailyBudget, TriageTenantDailyBudget, TriageExecutionBudget],
  mesh: TriageMesh,
  providers: [TriageOfflineModelProvider],
  retention: { executionRecords: hours(24 * 30), pauseRecords: hours(24) },
  executionLimits: { shutdownTimeout: seconds(15) },
})
export class TriageGatewayApplication {}

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
import { TriageAppDailyBudget } from "./budgets/triage-app-daily.budget.js";
import { TriageExecutionBudget } from "./budgets/triage-execution.budget.js";
import { TriageTenantDailyBudget } from "./budgets/triage-tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
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
export { SearchCatalogTool } from "./mcp/search-catalog.mcp-tool.js";
export { TriageOfflineModelProvider } from "./model-providers/triage-offline.model-provider.js";
export { AskBillingTool } from "./tools/ask-billing.tool.js";
export { BillingWorkflow } from "../../2-billing-a2a/src/billing.application.js";
export { CatalogWorkflow } from "../../3-catalog-mcp/src/catalog.application.js";
export { MeshLoopFallbackWorkflowFinish } from "./workflows/triage/mesh-loop-fallback.workflow-finish.js";
export { TriageWorkflowFinish } from "./workflows/triage/triage.workflow-finish.js";
export { TriageWorkflowStart } from "./workflows/triage/triage.workflow-start.js";
export { TriageWorkflow } from "./workflows/triage/triage.workflow.js";

@Application({
  name: "triage-gateway-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [TriageWorkflow],
  budgets: [TriageAppDailyBudget, TriageTenantDailyBudget, TriageExecutionBudget],
  mesh: {
    signingKey: "meshSigningKey",
    peers: [
      { application: "billing-application", verifyKey: "billingVerifyKey" },
    ],
  },
  providers: [
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
export class TriageGatewayApplication {}

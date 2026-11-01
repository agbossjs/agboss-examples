import {
  Application,
  SqliteCheckpointSaver,
  SqliteCostLedgerRepository,
  SqlitePausedExecutionRepository,
} from "@agboss/core";
import { DecisionsModelProvider } from "@agboss/core/models";
import { PurchaseApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { PurchaseExecutionBudget } from "./budgets/execution.budget.js";
import { PurchaseTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { ConsoleApproverChannel } from "./channels/console-approver.channel.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { OpenRouterModelProvider } from "./model-providers/openrouter.model-provider.js";
import { ApproverInbox } from "./services/approver-inbox.service.js";
import { SupplierPurchaseWorkflow } from "./workflows/supplier-purchase/supplier-purchase.workflow.js";

/**
 * Purchasing: one workflow (four parallel reviews in two quorum groups, an approval in free text),
 * its model providers — OpenRouter for the agents and the reply interpreter, the Decisions API for
 * the model arbiter, the same in every environment — the approvers' channel (transport is
 * infrastructure: listed here, never in a workflow), and SQLite for the ledger and the pauses.
 */
@Application({
  name: "supplier-purchase-application",
  version: "1.0.0",
  environment: AppEnvironment,
  workflows: [SupplierPurchaseWorkflow],
  providers: [
    OpenRouterModelProvider,
    DecisionsModelProvider,
    ConsoleApproverChannel,
    ApproverInbox,
    SqliteCostLedgerRepository,
    SqlitePausedExecutionRepository,
    SqliteCheckpointSaver, // a paused execution resumes from its checkpoint
  ],
  budgets: [PurchaseApplicationDailyBudget, PurchaseTenantDailyBudget, PurchaseExecutionBudget],
})
export class SupplierPurchaseApplication {}

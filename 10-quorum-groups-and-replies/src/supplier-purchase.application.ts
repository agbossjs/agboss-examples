import { Application } from "@agboss/core";
import { SupplierPurchaseDatabaseStorage } from "./storages/supplier-purchase.database-storage.js";
import { PurchaseApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { PurchaseExecutionBudget } from "./budgets/execution.budget.js";
import { PurchaseTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { ConsoleApproverChannel } from "./channels/console-approver.channel.js";
import { InboxBudgetOwnerChannel } from "./channels/inbox-budget-owner.channel.js";
import { DecisionsModelProvider, OpenRouterModelProvider } from "./model-providers/openrouter.model-provider.js";
import { ApproverInbox } from "./services/approver-inbox.service.js";
import { BudgetOwnerInbox } from "./services/budget-owner-inbox.service.js";
import { BudgetRaiseWorkflow } from "./workflows/budget-raise/budget-raise.workflow.js";
import { SupplierPurchaseWorkflow } from "./workflows/supplier-purchase/supplier-purchase.workflow.js";

/**
 * Purchasing: two workflows — four parallel reviews in two quorum groups with an approval in free
 * text, and a budget raise that asks its owner a typed question (a question role, #659) —
 * its model providers — OpenRouter for the agents and the reply interpreter, the Decisions API for
 * the model arbiter, the same in every environment — the approvers' and the budget owners' channels
 * (transport is infrastructure: listed here, never in a workflow), and SQLite for the ledger and the
 * pauses.
 */
@Application({
  name: "supplier-purchase-application",
  version: "1.0.0",
  storage: SupplierPurchaseDatabaseStorage,
  modelProvider: OpenRouterModelProvider,
  workflows: [SupplierPurchaseWorkflow, BudgetRaiseWorkflow],
  providers: [OpenRouterModelProvider, DecisionsModelProvider, ApproverInbox, BudgetOwnerInbox],
  channels: [ConsoleApproverChannel, InboxBudgetOwnerChannel],
  budgets: [PurchaseApplicationDailyBudget, PurchaseTenantDailyBudget, PurchaseExecutionBudget],
})
export class SupplierPurchaseApplication {}

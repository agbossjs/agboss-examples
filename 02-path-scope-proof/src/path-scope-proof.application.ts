import { Application, SqliteCostLedgerRepository } from "agboss";
import { SuiteAppBudget } from "./budgets/suite-app.budget.js";
import { SuiteExecBudget } from "./budgets/suite-exec.budget.js";
import { SuiteTenantBudget } from "./budgets/suite-tenant.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { OfflineNoopModelProvider } from "./model-providers/offline-noop.model-provider.js";
import { MissingInputFixedWorkflow } from "./workflows/missing-input-fixed/missing-input-fixed.workflow.js";
import { OutdatedDataFixedWorkflow } from "./workflows/outdated-data-fixed/outdated-data-fixed.workflow.js";
import { ParallelInvalidationFixedWorkflow } from "./workflows/parallel-invalidation-fixed/parallel-invalidation-fixed.workflow.js";
import { UncompensatedFixedWorkflow } from "./workflows/uncompensated-fixed/uncompensated-fixed.workflow.js";

@Application({
  name: "path-scope-proof-application",
  version: "0.1.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [
    MissingInputFixedWorkflow,
    OutdatedDataFixedWorkflow,
    ParallelInvalidationFixedWorkflow,
    UncompensatedFixedWorkflow,
  ],
  providers: [OfflineNoopModelProvider, SqliteCostLedgerRepository],
  budgets: [SuiteAppBudget, SuiteTenantBudget, SuiteExecBudget],
})
export class PathScopeProofApplication {}

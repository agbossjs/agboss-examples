import { Application, EmptyEnvironment } from "@agboss/core";
import { SuiteAppBudget } from "./budgets/suite-app.budget.js";
import { SuiteExecBudget } from "./budgets/suite-exec.budget.js";
import { SuiteTenantBudget } from "./budgets/suite-tenant.budget.js";
import { PathScopeProofDatabaseStorage } from "./storages/path-scope-proof.database-storage.js";
import { MissingInputFixedWorkflow } from "./workflows/missing-input-fixed/missing-input-fixed.workflow.js";
import { OutdatedDataFixedWorkflow } from "./workflows/outdated-data-fixed/outdated-data-fixed.workflow.js";
import { ParallelInvalidationFixedWorkflow } from "./workflows/parallel-invalidation-fixed/parallel-invalidation-fixed.workflow.js";
import { UncompensatedFixedWorkflow } from "./workflows/uncompensated-fixed/uncompensated-fixed.workflow.js";

/** Pure actions: no model, so no model provider; its rows go to `PathScopeProofDatabaseStorage` (SQLite in memory). */
@Application({
  name: "path-scope-proof-application",
  version: "0.1.1",
  environment: EmptyEnvironment,
  workflows: [
    MissingInputFixedWorkflow,
    OutdatedDataFixedWorkflow,
    ParallelInvalidationFixedWorkflow,
    UncompensatedFixedWorkflow,
  ],
  storage: PathScopeProofDatabaseStorage,
  budgets: [SuiteAppBudget, SuiteTenantBudget, SuiteExecBudget],
})
export class PathScopeProofApplication {}

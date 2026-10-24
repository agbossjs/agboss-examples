import { OfflineNoopModelProvider } from "./noop-provider.js";
import {
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  type BudgetHandler,
  EmptyEnvironment,
} from "agboss";
import { usd, type Usd } from "agboss/units";
import { MissingInputFixedWorkflow } from "../cases/01-missing-input/agboss-fixed/application.js";
import { OutdatedDataFixedWorkflow } from "../cases/02-outdated-data/agboss-fixed/application.js";
import { ParallelInvalidationFixedWorkflow } from "../cases/03-parallel-invalidation/agboss-fixed/application.js";
import { UncompensatedFixedWorkflow } from "../cases/04-uncompensated-action/agboss-fixed/application.js";

export {
  MissingInputFixedWorkflow,
  OutdatedDataFixedWorkflow,
  ParallelInvalidationFixedWorkflow,
  UncompensatedFixedWorkflow,
};

@Budget({
  name: "suite-app-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class SuiteAppBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}

@Budget({
  name: "suite-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class SuiteTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "suite-exec-budget",
  scope: BudgetScope.Execution,
})
export class SuiteExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Application({
  name: "path-scope-proof-suite-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [
    MissingInputFixedWorkflow,
    OutdatedDataFixedWorkflow,
    ParallelInvalidationFixedWorkflow,
    UncompensatedFixedWorkflow,
  ],
  providers: [OfflineNoopModelProvider],
  budgets: [SuiteAppBudget, SuiteTenantBudget, SuiteExecBudget],
})
export class PathScopeProofSuiteApplication {}

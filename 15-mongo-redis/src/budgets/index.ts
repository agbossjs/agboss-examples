import { RecountAppDailyBudget } from "./recount-app-daily.budget.js";
import { RecountExecutionBudget } from "./recount-execution.budget.js";
import { RecountTenantDailyBudget } from "./recount-tenant-daily.budget.js";

/** The application's budgets — the same on MongoDB + Redis and on the local SQLite twin. */
export const RECOUNT_BUDGETS = [RecountAppDailyBudget, RecountTenantDailyBudget, RecountExecutionBudget];

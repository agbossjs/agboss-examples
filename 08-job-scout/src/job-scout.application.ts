import { Application } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { ApplicationDailyBudget, ExecutionBudget, TenantDailyBudget } from "./config/budgets.js";
import { DEFAULTS } from "./config/settings.js";
import { JobScout } from "./job-scout.workflow.js";
import { JobScoutDatabaseStorage } from "./storages/job-scout.database-storage.js";
import { DecisionsModelProvider, OpenRouterModelProvider } from "./model-providers/openrouter.model-provider.js";

/**
 * job-scout as an application (#261): what `createApp`, `testWith` and the CLI run. Its
 * infrastructure is `JobScoutDatabaseStorage` (#1321), SQLite on `AGBOSS_SQLITE_PATH` — records,
 * spend, pauses, checkpoints, leases, tree keys and rate-limit slots in one file, so `--thread`,
 * `eval`, `replay` and `golden` see earlier processes, and another instance on the file recovers
 * a run whose process died; tests run on `:memory:`. Its model providers (#266) are listed here too:
 * its own OpenRouter for chat (the application's `modelProvider`), the Decisions API for Jev (named
 * by `defaults`' router and guardrail models). Its process variables are `jobScoutEnv`
 * (`job-scout.env.ts`), its values the profiles in `config/`; its `defaults` are every workflow's, under each
 * workflow's own.
 */
@Application({
  name: "job-scout-application",
  version: "1.0.0",
  storage: JobScoutDatabaseStorage,
  modelProvider: OpenRouterModelProvider,
  defaults: DEFAULTS,
  workflows: [JobScout],
  providers: [OpenRouterModelProvider, DecisionsModelProvider],
  budgets: [ApplicationDailyBudget, TenantDailyBudget, ExecutionBudget],
  retention: { executionRecords: hours(24 * 30) }, // each execution's history, 30 days: agboss records export
})
export class JobScoutApplication {}

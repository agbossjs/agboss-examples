import { Application, SqliteConnection, SqliteCostLedgerRepository } from "@agboss/core";
import { browserFactoryClass } from "./browser/browser-choice.js";
import { StealthBrowser } from "./browser/stealth-browser.service.js";
import { BrowserApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { BrowserExecutionBudget } from "./budgets/execution.budget.js";
import { BrowserTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { McpStealthWorkflow } from "./workflows/mcp-stealth/mcp-stealth.workflow.js";
import { StealthWorkflow } from "./workflows/stealth/stealth.workflow.js";

/**
 * A real-Chrome stealth browser plugged into an agent two ways on one application: a `@Tool` with the
 * shared browser injected (`stealth-workflow`) and a tiny own MCP server behind `@McpServer`
 * (`mcp-stealth-workflow`). The browser comes from the `BrowserFactory` role — real Chrome, or the
 * fake of the tests and the offline demo — and is closed by `StealthBrowser.onDestroy` when the
 * application stops.
 */
@Application({
  name: "browser-bot-bypass-application",
  version: "1.0.0",
  environment: AppEnvironment,
  // one PII key for every instance and process: the same token for one value everywhere
  piiKeyField: "piiPseudonymKey",
  workflows: [StealthWorkflow, McpStealthWorkflow],
  defaults: { router: { model: "typesafe/jev-1.13" } },
  providers: [browserFactoryClass(), StealthBrowser, SqliteConnection, SqliteCostLedgerRepository],
  budgets: [BrowserApplicationDailyBudget, BrowserTenantDailyBudget, BrowserExecutionBudget],
})
export class BrowserBotBypassApplication {}

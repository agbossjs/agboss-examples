import {
  Application,
  PiiFileAction,
  PiiKind,
  PiiPolicy,
} from "@agboss/core";
import { SharedBrowser } from "./browser/shared-browser.service.js";
import { BrowserApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { BrowserExecutionBudget } from "./budgets/execution.budget.js";
import { BrowserTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { OpenRouterModelProvider } from "./model-providers/openrouter.model-provider.js";
import { ContactDesk } from "./services/contact-desk.service.js";
import { BrowserPlaywrightDatabaseStorage } from "./storages/browser-playwright.database-storage.js";
import { McpWebWorkflow } from "./workflows/mcp-web/mcp-web.workflow.js";
import { WebWorkflow } from "./workflows/web/web.workflow.js";

/**
 * A card number on a page never reaches a model as text: what a tool returns passes this policy
 * (Wiki → Guardrails and PII). A screenshot is a file, and a file reaches the model as it is only
 * because the policy says so: `files: PiiFileAction.AllowOriginal` is the decision, in one visible
 * place — without it the application does not start (`[pii.original-file]`) until the agent asks for
 * a masked transcription instead (`FileView.Transcription`).
 */
@PiiPolicy({
  name: "card-pii-policy",
  description: "Hides card numbers in the text a model reads; lets a screenshot through as it is",
  rules: [PiiKind.CardNumber.mask()],
  files: PiiFileAction.AllowOriginal,
})
export class CardPiiPolicy {}

/**
 * A browser plugged into an agent, two ways on one application: plain Playwright as `@Tool`s with the
 * shared browser injected (`web-workflow`) and the official `@playwright/mcp` server behind
 * `@McpServer` (`mcp-web-workflow`). The browser is closed by `SharedBrowser.onDestroy` when the
 * application stops; the contact form's submit is an outbound call (SQLite intents) keyed by the
 * request's business key.
 */
@Application({
  name: "browser-playwright-application",
  version: "1.0.0",
  modelProvider: OpenRouterModelProvider,
  storage: BrowserPlaywrightDatabaseStorage, // every store on one SQLite file, with the PII key and the idempotency secret
  piiPolicies: [CardPiiPolicy],
  workflows: [WebWorkflow, McpWebWorkflow],
  providers: [
    OpenRouterModelProvider,
    SharedBrowser,
    ContactDesk,
  ],
  budgets: [BrowserApplicationDailyBudget, BrowserTenantDailyBudget, BrowserExecutionBudget],
})
export class BrowserPlaywrightApplication {}

/**
 * A negative fixture (R5): a model router whose flow forgets one of its routes. `@Router({ routes })`
 * names the analyst and the declined finish; the flow's `.onRoute(…)` lists only the analyst — the
 * model could pick a route the flow has no path for. `agboss check` refuses it with
 * `[router.routes-mismatch]` before anything runs (`tests/fixtures/missing-route.test.ts`). It is
 * never part of the example's application.
 */
import { Agent, Application, DecidedBy, Router, Workflow, WorkflowFinish, WorkflowStart, inline, onStart, toAgent, Ttl } from "@agboss/core";
import { DecisionsModelProvider, OpenRouterModelProvider } from "../../src/model-providers/openrouter.model-provider.js";
import { CreditReviewDatabaseStorage } from "../../src/storages/credit-review.database-storage.js";
import { CreditReviewApplicationDailyBudget } from "../../src/budgets/application-daily.budget.js";
import { CreditReviewExecutionBudget } from "../../src/budgets/execution.budget.js";
import { CreditReviewTenantDailyBudget } from "../../src/budgets/tenant-daily.budget.js";
import { CreditApplicationDto } from "../../src/dto/credit-application.dto.js";
import { CreditMemoDto } from "../../src/dto/credit-memo.dto.js";

@WorkflowStart({
  name: "missing-route-workflow-start",
  description: "A credit application",
  input: CreditApplicationDto,
})
export class MissingRouteWorkflowStart {}

@WorkflowFinish({
  name: "missing-route-declined-workflow-finish",
  description: "The application is declined",
  output: CreditApplicationDto,
})
export class MissingRouteDeclinedWorkflowFinish {}

@WorkflowFinish({
  name: "missing-route-memo-workflow-finish",
  description: "The memo",
  output: CreditMemoDto,
})
export class MissingRouteMemoWorkflowFinish {}

@Agent({
  name: "missing-route-analyst-agent",
  description: "Writes the credit memo",
  prompt: inline("Write a credit memo on the application."),
  model: "google/gemini-2.5-flash-lite",
  input: { application: CreditApplicationDto },
  output: CreditMemoDto,
})
export class MissingRouteAnalystAgent {}

@Router({
  name: "missing-route-model-router",
  description: "Declines an application or sends it to the analyst",
  decidedBy: DecidedBy.Model,
  model: "typesafe/jev-1.13",
  modelProvider: DecisionsModelProvider,
  prompt: inline("Decide where a credit application goes."),
  input: { application: CreditApplicationDto },
  routes: [
    { target: MissingRouteAnalystAgent, prompt: "The application meets every threshold" },
    { target: MissingRouteDeclinedWorkflowFinish, prompt: "Stop and decline the application" },
  ],
})
export class MissingRouteModelRouter {}

@Workflow({
  name: "missing-route-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(MissingRouteWorkflowStart)
      .toRouter(MissingRouteModelRouter)
      .onRoute(toAgent(MissingRouteAnalystAgent) // the declined finish is missing
          .toFinish(MissingRouteMemoWorkflowFinish)),
  ],
})
export class MissingRouteWorkflow {}

@Application({
  name: "missing-route-application",
  version: "1.0.0",
  storage: CreditReviewDatabaseStorage,
  modelProvider: OpenRouterModelProvider,
  workflows: [MissingRouteWorkflow],
  providers: [OpenRouterModelProvider, DecisionsModelProvider],
  budgets: [
    CreditReviewApplicationDailyBudget,
    CreditReviewTenantDailyBudget,
    CreditReviewExecutionBudget,
  ],
})
export class MissingRouteApplication {}

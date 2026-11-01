/**
 * A negative fixture (R5): a model router whose flow forgets one of its routes. `@Router({ routes })`
 * names the analyst and the declined finish; the flow's `.chooseOne(…)` lists only the analyst — the
 * model could pick a route the flow has no path for. `agboss check` refuses it with
 * `[router.routes-mismatch]` before anything runs (`tests/fixtures/missing-route.test.ts`). It is
 * never part of the example's application.
 */
import {
  Agent,
  Application,
  DecidedBy,
  EmptyEnvironment,
  Router,
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  route,
  start,
} from "@agboss/core";
import { DecisionsModelProvider } from "@agboss/core/models";
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
  prompt: "Write a credit memo on the application.",
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
  prompt: "Decide where a credit application goes.",
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
  flow: [
    start(MissingRouteWorkflowStart)
      .returns(CreditApplicationDto)
      .toRouter(MissingRouteModelRouter)
      .chooseOne(
        route(MissingRouteAnalystAgent) // the declined finish is missing
          .returns(CreditMemoDto)
          .toFinish(MissingRouteMemoWorkflowFinish),
      ),
  ],
})
export class MissingRouteWorkflow {}

@Application({
  name: "missing-route-application",
  version: "1.0.0",
  environment: EmptyEnvironment,
  workflows: [MissingRouteWorkflow],
  providers: [DecisionsModelProvider],
  budgets: [
    CreditReviewApplicationDailyBudget,
    CreditReviewTenantDailyBudget,
    CreditReviewExecutionBudget,
  ],
})
export class MissingRouteApplication {}

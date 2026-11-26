import { toAction, LimitError, Workflow, onStart, onAgent, toAgent, toFinish, Ttl } from "@agboss/core";
import { EscalateToCommitteeAction } from "../../actions/escalate-to-committee.action.js";
import { CreditAnalystAgent } from "../../agents/credit-analyst/credit-analyst.agent.js";
import { MemoEditorAgent } from "../../agents/memo-editor/memo-editor.agent.js";
import { RiskOfficerAgent } from "../../agents/risk-officer/risk-officer.agent.js";
import { CreditIntentModelRouter } from "../../routers/credit-intent-model/credit-intent-model.router.js";
import { CreditLimitCodeRouter } from "../../routers/credit-limit-code/credit-limit-code.router.js";
import { CodeRoutedCreditWorkflowStart } from "./code-routed-credit.workflow-start.js";
import { CreditApprovedWorkflowFinish } from "./credit-approved.workflow-finish.js";
import { CreditDeclinedWorkflowFinish } from "./credit-declined.workflow-finish.js";
import { CreditEscalatedWorkflowFinish } from "./credit-escalated.workflow-finish.js";
import { ModelRoutedCreditWorkflowStart } from "./model-routed-credit.workflow-start.js";

/**
 * One workflow, two starts: the same application is routed by code through one and by a model
 * through the other, onto the same two routes. Both reach the same review loop, written once as
 * the analyst's and the risk officer's own paths: the officer requests changes or approves; the
 * editor rewrites; its `maxVisits` spent is taken by `.onError(LimitError.Visits, …)` to
 * the committee — the loop always ends on a defined finish.
 */
@Workflow({
  name: "credit-review-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(CodeRoutedCreditWorkflowStart)
      .toRouter(CreditLimitCodeRouter)
      .onRoute(toAgent(CreditAnalystAgent))
      .onRoute(toFinish(CreditDeclinedWorkflowFinish)),

    onStart(ModelRoutedCreditWorkflowStart)
      .toRouter(CreditIntentModelRouter)
      .onRoute(toAgent(CreditAnalystAgent))
      .onRoute(toFinish(CreditDeclinedWorkflowFinish)),

    // reached from both routers: the analyst's path is its own
    onAgent(CreditAnalystAgent)
      .toAgent(RiskOfficerAgent),

    // reached from the analyst and from the editor: the officer's switch is its own path
    onAgent(RiskOfficerAgent)
      .toOneOf([toAgent(MemoEditorAgent)
          .onError(
            LimitError.Visits, // the editor's maxVisits spent: the committee decides
            toAction(EscalateToCommitteeAction)
              .toFinish(CreditEscalatedWorkflowFinish),
          )
          .toAgent(RiskOfficerAgent), toFinish(CreditApprovedWorkflowFinish)]),
  ],
  // the loop's worst case, in agent and router steps: the router, the analyst, the officer 5 times
  // (its maxVisits), the editor 4 times (its), the committee's action — 12 (an action counts as a step now). A lower maxSteps would stop the stubborn run
  // with LimitError.Steps before the editor's limit takes it to the committee: agboss check
  // warns then ([limits.max-steps-below-worst-case], agbossjs/agboss#643), and the AC3 test runs it.
  defaults: { models: { temperature: 0 } },
  executionLimits: { maxSteps: 12 },
})
export class CreditReviewWorkflow {}

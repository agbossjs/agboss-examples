import {
  agent,
  caseOf,
  oneOf,
  route,
  start,
  toAction,
  VisitsLimitExceededError,
  Workflow,
} from "@agboss/core";
import { EscalateToCommitteeAction } from "../../actions/escalate-to-committee.action.js";
import { CreditAnalystAgent } from "../../agents/credit-analyst/credit-analyst.agent.js";
import { MemoEditorAgent } from "../../agents/memo-editor/memo-editor.agent.js";
import { RiskOfficerAgent } from "../../agents/risk-officer/risk-officer.agent.js";
import { CommitteeEscalationDto } from "../../dto/committee-escalation.dto.js";
import { CreditApplicationDto } from "../../dto/credit-application.dto.js";
import { CreditMemoDto } from "../../dto/credit-memo.dto.js";
import { MemoApprovedDto } from "../../dto/memo-approved.dto.js";
import { MemoChangesRequestedDto } from "../../dto/memo-changes-requested.dto.js";
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
 * editor rewrites; its `maxVisits` spent is taken by `.onError(VisitsLimitExceededError, …)` to
 * the committee — the loop always ends on a defined finish.
 */
@Workflow({
  name: "credit-review-workflow",
  version: "1.0.0",
  flow: [
    start(CodeRoutedCreditWorkflowStart)
      .returns(CreditApplicationDto)
      .toRouter(CreditLimitCodeRouter)
      .chooseOne(
        route(CreditAnalystAgent),
        route(CreditDeclinedWorkflowFinish),
      ),

    start(ModelRoutedCreditWorkflowStart)
      .returns(CreditApplicationDto)
      .toRouter(CreditIntentModelRouter)
      .chooseOne(
        route(CreditAnalystAgent),
        route(CreditDeclinedWorkflowFinish),
      ),

    // reached from both routers: the analyst's path is its own
    agent(CreditAnalystAgent)
      .returns(CreditMemoDto)
      .toAgent(RiskOfficerAgent),

    // reached from the analyst and from the editor: the officer's switch is its own path
    agent(RiskOfficerAgent)
      .returns(oneOf(MemoChangesRequestedDto, MemoApprovedDto))
      .switch(
        caseOf(MemoChangesRequestedDto, { about: CreditMemoDto }) // the notes are about this memo
          .toAgent(MemoEditorAgent)
          .onError(
            VisitsLimitExceededError, // the editor's maxVisits spent: the committee decides
            toAction(EscalateToCommitteeAction)
              .returns(CommitteeEscalationDto)
              .toFinish(CreditEscalatedWorkflowFinish),
          )
          .returns(CreditMemoDto)
          .toAgent(RiskOfficerAgent),
        caseOf(MemoApprovedDto)
          .toFinish(CreditApprovedWorkflowFinish),
      ),
  ],
  // the loop's worst case, in agent and router steps: the router, the analyst, the officer 4 times
  // (its maxVisits), the editor 3 times (its) — 9. A lower maxSteps would stop the stubborn run
  // with MaxStepsExceededError before the editor's limit takes it to the committee; agboss check
  // bounds maxSteps by the shortest path only (agbossjs/agboss#643), so the AC3 test is what keeps
  // this number right.
  maxSteps: 9,
  defaults: { models: { temperature: 0 } },
})
export class CreditReviewWorkflow {}

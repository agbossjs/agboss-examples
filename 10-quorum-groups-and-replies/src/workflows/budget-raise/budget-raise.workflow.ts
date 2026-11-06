import {
  caseOf,
  oneOf,
  question,
  QuestionFailedError,
  start,
  toFinish,
  VisitsLimitExceededError,
  Workflow,
} from "@agboss/core";
import { CheckBudgetRaiseAction } from "../../actions/check-budget-raise.action.js";
import { BudgetOwnerQuestion } from "../../channels/budget-owner-question.channel-role.js";
import { BudgetOwnerAnswerDto } from "../../dto/budget-owner-answer.dto.js";
import { BudgetRaisedDto } from "../../dto/budget-raised.dto.js";
import { BudgetRaiseRequestDto } from "../../dto/budget-raise-request.dto.js";
import { BudgetRaiseRequestWorkflowStart } from "./budget-raise-request.workflow-start.js";
import { BudgetRaisedWorkflowFinish } from "./budget-raised.workflow-finish.js";
import { BudgetRaiseUnaskedWorkflowFinish } from "./budget-raise-unasked.workflow-finish.js";
import { BudgetRaiseUnresolvedWorkflowFinish } from "./budget-raise-unresolved.workflow-finish.js";

/**
 * A question role as a flow step (agbossjs/agboss#659): the request asks its budget owner, through
 * `BudgetOwnerQuestion`, how far the line may be raised — the run pauses until the owner's free-text
 * reply is read into a typed `BudgetOwnerAnswerDto`. A limit below the request asks again (the
 * question's own path, `question(BudgetOwnerQuestion)`), at most `maxVisits: 2` times: the third ask
 * is `VisitsLimitExceededError` → unresolved. A channel that cannot ask is `QuestionFailedError` →
 * unasked. No model anywhere: $0.
 */
@Workflow({
  name: "budget-raise-workflow",
  version: "1.0.0",
  flow: [
    start(BudgetRaiseRequestWorkflowStart)
      .returns(BudgetRaiseRequestDto)
      .toQuestion(BudgetOwnerQuestion),
    question(BudgetOwnerQuestion)
      .onError(QuestionFailedError, toFinish(BudgetRaiseUnaskedWorkflowFinish))
      .onError(VisitsLimitExceededError, toFinish(BudgetRaiseUnresolvedWorkflowFinish))
      .returns(BudgetOwnerAnswerDto, { about: BudgetRaiseRequestDto })
      .toAction(CheckBudgetRaiseAction)
      .returns(oneOf(BudgetRaisedDto, BudgetRaiseRequestDto))
      .switch(
        caseOf(BudgetRaisedDto)
.toFinish(BudgetRaisedWorkflowFinish),
        caseOf(BudgetRaiseRequestDto)
.toQuestion(BudgetOwnerQuestion),
      ),
  ],
})
export class BudgetRaiseWorkflow {}

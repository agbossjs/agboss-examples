import { QuestionFailedError, toExternalTask, toFinish, VisitsLimitExceededError, Workflow, onStart, onExternalTask, Ttl } from "@agboss/core";
import { CheckBudgetRaiseAction } from "../../actions/check-budget-raise.action.js";
import { BudgetOwnerExternalTask } from "../../channels/budget-owner.external-task.js";
import { BudgetRaiseRequestWorkflowStart } from "./budget-raise-request.workflow-start.js";
import { BudgetRaisedWorkflowFinish } from "./budget-raised.workflow-finish.js";
import { BudgetRaiseUnaskedWorkflowFinish } from "./budget-raise-unasked.workflow-finish.js";
import { BudgetRaiseUnresolvedWorkflowFinish } from "./budget-raise-unresolved.workflow-finish.js";

/**
 * An external task as a flow step (agbossjs/agboss#659): the request asks its budget owner, through
 * `BudgetOwnerExternalTask`, how far the line may be raised — the run pauses until the owner's free-text
 * reply is read into a typed `BudgetOwnerAnswerDto`. A limit below the request asks again (the
 * question's own path, `onExternalTask(BudgetOwnerExternalTask)`), at most `maxVisits: 2` times: the third ask
 * is `VisitsLimitExceededError` → unresolved. A channel that cannot ask is `QuestionFailedError` →
 * unasked. No model anywhere: $0.
 */
@Workflow({
  name: "budget-raise-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(BudgetRaiseRequestWorkflowStart)
      .toExternalTask(BudgetOwnerExternalTask),
    onExternalTask(BudgetOwnerExternalTask)
      .onError(QuestionFailedError, toFinish(BudgetRaiseUnaskedWorkflowFinish))
      .onError(VisitsLimitExceededError, toFinish(BudgetRaiseUnresolvedWorkflowFinish))
      .toAction(CheckBudgetRaiseAction)
      .toOneOf([toFinish(BudgetRaisedWorkflowFinish), toExternalTask(BudgetOwnerExternalTask)]),
  ],
})
export class BudgetRaiseWorkflow {}

import { ExternalTask, PauseRespondent } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { BudgetOwnerReplyInterpreter } from "../channel-interpreters/budget-owner/budget-owner.channel-interpreter.js";
import { BudgetOwnerAnswerDto } from "../dto/budget-owner-answer.dto.js";
import { BudgetRaiseRequestDto } from "../dto/budget-raise-request.dto.js";

/**
 * An external task (agbossjs/agboss#659): a flow step — `.toExternalTask(BudgetOwnerExternalTask)` — asks the
 * budget owner about a `BudgetRaiseRequestDto` and puts a typed `BudgetOwnerAnswerDto` on the path.
 * The owner answers through the channel's own side (`PauseRespondent.Delegate`: the pause's id is the
 * channel's) in free text, read by `BudgetOwnerReplyInterpreter`. A limit below the request asks
 * again, at most `maxVisits` times. Its one channel is listed in `@Application({ channels })`.
 */
@ExternalTask({
  name: "budget-owner-external-task",
  description: "Asks a budget line's owner how far the line may be raised",
  input: BudgetRaiseRequestDto,
  output: BudgetOwnerAnswerDto,
  respondent: PauseRespondent.Delegate,
  timeout: hours(24),
  channelInterpreter: BudgetOwnerReplyInterpreter,
  maxVisits: 2,
})
export class BudgetOwnerExternalTask {}

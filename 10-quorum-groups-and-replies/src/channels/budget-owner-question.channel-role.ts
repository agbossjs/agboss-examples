import { ChannelOf, ChannelRole, PauseAnswerer } from "@agboss/core";
import { BudgetOwnerAnswerDto } from "../dto/budget-owner-answer.dto.js";
import { BudgetRaiseRequestDto } from "../dto/budget-raise-request.dto.js";
import { BudgetOwnerReplyInterpreter } from "../reply-interpreters/budget-owner/budget-owner.reply-interpreter.js";

/**
 * A question role (agbossjs/agboss#659): a flow step — `.toQuestion(BudgetOwnerQuestion)` — asks the
 * budget owner about a `BudgetRaiseRequestDto` and puts a typed `BudgetOwnerAnswerDto` on the path.
 * The owner answers through the channel's own side (`PauseAnswerer.Channel`: the pause's id is the
 * channel's) in free text, read by `BudgetOwnerReplyInterpreter`. A limit below the request asks
 * again, at most `maxVisits` times. Its one implementation is listed in `@Application({ providers })`.
 */
@ChannelRole({
  name: "budget-owner-question",
  description: "Asks a budget line's owner how far the line may be raised",
  ask: BudgetRaiseRequestDto,
  answer: BudgetOwnerAnswerDto,
  answeredBy: PauseAnswerer.Channel,
  replyInterpreter: BudgetOwnerReplyInterpreter,
  maxVisits: 2,
})
export abstract class BudgetOwnerQuestion extends ChannelOf<BudgetOwnerQuestion> {}

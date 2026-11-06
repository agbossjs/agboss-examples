import {
  DecidedBy,
  ReplyInterpretation,
  ReplyInterpreter,
  type InputOf,
  type OutputOf,
  type ReplyInterpreterHandler,
} from "@agboss/core";

/**
 * Reads a budget owner's words into the question's typed answer, by code (no model, $0): "up to
 * $2,000" or "$2000" is a limit, "no" is a limit of 0. Anything else is not understood — the
 * pause stays pending (`UninterpretableReplyError`), nothing goes on on a guess.
 */
@ReplyInterpreter({
  name: "budget-owner-reply-interpreter",
  description: "Reads a budget owner's limit from a free-text reply",
  decidedBy: DecidedBy.Code,
})
export class BudgetOwnerReplyInterpreter implements ReplyInterpreterHandler<BudgetOwnerReplyInterpreter> {
  interpret(
    input: InputOf<BudgetOwnerReplyInterpreter>,
  ): ReplyInterpretation<OutputOf<BudgetOwnerReplyInterpreter>> {
    const amount = /\$\s?(\d[\d,]*)/.exec(input.reply);
    if (amount?.[1] !== undefined)
      return ReplyInterpretation.understood({ limitUsd: Number(amount[1].replaceAll(",", "")) });
    if (/^\s*no\b/i.test(input.reply)) return ReplyInterpretation.understood({ limitUsd: 0 });
    return ReplyInterpretation.notUnderstood({ reason: `"${input.reply}" names no limit` });
  }
}

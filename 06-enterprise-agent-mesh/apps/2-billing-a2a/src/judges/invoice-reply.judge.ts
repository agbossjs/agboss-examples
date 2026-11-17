import { Judge, JudgeModel, JudgeVerdict, type JudgeHandler, type JudgeInput } from "@agboss/core";
import { PlainTextDto } from "@agboss/core/dto";

/**
 * A second model reads the reviewer's reply before it is let through. Its own text (the verdict and
 * its reasoning) is internal: the stream of the run and of the A2A task carries the reply only (#1004).
 */
@Judge({
  name: "invoice-reply-judge",
  // another vendor than the reviewer: a judge grades its own family's answers too kindly (judge.same-model-family)
  model: "google/gemini-2.5-flash-lite",
  reply: PlainTextDto,
  deps: [JudgeModel],
})
export class InvoiceReplyJudge implements JudgeHandler<PlainTextDto> {
  constructor(private readonly judgeModel: JudgeModel) {}

  async judge({ reply }: JudgeInput<PlainTextDto>): Promise<JudgeVerdict> {
    const verdict = await this.judgeModel.invoke(
      `AUDIT RUBRIC: does this reply state the invoice's item count and total? Say PASS or FAIL.\n${reply.text}`,
    );
    return verdict.startsWith("PASS")
      ? JudgeVerdict.passed()
      : JudgeVerdict.failed({ reason: "the reply does not state the item count and total" });
  }
}

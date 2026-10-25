import {
  Judge,
  JudgeModel,
  JudgeVerdict,
  type JudgeHandler,
  type JudgeInput,
} from "agboss";
import { SupportAnswerDto } from "../../dto/support-answer.dto.js";

@Judge({
  name: "grounded-answer-judge",
  description: "Model judge verifying that the support explanation is grounded in the order record and active policy.",
  model: "delegate/judge-chat",
  reply: SupportAnswerDto,
  deps: [JudgeModel],
})
export class GroundedAnswerJudge implements JudgeHandler<SupportAnswerDto> {
  constructor(private readonly judgeModel: JudgeModel) {}

  async judge({ reply, task }: JudgeInput<SupportAnswerDto>): Promise<JudgeVerdict> {
    const verdictText = await this.judgeModel.invoke(
      `Evaluate groundedness of support answer.\nTask: ${task}\nDecision: ${reply.decision} ($${reply.refundedUsd}) for ${reply.orderId}\nExplanation: ${reply.explanation}`,
    );
    const passed = !verdictText.startsWith("FAILED:");
    const mentionsFee = reply.explanation.toLowerCase().includes("restocking fee");
    return passed
      ? JudgeVerdict.passed({
          metrics: {
            grounded: "yes",
            mentionsFee: mentionsFee ? "yes" : "no",
          },
        })
      : JudgeVerdict.failed({
          reason: verdictText.replace(/^FAILED:\s*/u, ""),
          metrics: {
            grounded: "no",
            mentionsFee: mentionsFee ? "yes" : "no",
          },
        });
  }
}

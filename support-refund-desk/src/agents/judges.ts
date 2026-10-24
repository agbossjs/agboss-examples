import {
  DecidedBy,
  Judge,
  JudgeModel,
  JudgeVerdict,
  type JudgeHandler,
  type JudgeInput,
} from "agboss";
import { SupportAnswerDto } from "../workflows/dtos.js";

@Judge({
  name: "citation-code-judge",
  description: "Deterministic $0 code judge verifying [policy] citation and refund cap invariants.",
  decidedBy: DecidedBy.Code,
  reply: SupportAnswerDto,
})
export class CitationCodeJudge implements JudgeHandler<SupportAnswerDto> {
  judge({ reply }: JudgeInput<SupportAnswerDto>): Promise<JudgeVerdict> {
    const citesPolicy = reply.explanation.includes("[policy]");
    const respectsCap =
      reply.decision === "approved"
        ? reply.refundedUsd > 0 && reply.refundedUsd <= 500
        : reply.refundedUsd === 0;

    if (!citesPolicy) {
      return Promise.resolve(
        JudgeVerdict.failed({
          reason: "Explanation must cite the active refund policy as [policy].",
          metrics: { citesPolicy: false, respectsCap },
        }),
      );
    }
    if (!respectsCap) {
      return Promise.resolve(
        JudgeVerdict.failed({
          reason: "Approved refunds must be in (0, 500]; escalated/denied refunds must have refundedUsd=0.",
          metrics: { citesPolicy: true, respectsCap: false },
        }),
      );
    }
    return Promise.resolve(
      JudgeVerdict.passed({
        metrics: { citesPolicy: true, respectsCap: true },
      }),
    );
  }
}

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

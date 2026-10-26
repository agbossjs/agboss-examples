import {
  DecidedBy,
  Judge,
  JudgeVerdict,
  type JudgeHandler,
  type JudgeInput,
} from "@agboss/core";
import { SupportAnswerDto } from "../../dto/support-answer.dto.js";

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

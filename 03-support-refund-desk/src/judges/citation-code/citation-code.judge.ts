import { Judge, JudgeVerdict, type JudgeHandler, type JudgeInput } from "@agboss/core";
import { SupportAnswerDto } from "../../dto/support-answer.dto.js";

@Judge({
  name: "citation-code-judge",
  description: "Deterministic $0 code judge verifying [policy] citation and refund cap invariants.",
  output: SupportAnswerDto,
})
export class CitationCodeJudge implements JudgeHandler<SupportAnswerDto> {
  judge({ output }: JudgeInput<SupportAnswerDto>): Promise<JudgeVerdict> {
    const citesPolicy = output.explanation.includes("[policy]");
    const respectsCap =
      output.decision === "approved"
        ? output.refundedUsd > 0 && output.refundedUsd <= 500
        : output.refundedUsd === 0;

    if (!citesPolicy) {
      return Promise.resolve(
        JudgeVerdict.failed("Explanation must cite the active refund policy as [policy].", { metrics: { citesPolicy: false, respectsCap } }),
      );
    }
    if (!respectsCap) {
      return Promise.resolve(
        JudgeVerdict.failed("Approved refunds must be in (0, 500]; escalated/denied refunds must have refundedUsd=0.", { metrics: { citesPolicy: true, respectsCap: false } }),
      );
    }
    return Promise.resolve(
      JudgeVerdict.passed({
        metrics: { citesPolicy: true, respectsCap: true },
      }),
    );
  }
}

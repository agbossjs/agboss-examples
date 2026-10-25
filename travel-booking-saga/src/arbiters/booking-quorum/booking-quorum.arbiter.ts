import { Arbiter, DecidedBy, OnAnswer } from "agboss";
import { ComplianceReviewerAgent } from "../../agents/compliance-reviewer/compliance-reviewer.agent.js";
import { FinanceReviewerAgent } from "../../agents/finance-reviewer/finance-reviewer.agent.js";
import { RiskReviewerAgent } from "../../agents/risk-reviewer/risk-reviewer.agent.js";
import { ReviewerVoteDto } from "../../dto/reviewer-vote.dto.js";

@Arbiter({
  name: "booking-quorum-arbiter",
  decidedBy: DecidedBy.Code,
})
export class BookingQuorumArbiter {
  @OnAnswer(FinanceReviewerAgent)
  fromFinanceReviewer(answer: ReviewerVoteDto): boolean {
    return answer.approved && answer.confidenceScore >= 80;
  }

  @OnAnswer(ComplianceReviewerAgent)
  fromComplianceReviewer(answer: ReviewerVoteDto): boolean {
    return answer.approved && answer.confidenceScore >= 80;
  }

  @OnAnswer(RiskReviewerAgent)
  fromRiskReviewer(answer: ReviewerVoteDto): boolean {
    return answer.approved && answer.confidenceScore >= 80;
  }
}

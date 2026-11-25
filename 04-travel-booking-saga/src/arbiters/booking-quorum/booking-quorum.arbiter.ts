import { Arbiter, Arbitrate } from "@agboss/core";
import { ComplianceReviewerAgent } from "../../agents/compliance-reviewer/compliance-reviewer.agent.js";
import { FinanceReviewerAgent } from "../../agents/finance-reviewer/finance-reviewer.agent.js";
import { RiskReviewerAgent } from "../../agents/risk-reviewer/risk-reviewer.agent.js";
import { ReviewerVoteDto } from "../../dto/reviewer-vote.dto.js";

@Arbiter({
  name: "booking-quorum-arbiter",
})
export class BookingQuorumArbiter {
  @Arbitrate(FinanceReviewerAgent)
  fromFinanceReviewer(answer: ReviewerVoteDto): boolean {
    return answer.approved && answer.confidenceScore >= 80;
  }

  @Arbitrate(ComplianceReviewerAgent)
  fromComplianceReviewer(answer: ReviewerVoteDto): boolean {
    return answer.approved && answer.confidenceScore >= 80;
  }

  @Arbitrate(RiskReviewerAgent)
  fromRiskReviewer(answer: ReviewerVoteDto): boolean {
    return answer.approved && answer.confidenceScore >= 80;
  }
}

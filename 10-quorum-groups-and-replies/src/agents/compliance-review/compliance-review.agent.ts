import { Agent } from "@agboss/core";
import { ComplianceReviewDto } from "../../dto/compliance-review.dto.js";
import { PurchaseRequestDto } from "../../dto/purchase-request.dto.js";
import { CHAT_MODEL } from "../../model-providers/models.js";

/** One of the four parallel reviews of a purchase request. */
@Agent({
  name: "compliance-review-agent",
  description: "Reviews the supplier against the purchasing policy",
  promptUrls: ["./compliance-review.prompt.md"],
  model: CHAT_MODEL,
  input: {
    request: PurchaseRequestDto,
  },
  output: ComplianceReviewDto,
})
export class ComplianceReviewAgent {}

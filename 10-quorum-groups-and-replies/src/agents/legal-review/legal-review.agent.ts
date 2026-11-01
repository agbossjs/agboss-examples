import { Agent } from "@agboss/core";
import { LegalReviewDto } from "../../dto/legal-review.dto.js";
import { PurchaseRequestDto } from "../../dto/purchase-request.dto.js";
import { CHAT_MODEL } from "../../model-providers/models.js";

/** One of the four parallel reviews of a purchase request. */
@Agent({
  name: "legal-review-agent",
  description: "Reviews the supplier's contract",
  promptUrls: ["./legal-review.prompt.md"],
  model: CHAT_MODEL,
  input: {
    request: PurchaseRequestDto,
  },
  output: LegalReviewDto,
})
export class LegalReviewAgent {}

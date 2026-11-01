import { Agent } from "@agboss/core";
import { ComplianceReviewDto } from "../../dto/compliance-review.dto.js";
import { LegalReviewDto } from "../../dto/legal-review.dto.js";
import { PurchaseOrderDto } from "../../dto/purchase-order.dto.js";
import { PurchaseRequestDto } from "../../dto/purchase-request.dto.js";
import { CAREFUL_CHAT_MODEL } from "../../model-providers/models.js";
import { PlacePurchaseOrderTool } from "../../tools/place-purchase-order.tool.js";

/**
 * Group 1's path: with the legal and compliance reviews counted, it places the order through
 * `place-purchase-order-tool` — which waits for an approver — and reports how it ended.
 */
@Agent({
  name: "purchase-order-agent",
  description: "Places the purchase order and reports how it ended",
  promptUrls: ["./purchase-order.prompt.md"],
  model: CAREFUL_CHAT_MODEL,
  input: {
    request: PurchaseRequestDto,
    legal: LegalReviewDto,
    compliance: ComplianceReviewDto,
  },
  output: PurchaseOrderDto,
  tools: [PlacePurchaseOrderTool],
  maxVisits: 1,
})
export class PurchaseOrderAgent {}

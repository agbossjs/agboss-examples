import { WorkflowStart } from "@agboss/core";
import { PurchaseRequestDto } from "../../dto/purchase-request.dto.js";

/** Where a purchase starts: what a team asks to buy, from whom, for how much. */
@WorkflowStart({
  name: "purchase-request-workflow-start",
  description: "A purchase request from a team",
  input: PurchaseRequestDto,
})
export class PurchaseRequestWorkflowStart {}

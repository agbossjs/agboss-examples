import { WorkflowFinish } from "@agboss/core";
import { PurchaseRequestDto } from "../../dto/purchase-request.dto.js";

/** Where a purchase ends when no group of reviews completes in time: the request, as it came. */
@WorkflowFinish({
  name: "purchase-rejected-workflow-finish",
  description: "No group of reviews completed: the request is rejected",
  output: PurchaseRequestDto,
})
export class PurchaseRejectedWorkflowFinish {}

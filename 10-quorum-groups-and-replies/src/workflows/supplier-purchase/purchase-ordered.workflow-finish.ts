import { WorkflowFinish } from "@agboss/core";
import { PurchaseOrderDto } from "../../dto/purchase-order.dto.js";

/** Where group 1's path ends: the order placed (at the approved amount), or refused by the approver. */
@WorkflowFinish({
  name: "purchase-ordered-workflow-finish",
  description: "The purchase order, placed or refused by the approver",
  output: PurchaseOrderDto,
})
export class PurchaseOrderedWorkflowFinish {}

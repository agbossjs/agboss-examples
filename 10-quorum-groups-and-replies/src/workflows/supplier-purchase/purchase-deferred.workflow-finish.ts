import { WorkflowFinish } from "@agboss/core";
import { PurchaseDeferredDto } from "../../dto/purchase-deferred.dto.js";

/** Where group 2's path ends: the purchase waits for its legal and compliance reviews. */
@WorkflowFinish({
  name: "purchase-deferred-workflow-finish",
  description: "The purchase waits for its legal and compliance reviews",
  output: PurchaseDeferredDto,
})
export class PurchaseDeferredWorkflowFinish {}

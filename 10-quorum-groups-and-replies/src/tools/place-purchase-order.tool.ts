import { createHash } from "node:crypto";
import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { PurchaseApproverToolApproval } from "../channels/purchase-approver.tool-approval.js";
import { PlacePurchaseOrderDto } from "../dto/place-purchase-order.dto.js";
import { PurchaseOrderPlacedDto } from "../dto/purchase-order-placed.dto.js";

/** A short, stable order reference from the call's idempotency key. */
const referenceOf = (key: string): string =>
  createHash("sha256").update(key).digest("hex").slice(0, 8).toUpperCase();

/**
 * Places the purchase order — only once an approver approves it: every call waits on
 * `PurchaseApproverToolApproval`. It runs with the arguments the approver approved (a capped amount
 * replaces the asked one). Its reference is the call's idempotency key, the one a real supplier
 * portal would deduplicate on.
 */
@Tool({
  name: "place-purchase-order-tool",
  description: "Places a purchase order once an approver approves it",
  input: PlacePurchaseOrderDto,
  output: PurchaseOrderPlacedDto,
  approval: PurchaseApproverToolApproval,
  deps: [ExecutionContext],
})
export class PlacePurchaseOrderTool
  implements ToolHandler<PlacePurchaseOrderDto, PurchaseOrderPlacedDto>
{
  constructor(private readonly executionContext: ExecutionContext) {}

  execute({ amountUsd }: PlacePurchaseOrderDto): Promise<PurchaseOrderPlacedDto> {
    return Promise.resolve({
      reference: `PO-${referenceOf(this.executionContext.step.idempotencyKey)}`,
      amountUsd,
    });
  }
}

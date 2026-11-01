import { Flag, Integer, Text } from "@agboss/core/dto";

/** How the purchase ended: ordered (at the approved amount) or not. */
export class PurchaseOrderDto {
  @Text({ prompt: "the supplier" })
  supplier!: string;

  @Flag({ prompt: "whether the order was placed" })
  isOrdered!: boolean;

  @Integer({ prompt: "the amount ordered, in whole US dollars; 0 if nothing was ordered", min: 0 })
  amountUsd!: number;

  @Text({ prompt: "the order's reference, or why nothing was ordered" })
  note!: string;
}

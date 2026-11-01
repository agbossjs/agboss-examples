import { Integer, Text } from "@agboss/core/dto";

/** What the tool did: the order placed, at the amount approved. */
export class PurchaseOrderPlacedDto {
  @Text({ prompt: "the order's reference" })
  reference!: string;

  @Integer({ prompt: "the amount ordered, in whole US dollars", min: 1 })
  amountUsd!: number;
}

import { Integer, Text } from "@agboss/core/dto";

/** What the purchase-order tool is called with — what the approver approves (and may cap). */
export class PlacePurchaseOrderDto {
  @Text({ prompt: "the supplier" })
  supplier!: string;

  @Text({ prompt: "what is bought, in one line" })
  itemDescription!: string;

  @Integer({ prompt: "the amount to order, in whole US dollars", min: 1 })
  amountUsd!: number;
}

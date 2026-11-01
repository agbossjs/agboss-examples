import { Integer, Text } from "@agboss/core/dto";

/** What the model passes to the charge tools: the order the execution works on, and its amount. */
export class ChargeToolInputDto {
  @Text({ prompt: "the order's id" })
  orderId!: string;

  @Integer({ prompt: "the amount, in cents", min: 1 })
  amountCents!: number;
}

import { Integer, Text } from "@agboss/core/dto";

export class ReplyDraftDto {
  @Text({ prompt: "The reply to the customer" })
  text!: string;

  @Integer({ prompt: "The refund the reply promises, in cents (0 for none)", min: 0 })
  refundCents!: number;
}

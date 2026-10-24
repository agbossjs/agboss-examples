import { Integer, Text } from "agboss/dto";

export class SupportRequestDto {
  @Text({ prompt: "The order the customer writes about" })
  orderId!: string;

  @Text({ prompt: "The customer ID" })
  customerId!: string;

  @Text({ prompt: "The customer email address" })
  customerEmail!: string;

  @Text({ prompt: "The customer's message" })
  message!: string;
}

export class ResearchQuestionDto {
  @Text({ prompt: "One thing to check before answering" })
  question!: string;
}

export class ResearchFindingDto {
  @Text({ prompt: "The question checked" })
  question!: string;

  @Text({ prompt: "What the order's facts say" })
  answer!: string;
}

export class ReplyDraftDto {
  @Text({ prompt: "The reply to the customer" })
  text!: string;

  @Integer({ prompt: "The refund the reply promises, in cents (0 for none)", min: 0 })
  refundCents!: number;
}

export class ChangesRequestedDto {
  @Text({ prompt: "What to change in the reply" })
  notes!: string;
}

/** The reviewer's approval: the variant is the decision, so it needs no boolean flag. */
export class ReplyApprovedDto {
  @Text({ prompt: "A note for the record", optional: true })
  note?: string;
}

export class RefundOrderDto {
  @Text({ prompt: "The order to refund" })
  orderId!: string;

  @Integer({ prompt: "The amount in cents", min: 1 })
  amountCents!: number;
}

export class RefundIssuedDto {
  @Text({ prompt: "The refund's id" })
  refundId!: string;
}

export class OrderLookupDto {
  @Text({ prompt: "The order id" })
  orderId!: string;
}

export class OrderFactsDto {
  @Text({ prompt: "What is known about the order" })
  facts!: string;
}

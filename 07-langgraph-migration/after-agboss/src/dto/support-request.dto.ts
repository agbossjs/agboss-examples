import { Text } from "@agboss/core/dto";

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

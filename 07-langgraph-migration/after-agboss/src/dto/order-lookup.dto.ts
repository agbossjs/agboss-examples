import { Text } from "@agboss/core/dto";

export class OrderLookupDto {
  @Text({ prompt: "The order id" })
  orderId!: string;
}

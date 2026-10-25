import { Text } from "agboss/dto";

export class OrderLookupDto {
  @Text({ prompt: "The order id" })
  orderId!: string;
}

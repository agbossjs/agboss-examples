import { Text } from "agboss/dto";

export class RefundIssuedDto {
  @Text({ prompt: "The refund's id" })
  refundId!: string;
}

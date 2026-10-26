import { Text } from "@agboss/core/dto";

export class RefundIssuedDto {
  @Text({ prompt: "The refund's id" })
  refundId!: string;
}

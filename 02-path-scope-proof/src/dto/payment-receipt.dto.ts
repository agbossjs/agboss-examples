import { Text } from "agboss/dto";

export class PaymentReceiptDto {
  @Text({ prompt: "Capture transaction ID" })
  transactionId!: string;

  @Text({ prompt: "Status" })
  status!: string;
}

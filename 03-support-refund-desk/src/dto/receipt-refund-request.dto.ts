import { File, FileDto, Text } from "@agboss/core/dto";

/** A refund request with the customer's photo of the receipt or the card statement. */
export class ReceiptRefundRequestDto {
  @Text({ prompt: "What the customer asks for" })
  message!: string;

  @File({ prompt: "The photo of the receipt or card statement" })
  receipt!: FileDto;
}

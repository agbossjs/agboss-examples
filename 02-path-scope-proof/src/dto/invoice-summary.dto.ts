import { Integer, Text } from "agboss/dto";

export class InvoiceSummaryDto {
  @Text({ prompt: "Order identifier" })
  orderId!: string;

  @Integer({ prompt: "Final payable total in cents" })
  finalTotalCents!: number;

  @Text({ prompt: "Formatted invoice line" })
  invoiceText!: string;
}

import { Integer, Text } from "@agboss/core/dto";

export class FinalInvoiceDto {
  @Integer({ prompt: "Grand total in cents" })
  grandTotalCents!: number;

  @Text({ prompt: "Pricing source used" })
  pricingSource!: string;
}

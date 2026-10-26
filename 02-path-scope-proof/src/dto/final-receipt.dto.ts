import { Integer, Text } from "@agboss/core/dto";

export class FinalReceiptDto {
  @Integer({ prompt: "Grand total in cents" })
  grandTotalCents!: number;

  @Text({ prompt: "Summary description" })
  summary!: string;
}

import { Integer, Text } from "agboss/dto";

export class FinalReceiptDto {
  @Integer({ prompt: "Grand total in cents" })
  grandTotalCents!: number;

  @Text({ prompt: "Summary description" })
  summary!: string;
}

import { Integer, Text } from "agboss/dto";

export class PricingQuoteDto {
  @Integer({ prompt: "Quoted total in cents" })
  totalCents!: number;

  @Text({ prompt: "Source of quote" })
  source!: string;
}

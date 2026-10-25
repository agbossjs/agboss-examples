import { Integer } from "agboss/dto";

export class TaxSummaryDto {
  @Integer({ prompt: "Tax in cents" })
  taxCents!: number;
}

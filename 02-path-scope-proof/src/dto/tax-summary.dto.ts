import { Integer } from "@agboss/core/dto";

export class TaxSummaryDto {
  @Integer({ prompt: "Tax in cents" })
  taxCents!: number;
}

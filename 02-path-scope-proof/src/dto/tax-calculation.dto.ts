import { Integer } from "agboss/dto";

export class TaxCalculationDto {
  @Integer({ prompt: "Tax amount on base quote in cents" })
  taxCents!: number;
}

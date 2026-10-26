import { Integer, Text } from "@agboss/core/dto";

export class QuoteCalculationInputDto {
  @Text({ prompt: "plan tier (starter | pro | enterprise)" })
  tier!: string;

  @Integer({ prompt: "number of seats", min: 1, max: 1000 })
  seats!: number;
}

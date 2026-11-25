import { Bool, Float, Integer, Text } from "@agboss/core/dto";

export class QuoteCalculationOutputDto {
  @Text({ prompt: "normalized tier name" })
  tier!: string;

  @Integer({ prompt: "seat count", min: 1 })
  seats!: number;

  @Float({ prompt: "monthly total in catalog currency", min: 0 })
  monthlyTotalUsd!: number;

  @Bool({ prompt: "whether volume discount was applied" })
  volumeDiscountApplied!: boolean;

  @Text({ prompt: "currency code from environment" })
  currency!: string;
}

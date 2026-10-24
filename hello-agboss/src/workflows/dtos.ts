import { Decimal, Flag, Integer, Text } from "agboss/dto";

export class CustomerInquiryDto {
  @Text({ prompt: "customer identifier", minLength: 1 })
  customerId!: string;

  @Text({ prompt: "the customer's question or pricing request", minLength: 1 })
  question!: string;

  @Integer({ prompt: "requested seat count when asking for pricing", min: 1, max: 1000 })
  seats!: number;
}

export class GeneralQuestionCaseDto {
  @Text({ prompt: "summary of why this is a general product question" })
  reason!: string;
}

export class PricingRequestCaseDto {
  @Text({ prompt: "tier requested by the customer (starter | pro | enterprise)" })
  tier!: string;
}

export class QuoteCalculationInputDto {
  @Text({ prompt: "plan tier (starter | pro | enterprise)" })
  tier!: string;

  @Integer({ prompt: "number of seats", min: 1, max: 1000 })
  seats!: number;
}

export class QuoteCalculationOutputDto {
  @Text({ prompt: "normalized tier name" })
  tier!: string;

  @Integer({ prompt: "seat count", min: 1 })
  seats!: number;

  @Decimal({ prompt: "monthly total in catalog currency", min: 0 })
  monthlyTotalUsd!: number;

  @Flag({ prompt: "whether volume discount was applied" })
  volumeDiscountApplied!: boolean;

  @Text({ prompt: "currency code from environment" })
  currency!: string;
}

export class SupportReplyDto {
  @Text({ prompt: "department that handled the inquiry (support | pricing)" })
  handledBy!: string;

  @Text({ prompt: "final response message to the customer", minLength: 1 })
  answer!: string;

  @Decimal({ prompt: "quoted monthly amount in USD (0 for general non-pricing inquiries)", min: 0 })
  quotedMonthlyUsd!: number;
}
